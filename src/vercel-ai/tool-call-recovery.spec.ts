import { describe, expect, it, beforeAll, afterAll } from "vitest"
import nock from "nock"
import { LangtailChatLanguageModel } from "./langtail-language-model"
import { LangtailPrompts } from "../LangtailPrompts"
import type { LanguageModelV1StreamPart } from "@ai-sdk/provider"

const BASE_URL = "https://api.langtail.com"

function createModel() {
  const langtailPrompts = new LangtailPrompts({
    apiKey: "test-api-key",
    baseURL: BASE_URL,
  })

  return new LangtailChatLanguageModel(
    "test-prompt",
    {},
    {
      provider: "langtail.chat",
      langtailPrompts,
      headers: {
        "X-API-Key": "test-api-key",
        "content-type": "application/json",
      },
    },
  )
}

const defaultCallOptions = {
  inputFormat: "prompt" as const,
  mode: { type: "regular" as const },
  prompt: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: "Hello" }],
    },
  ],
}

function createSSEResponse(chunks: object[]) {
  return chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .concat("data: [DONE]\n\n")
    .join("")
}

async function collectStreamParts(
  stream: ReadableStream<LanguageModelV1StreamPart>,
): Promise<LanguageModelV1StreamPart[]> {
  const parts: LanguageModelV1StreamPart[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

// Build an OpenAI-format streaming chunk with a tool_call delta.
function toolCallChunk(delta: {
  id?: string
  index: number
  name?: string
  arguments?: string
}) {
  const fn: Record<string, string> = {}
  if (delta.name) fn.name = delta.name
  if (delta.arguments != null) fn.arguments = delta.arguments
  const tc: Record<string, unknown> = { index: delta.index, function: fn }
  if (delta.id) {
    tc.id = delta.id
    tc.type = "function"
  }
  return {
    id: "chatcmpl-test",
    choices: [{ index: 0, delta: { tool_calls: [tc] } }],
  }
}

function finishChunk(finish_reason: string) {
  return {
    id: "chatcmpl-test",
    choices: [{ index: 0, delta: {}, finish_reason }],
  }
}

function reasoningChunk(text: string) {
  return {
    id: "chatcmpl-test",
    choices: [{ index: 0, delta: { reasoning_content: text } }],
  }
}

function getFinishPart(parts: LanguageModelV1StreamPart[]) {
  const finishPart = parts.find((p) => p.type === "finish")
  expect(finishPart).toBeDefined()
  if (finishPart?.type !== "finish") {
    throw new Error("Expected finish part")
  }
  return finishPart
}

describe("Streaming tool-call recovery", () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
    nock.cleanAll()
  })

  it("emits a tool-call when args close cleanly mid-stream (no regression)", async () => {
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "call_1",
            name: "Read",
          }),
          toolCallChunk({ index: 0, arguments: '{"file_path"' }),
          toolCallChunk({ index: 0, arguments: ': "app/page.tsx"}' }),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(1)
    if (toolCalls[0].type === "tool-call") {
      expect(toolCalls[0].toolName).toBe("Read")
      expect(toolCalls[0].toolCallId).toBe("call_1")
      expect(JSON.parse(toolCalls[0].args as string)).toEqual({
        file_path: "app/page.tsx",
      })
    }
    const finishPart = getFinishPart(parts)
    expect(finishPart.providerMetadata?.langtail?.toolCallDiagnostics).toEqual({
      rawFinishReason: "tool_calls",
      mappedFinishReason: "tool-calls",
      toolCallDeltaCount: 3,
      toolCallStartCount: 1,
      toolCallArgumentDeltaCount: 2,
      bufferedToolCallCount: 1,
      emittedToolCallCount: 1,
      recoveredToolCallCount: 0,
      recoveryModes: [],
      finishToolCallsWithoutToolCallDeltas: false,
    })
    scope.done()
  })

  it("records when finish_reason=tool_calls arrives without any tool-call deltas", async () => {
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          reasoningChunk(
            "Now I need to replace headers.map with displayHeaders.map.",
          ),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    expect(parts.filter((p) => p.type === "tool-call")).toHaveLength(0)
    const finishPart = getFinishPart(parts)
    expect(finishPart.finishReason).toBe("tool-calls")
    expect(finishPart.providerMetadata?.langtail?.toolCallDiagnostics).toEqual({
      rawFinishReason: "tool_calls",
      mappedFinishReason: "tool-calls",
      toolCallDeltaCount: 0,
      toolCallStartCount: 0,
      toolCallArgumentDeltaCount: 0,
      bufferedToolCallCount: 0,
      emittedToolCallCount: 0,
      recoveredToolCallCount: 0,
      recoveryModes: [],
      finishToolCallsWithoutToolCallDeltas: true,
    })
    scope.done()
  })

  it("recovers a tool-call when the closing `}` arrives bundled with trailing junk", async () => {
    // Repro of the Kimi-K2.6 bug where the closing `"}` and a trailing
    // `, "extra": false}` arrive in the same delta. The accumulated args
    // string is never parseable JSON during streaming, so the per-delta
    // isParsableJson check never fires and the tool-call is dropped.
    // flush() must recover by parsing the longest valid JSON prefix.
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "functions.SearchReplace:84",
            name: "SearchReplace",
          }),
          toolCallChunk({
            index: 0,
            arguments: ' {"file_path": "app/page.tsx"',
          }),
          toolCallChunk({ index: 0, arguments: ', "old_string": "before"' }),
          // new_string value left unterminated here on purpose — the closing
          // `"` arrives bundled with `}` and `,` in the next delta.
          toolCallChunk({ index: 0, arguments: ', "new_string": "after' }),
          // Critical chunk: string-closing `"`, object-closing `}`, and the
          // trailing comma all arrive together. The buffer transitions from
          // `..."after` (incomplete string, not parseable) directly to
          // `..."after"},` (object closed but trailing junk, not parseable),
          // skipping the brief state where the buffer is exactly valid JSON.
          toolCallChunk({ index: 0, arguments: '"},' }),
          toolCallChunk({ index: 0, arguments: ' "replace": false}' }),
          toolCallChunk({ index: 0, arguments: " " }),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(1)
    if (toolCalls[0].type === "tool-call") {
      expect(toolCalls[0].toolName).toBe("SearchReplace")
      expect(toolCalls[0].toolCallId).toBe("functions.SearchReplace:84")
      expect(JSON.parse(toolCalls[0].args as string)).toEqual({
        file_path: "app/page.tsx",
        old_string: "before",
        new_string: "after",
      })
    }

    // Tool-call must be enqueued before the finish event, so downstream
    // consumers (AI SDK) see it as part of the same step.
    const toolCallIdx = parts.findIndex((p) => p.type === "tool-call")
    const finishIdx = parts.findIndex((p) => p.type === "finish")
    expect(toolCallIdx).toBeGreaterThan(-1)
    expect(finishIdx).toBeGreaterThan(toolCallIdx)
    const finishPart = getFinishPart(parts)
    expect(
      finishPart.providerMetadata?.langtail?.toolCallDiagnostics,
    ).toMatchObject({
      rawFinishReason: "tool_calls",
      mappedFinishReason: "tool-calls",
      toolCallDeltaCount: 7,
      bufferedToolCallCount: 1,
      emittedToolCallCount: 1,
      recoveredToolCallCount: 1,
      recoveryModes: ["json_prefix"],
      finishToolCallsWithoutToolCallDeltas: false,
    })
    scope.done()
  })

  it("falls back to raw args when no valid JSON prefix exists, so downstream repair can run", async () => {
    // When args are malformed in a way no parseable prefix can fix
    // (e.g. unescaped `"` inside a string value, breaking the outer JSON
    // structure), silently dropping the tool call would surface as
    // `no_tool_calls` to consumers. Instead, pass the raw buffered args
    // through so AI SDK's experimental_repairToolCall (or equivalent)
    // gets a chance to fix or re-prompt the model.
    const garbage = "garbage no json here"
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "call_2",
            name: "Read",
          }),
          toolCallChunk({ index: 0, arguments: garbage }),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(1)
    if (toolCalls[0].type === "tool-call") {
      expect(toolCalls[0].toolName).toBe("Read")
      expect(toolCalls[0].args).toBe(garbage)
    }
    const finishPart = getFinishPart(parts)
    expect(
      finishPart.providerMetadata?.langtail?.toolCallDiagnostics,
    ).toMatchObject({
      emittedToolCallCount: 1,
      recoveredToolCallCount: 1,
      recoveryModes: ["raw_args"],
      finishToolCallsWithoutToolCallDeltas: false,
    })
    scope.done()
  })

  it("falls back to raw args when an unescaped quote breaks JSON inside a string value", async () => {
    // Real-world Kimi-K2.6 case: model emitted a JSX whitespace
    // expression `{" "}` inside a TypeScript string value, escaping the
    // second quote but not the first. The result is JSON like
    // `{"content": "...{" "}..."}` where the unescaped `"` after `{`
    // prematurely closes the outer string value, producing a
    // "Expected ',' or '}' after property value" error mid-buffer. No
    // prefix is parseable, so findLongestParsableJsonPrefix returns null
    // and the recovery must fall back to emitting the raw args.
    const broken =
      '{"file_path": "page.tsx", "content": "before {" \\"}\\nafter"}'
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "call_orphan_quote",
            name: "Write",
          }),
          toolCallChunk({ index: 0, arguments: broken }),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(1)
    if (toolCalls[0].type === "tool-call") {
      expect(toolCalls[0].toolName).toBe("Write")
      expect(toolCalls[0].args).toBe(broken)
      // Sanity: this shape really is unrecoverable to a clean JSON
      // prefix — proves the fallback path is what saved us.
      expect(() => JSON.parse(broken)).toThrow()
    }
    // tool-call must precede the finish event so consumers see it as
    // part of the same step.
    const toolCallIdx = parts.findIndex((p) => p.type === "tool-call")
    const finishIdx = parts.findIndex((p) => p.type === "finish")
    expect(toolCallIdx).toBeGreaterThan(-1)
    expect(finishIdx).toBeGreaterThan(toolCallIdx)
    scope.done()
  })

  it("does not recover when stream ends with finish_reason=length", async () => {
    // Truncation by token limit mid-tool-call: even though the buffered args
    // contain a valid JSON prefix, the model didn't commit to the call.
    // Recovery would otherwise execute a half-baked tool invocation.
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "call_3",
            name: "SearchReplace",
          }),
          // Args close cleanly but the model was about to send more before
          // hitting the token limit (no `tool_calls` finish reason follows).
          toolCallChunk({
            index: 0,
            arguments:
              '{"file_path": "x", "old_string": "a", "new_string": "b"}, "extra"',
          }),
          finishChunk("length"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(0)
    const finishPart = parts.find((p) => p.type === "finish")
    expect(finishPart).toBeDefined()
    if (finishPart?.type === "finish") {
      expect(finishPart.finishReason).toBe("length")
    }
    scope.done()
  })

  it("handles a sparse tool_calls index without iterating empty slots", async () => {
    // The provider indexes toolCalls by delta.index. A pathological stream
    // can set a very large index — flush() must not walk every empty slot
    // up to that index. Using a moderate index (50) keeps the test fast
    // while exercising the sparse-array code path; for...of would visit
    // 51 slots, Object.values visits 1.
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 50,
            id: "call_sparse",
            name: "Read",
          }),
          toolCallChunk({
            index: 50,
            arguments: '{"file_path": "x.ts"}, junk',
          }),
          finishChunk("tool_calls"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const start = Date.now()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)
    const elapsed = Date.now() - start

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(1)
    if (toolCalls[0].type === "tool-call") {
      expect(toolCalls[0].toolCallId).toBe("call_sparse")
      expect(JSON.parse(toolCalls[0].args as string)).toEqual({
        file_path: "x.ts",
      })
    }
    // Generous bound — purely a guard against accidental O(maxIndex) regressions.
    expect(elapsed).toBeLessThan(500)
    scope.done()
  })

  it("does not recover when stream ends with finish_reason=stop", async () => {
    // Same shape as the recovery case, but the model bailed with "stop"
    // instead of "tool_calls" — buffered args do not represent intent.
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          toolCallChunk({
            index: 0,
            id: "call_4",
            name: "Read",
          }),
          toolCallChunk({
            index: 0,
            arguments: '{"file_path": "x"}, junk',
          }),
          finishChunk("stop"),
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    const toolCalls = parts.filter((p) => p.type === "tool-call")
    expect(toolCalls).toHaveLength(0)
    scope.done()
  })
})
