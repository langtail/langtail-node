// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"
import { createLangtail } from "./langtail-provider"

const encode = (s: string) => new TextEncoder().encode(s)
const event = (choices: unknown[], usage?: object) =>
  `data: ${JSON.stringify({ id: "completion-test", model: "test-model", created: 123, choices, ...(usage ? { usage } : {}) })}\n\n`
const chunk = (delta: object, reason: string | null = null) =>
  event([{ index: 0, delta, finish_reason: reason }])
const text = chunk({ content: "Hello 💓 [DONE]" })
const finish = chunk({}, "stop")
const usage = event([], {
  prompt_tokens: 17,
  completion_tokens: 9,
  total_tokens: 26,
})
const done = "data: [DONE]\n\n"
const provider = createLangtail({
  baseURL: "https://local.invalid",
  apiKey: "test",
})
const callOptions = {
  prompt: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: "test" }],
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup(body: string, split: "one" | "bytes" | "random", eof: boolean) {
  const bytes = encode(body)
  const cancel = vi.fn()
  let offset = 0
  let seed = 12345
  const source = new ReadableStream<Uint8Array>({
    pull(c) {
      if (offset >= bytes.length) {
        if (eof) c.close()
        return
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const length =
        split === "one" ? bytes.length : split === "bytes" ? 1 : 1 + (seed % 37)
      c.enqueue(bytes.slice(offset, (offset += length)))
    },
    cancel,
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(source, {
          headers: {
            "content-type": "text/event-stream",
            "x-langtail-request-id": "request-test",
          },
        }),
    ),
  )
  return { cancel, source }
}

async function collect() {
  const result = await provider("test").doStream(callOptions)
  const reader = result.stream.getReader()
  const parts: any[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return { result, parts, finish: parts.find((p) => p.type === "finish") }
}

const scenarios = [
  ["text", text + finish + usage],
  [
    "zero usage",
    text +
      finish +
      event([], { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
  ],
  ["length", text + chunk({}, "length") + usage],
  ["content filter", text + chunk({}, "content_filter") + usage],
  [
    "reasoning",
    chunk({ reasoning_content: "Thinking 💭" }) + text + finish + usage,
  ],
  [
    "signed reasoning",
    chunk({
      reasoning_details: [
        {
          type: "reasoning.text",
          text: "Thinking",
          signature: "sig-test",
          format: "anthropic-claude-v1",
          index: 0,
        },
      ],
    }) +
      text +
      finish +
      usage,
  ],
  [
    "parallel tools",
    chunk({
      tool_calls: [
        {
          index: 0,
          id: "call-0",
          type: "function",
          function: { name: "Read", arguments: '{"path":' },
        },
        {
          index: 1,
          id: "call-1",
          type: "function",
          function: { name: "Read", arguments: '{"path":' },
        },
      ],
    }) +
      chunk({
        tool_calls: [
          { index: 1, function: { arguments: '"b.txt"}' } },
          { index: 0, function: { arguments: '"a.txt"}' } },
        ],
      }) +
      chunk({}, "tool_calls") +
      usage,
  ],
  ["heartbeats", ": ping\n\n" + text + ": ping\n\n" + finish + usage],
  ["BOM", "\uFEFF" + text + finish + usage],
  ["large event", chunk({ content: "💓".repeat(16384) }) + finish + usage],
] as const

it.each(scenarios)(
  "preserves %s results across fragmentation and HTTP lifetime",
  async (name, body) => {
    setup(body + done, "one", true)
    const reference = await collect()
    expect(reference.parts.filter((p) => p.type === "error")).toEqual([])
    expect(reference.parts.filter((p) => p.type === "finish")).toHaveLength(1)
    if (name === "parallel tools") {
      expect(
        reference.parts.filter((p) => p.type === "tool-call"),
      ).toMatchObject([
        { toolCallId: "call-1", toolName: "Read", input: '{"path":"b.txt"}' },
        { toolCallId: "call-0", toolName: "Read", input: '{"path":"a.txt"}' },
      ])
    } else {
      expect(
        reference.parts
          .filter((p) => p.type === "text-delta")
          .map((p) => p.delta)
          .join(""),
      ).toBe(name === "large event" ? "💓".repeat(16384) : "Hello 💓 [DONE]")
    }
    expect(reference.finish.usage).toMatchObject(
      name === "zero usage"
        ? { inputTokens: 0, outputTokens: 0 }
        : { inputTokens: 17, outputTokens: 9 },
    )
    for (const split of name === "large event"
      ? (["random"] as const)
      : (["bytes", "random"] as const)) {
      const { cancel } = setup(
        body + done + "data: garbage-after-done\n\n",
        split,
        false,
      )
      const actual = await collect()
      // V2 generates text/reasoning block IDs; those identifiers are not payload.
      const stable = (parts: any[]) => parts.map(({ id, ...part }) => part)
      expect(stable(actual.parts)).toEqual(stable(reference.parts))
      expect(cancel).toHaveBeenCalledOnce()
    }
  },
)

it("does not end at finish_reason before delayed usage arrives", async () => {
  let upstream!: ReadableStreamDefaultController<Uint8Array>
  const cancel = vi.fn()
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              upstream = c
            },
            cancel,
          }),
        ),
    ),
  )
  const result = await provider("test").doStream(callOptions)
  const reader = result.stream.getReader()
  upstream.enqueue(encode(text + finish))
  let part: any
  do {
    part = (await reader.read()).value
  } while (part.type !== "text-delta")
  expect(cancel).not.toHaveBeenCalled()
  upstream.enqueue(encode(usage + done))
  const parts: any[] = []
  while (true) {
    const next = await reader.read()
    if (next.done) break
    parts.push(next.value)
  }
  expect(parts.find((p) => p.type === "finish").usage).toMatchObject({
    inputTokens: 17,
    outputTokens: 9,
  })
  expect(cancel).toHaveBeenCalledOnce()
})

