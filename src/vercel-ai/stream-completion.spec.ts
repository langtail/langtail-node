// @vitest-environment node
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { streamText, tool } from "ai"
import { z } from "zod"
import { expect, it } from "vitest"
import { createLangtail } from "./langtail-provider"

it.each(["\n", "\r", "\r\n"])(
  "finishes tools and usage at DONE with %j framing without HTTP EOF",
  async (newline) => {
    let onDisconnect!: () => void
    const disconnected = new Promise<void>((resolve) => {
      onDisconnect = resolve
    })
    const event = (choices: unknown[], usage?: object) =>
      "data: " +
      JSON.stringify({
        id: "test",
        model: "test",
        created: 1,
        choices,
        ...(usage ? { usage } : {}),
      }) +
      newline +
      newline
    const server = createServer((request, response) => {
      request.resume()
      response.on("close", () => {
        onDisconnect()
      })
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(
        event([
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call",
                  type: "function",
                  function: { name: "Read", arguments: '{"path":"a.txt"}' },
                },
              ],
            },
            finish_reason: null,
          },
        ]),
      )
      response.write(
        event([{ index: 0, delta: {}, finish_reason: "tool_calls" }]),
      )
      response.write(
        event([], { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 }),
      )
      response.write("data: [DONE]" + newline + newline)
      // Deliberately leave the HTTP response open after protocol completion.
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const abort = new AbortController()
    let deadline: ReturnType<typeof setTimeout> | undefined
    try {
      const provider = createLangtail({
        baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        apiKey: "local-test",
      })
      const result = streamText({
        model: provider("test"),
        prompt: "test",
        maxRetries: 0,
        abortSignal: abort.signal,
        toolCallStreaming: true,
        tools: { Read: tool({ parameters: z.object({ path: z.string() }) }) },
      })
      const drain = (async () => {
        for await (const _ of result.fullStream) {
        }
        return "finished"
      })()
      void drain.catch(() => {})
      const outcome = await Promise.race([
        drain,
        new Promise<string>((resolve) => {
          deadline = setTimeout(
            () => resolve("still waiting for HTTP EOF"),
            2000,
          )
        }),
      ])
      expect(outcome).toBe("finished")
      expect(await result.finishReason).toBe("tool-calls")
      expect(await result.toolCalls).toMatchObject([
        { toolName: "Read", args: { path: "a.txt" } },
      ])
      expect(await result.usage).toMatchObject({
        promptTokens: 7,
        completionTokens: 3,
      })
      await disconnected
    } finally {
      clearTimeout(deadline)
      abort.abort()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  },
)

it.each(["provider error", "caller abort"])(
  "preserves partial text on %s",
  async (mode) => {
    const abort = new AbortController()
    let onDisconnect!: () => void
    const disconnected = new Promise<void>((resolve) => {
      onDisconnect = resolve
    })
    const server = createServer((request, response) => {
      request.resume()
      response.on("close", onDisconnect)
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(
        'data: {"id":"partial","choices":[{"index":0,"delta":{"content":"Partial 💓"},"finish_reason":null}]}\n\n',
      )
      if (mode === "provider error") {
        response.end(
          'data: {"error":{"message":"Upstream LLM stream interrupted","code":"UPSTREAM_STREAM_INTERRUPTED"}}\n\n',
        )
      }
      // Caller-abort case keeps the connection open until the client cancels.
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    try {
      const result = streamText({
        model: createLangtail({
          apiKey: "local-test",
          baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        })("test"),
        prompt: "test",
        maxRetries: 0,
        abortSignal: abort.signal,
        onError() {},
      })
      let text = ""
      const errors: unknown[] = []
      const drain = (async () => {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            text += part.textDelta
            if (mode === "caller abort") abort.abort()
          }
          if (part.type === "error") errors.push(part.error)
        }
      })()
      if (mode === "caller abort") {
        await expect(drain).rejects.toMatchObject({ name: "AbortError" })
      } else {
        await drain
      }
      expect(text).toBe("Partial 💓")
      if (mode === "provider error") {
        expect(errors).toEqual([
          expect.objectContaining({ code: "UPSTREAM_STREAM_INTERRUPTED" }),
        ])
        expect(await result.finishReason).toBe("error")
      }
      await disconnected
    } finally {
      abort.abort()
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  },
)
