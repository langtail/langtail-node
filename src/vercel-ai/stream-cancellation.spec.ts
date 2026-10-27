// @vitest-environment node
import { createServer } from "node:http"
import type { ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, it } from "vitest"
import { createLangtail } from "./langtail-provider"

const delta =
  'data: {"id":"test","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}\n\n'
const callOptions = {
  prompt: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: "test" }],
    },
  ],
}

it.each([
  "before headers",
  "silent body",
  "partial event",
  ...Array.from({ length: 10 }, (_, i) => `active ${i}`),
])("cancels real HTTP transport: %s", async (mode) => {
  let requested!: () => void
  const requestSeen = new Promise<void>((resolve) => {
    requested = resolve
  })
  let disconnected!: () => void
  const closed = new Promise<void>((resolve) => {
    disconnected = resolve
  })
  let timer: ReturnType<typeof setInterval> | undefined
  const server = createServer((request, response) => {
    request.resume()
    response.on("close", () => {
      clearInterval(timer)
      disconnected()
    })
    requested()
    if (mode === "before headers") return
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.flushHeaders()
    if (mode === "partial event") response.write('data: {"choices":')
    if (mode.startsWith("active"))
      timer = setInterval(() => response.write(delta), 1)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const abort = new AbortController()
  try {
    const model = createLangtail({
      apiKey: "local-test",
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    })("test")
    const pending = model.doStream({
      ...callOptions,
      abortSignal: abort.signal,
    })
    await requestSeen
    if (mode === "before headers") {
      abort.abort()
      await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    } else {
      const { stream } = await pending
      const reader = stream.getReader()
      if (mode.startsWith("active")) {
        let part: any
        do {
          part = (await reader.read()).value
        } while (part.type !== "text-delta")
      }
      await reader.cancel("client stopped")
    }
    await closed
  } finally {
    abort.abort()
    clearInterval(timer)
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

it("propagates a real socket reset after delivered text", async () => {
  let response!: ServerResponse
  const server = createServer((request, res) => {
    request.resume()
    response = res
    res.writeHead(200, { "content-type": "text/event-stream" })
    res.write(delta)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const model = createLangtail({
      apiKey: "local-test",
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    })("test")
    const { stream } = await model.doStream(callOptions)
    const reader = stream.getReader()
    let part: any
    do {
      part = (await reader.read()).value
    } while (part.type !== "text-delta")
    expect(part.delta).toBe("hello")
    const next = reader.read()
    response.destroy()
    await expect(next).rejects.toBeInstanceOf(Error)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