it.each([
  ["empty EOF", ""],
  ["finish without DONE", text + finish + usage],
  ["text without finish", text],
  ["unterminated JSON", text + 'data: {"choices":'],
])("preserves existing clean EOF behavior: %s", async (_name, body) => {
  setup(body, "random", true)
  const { parts } = await collect()
  expect(parts.filter((p) => p.type === "finish")).toHaveLength(1)
  expect(parts.filter((p) => p.type === "error")).toEqual([])
})

it.each([
  [
    "error envelope",
    'data: {"error":{"message":"Upstream LLM stream interrupted","code":"UPSTREAM_STREAM_INTERRUPTED"}}\n\n',
  ],
  ["malformed JSON", 'data: {"choices":\n\n'],
  ["invalid schema", 'data: {"choices":42}\n\n'],
])("surfaces %s after partial text", async (_name, tail) => {
  setup(text + tail + done, "bytes", false)
  const { parts, finish } = await collect()
  expect(
    parts
      .filter((p) => p.type === "text-delta")
      .map((p) => p.delta)
      .join(""),
  ).toBe("Hello 💓 [DONE]")
  expect(parts.filter((p) => p.type === "error")).toHaveLength(1)
  expect(finish.finishReason).toBe("error")
})

it.each([0, 1, 20])(
  "propagates provider read failures after %i bytes of a partial event",
  async (tailLength) => {
    const failure = new Error("provider connection reset")
    let upstream!: ReadableStreamDefaultController<Uint8Array>
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(c) {
                upstream = c
              },
            }),
          ),
      ),
    )
    const result = await provider("test").doStream(callOptions)
    const reader = result.stream.getReader()
    upstream.enqueue(encode(text))
    let part: any
    do {
      part = (await reader.read()).value
    } while (part.type !== "text-delta")
    if (tailLength)
      upstream.enqueue(encode('data: {"choices": [{}]}').slice(0, tailLength))
    const pending = reader.read()
    upstream.error(failure)
    await expect(pending).rejects.toBe(failure)
  },
)

it.each([false, true])(
  "cancels silent response, partial event=%s",
  async (partial) => {
    const cancel = vi.fn()
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        if (partial) c.enqueue(encode('data: {"choices":'))
      },
      cancel,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(source)),
    )
    const { stream } = await provider("test").doStream(callOptions)
    const reader = stream.getReader()
    // V2's start event is synchronous; start draining until cancellation.
    const drain = (async () => {
      while (!(await reader.read()).done) {}
    })()
    await reader.cancel("stop")
    await drain
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith("stop"))
  },
)

it.each([401, 429, 503])(
  "preserves pre-stream HTTP %i errors",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: "provider rejected request",
                type: "api_error",
                code: "test",
              },
            }),
            { status },
          ),
      ),
    )
    await expect(provider("test").doStream(callOptions)).rejects.toMatchObject({
      statusCode: status,
    })
  },
)
