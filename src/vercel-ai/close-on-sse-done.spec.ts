// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { closeOnSseDone } from "./close-on-sse-done"

const encoder = new TextEncoder()

describe("SSE protocol completion", () => {
  it.each(["\n", "\r", "\r\n"])(
    "handles %j framing at every byte boundary",
    async (newline) => {
      const payload = 'data: {"content":"hello 💓 [DONE]"}' + newline + newline
      const done = "data: [DONE]" + newline + newline
      const bytes = encoder.encode(payload + done)
      for (let split = 0; split <= bytes.length; split++) {
        const cancel = vi.fn()
        const source = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes.slice(0, split))
            controller.enqueue(bytes.slice(split))
            controller.enqueue(
              encoder.encode("data: must-not-be-forwarded\n\n"),
            )
          },
          cancel,
        })
        const result = await new Response(closeOnSseDone(source)).text()
        // A CR terminates the final record without waiting for an optional LF.
        expect(result).toBe(
          payload + (newline === "\r\n" ? done.slice(0, -1) : done),
        )
        expect(cancel).toHaveBeenCalledOnce()
      }
    },
  )

  it("does not mistake comments, event names, multiline data, or JSON strings for DONE", async () => {
    const payload =
      ': [DONE]\n\nevent: [DONE]\n\ndata: [DO\ndata: NE]\n\ndata: {"text":"[DONE]"}\n\n'
    const cancel = vi.fn()
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(payload)
        controller.close()
      },
      cancel,
    })
    expect(await new Response(closeOnSseDone(source)).text()).toBe(payload)
    expect(cancel).not.toHaveBeenCalled()
  })

  it("preserves usage after finish_reason and before DONE", async () => {
    const payload =
      'data: {"finish_reason":"tool_calls"}\n\ndata: {"usage":{"total_tokens":42}}\n\ndata:[DONE]\n\n'
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(payload)
      },
    })
    expect(await new Response(closeOnSseDone(source)).text()).toBe(payload)
  })

  it("does not wait for a hung upstream cancellation promise", async () => {
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("data: [DONE]\n\n")
      },
      cancel() {
        return new Promise(() => {})
      },
    })
    expect(await new Response(closeOnSseDone(source)).text()).toBe(
      "data: [DONE]\n\n",
    )
  })

  it("forwards caller cancellation and source errors", async () => {
    const cancel = vi.fn()
    const source = new ReadableStream<string>({ cancel })
    const reader = closeOnSseDone(source).getReader()
    const pending = reader.read()
    await reader.cancel("stop")
    await expect(pending).resolves.toMatchObject({ done: true })
    expect(cancel).toHaveBeenCalledWith("stop")
    const error = new Error("reset")
    const failed = new ReadableStream<string>({
      start(controller) {
        controller.error(error)
      },
    })
    await expect(new Response(closeOnSseDone(failed)).text()).rejects.toBe(
      error,
    )
  })

  it("forwards large records and unterminated EOF without retaining payload text", async () => {
    const payload = "data: " + "x".repeat(256 * 1024) + "\n\ndata: unfinished"
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(payload)
        controller.close()
      },
    })
    expect(await new Response(closeOnSseDone(source)).text()).toBe(payload)
  })
})

it("does not finish on an unterminated DONE record", async () => {
  let upstream!: ReadableStreamDefaultController<string>
  const cancel = vi.fn()
  const source = new ReadableStream<string>({
    start(c) {
      upstream = c
    },
    cancel,
  })
  const reader = closeOnSseDone(source).getReader()
  upstream.enqueue("data: [DONE]\n")
  expect((await reader.read()).done).toBe(false)
  expect(cancel).not.toHaveBeenCalled()
  upstream.enqueue("\n")
  expect((await reader.read()).done).toBe(false)
  expect((await reader.read()).done).toBe(true)
  expect(cancel).toHaveBeenCalledOnce()
})

it("does not treat extra data fields or trailing characters as DONE", async () => {
  const payload =
    "data: [DONE]\ndata:\n\ndata: [DONE] suffix\n\ndata: [DONE] \n\n"
  const source = new ReadableStream<string>({
    start(c) {
      c.enqueue(payload)
      c.close()
    },
  })
  expect(await new Response(closeOnSseDone(source)).text()).toBe(payload)
})

it("handles a stream delivered one byte at a time", async () => {
  const payload =
    ': heartbeat\r\ndata: {"content":"💓"}\r\n\r\ndata: [DONE]\n\n'
  const bytes = encoder.encode(payload)
  let index = 0
  const cancel = vi.fn()
  const source = new ReadableStream<Uint8Array>({
    pull(c) {
      if (index < bytes.length) c.enqueue(bytes.slice(index, ++index))
    },
    cancel,
  })
  expect(await new Response(closeOnSseDone(source)).text()).toBe(payload)
  expect(cancel).toHaveBeenCalledOnce()
})

it("observes rejected upstream cancellation without failing completed output", async () => {
  const source = new ReadableStream<string>({
    start(c) {
      c.enqueue("data: [DONE]\n\n")
    },
    cancel() {
      return Promise.reject(new Error("cancel rejected"))
    },
  })
  expect(await new Response(closeOnSseDone(source)).text()).toBe(
    "data: [DONE]\n\n",
  )
})

it("does not wait for hung cancellation when the caller stops a silent read", async () => {
  const cancel = vi.fn(() => new Promise<void>(() => {}))
  const reader = closeOnSseDone(
    new ReadableStream<string>({ cancel }),
  ).getReader()
  const pending = reader.read()
  await reader.cancel("caller stopped")
  await expect(pending).resolves.toEqual({ done: true, value: undefined })
  expect(cancel).toHaveBeenCalledWith("caller stopped")
})
