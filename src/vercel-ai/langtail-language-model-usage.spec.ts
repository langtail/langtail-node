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

  return new LangtailChatLanguageModel("test-prompt", {}, {
    provider: "langtail.chat",
    langtailPrompts,
    headers: {
      "X-API-Key": "test-api-key",
      "content-type": "application/json",
    },
  })
}

const defaultCallOptions = {
  inputFormat: "prompt" as const,
  mode: { type: "regular" as const },
  prompt: [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }],
}

describe("Usage reporting", () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
    nock.cleanAll()
  })

  describe("doGenerate", () => {
    it("should return basic usage in the standard V1 format", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, {
          id: "chatcmpl-123",
          choices: [{
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
            index: 0,
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
          },
        })

      const model = createModel()
      const result = await model.doGenerate(defaultCallOptions)

      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
      })
      scope.done()
    })

    it("should expose rich usage via providerMetadata.langtail", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, {
          id: "chatcmpl-123",
          choices: [{
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
            index: 0,
          }],
          usage: {
            prompt_tokens: 16454,
            completion_tokens: 333,
            prompt_tokens_details: {
              cached_tokens: 13128,
            },
            completion_tokens_details: {
              reasoning_tokens: 50,
            },
          },
        })

      const model = createModel()
      const result = await model.doGenerate(defaultCallOptions)

      expect(result.providerMetadata?.langtail).toEqual({
        usage: {
          promptTokens: 16454,
          completionTokens: 333,
          cachedInputTokens: 13128,
          reasoningTokens: 50,
        },
      })
      scope.done()
    })

    it("should include rawUsage when present", async () => {
      const rawUsage = {
        origin: "anthropic",
        input_tokens: 48,
        output_tokens: 333,
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 2622,
        },
        cache_read_input_tokens: 13128,
        cache_creation_input_tokens: 2622,
      }

      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, {
          id: "chatcmpl-123",
          choices: [{
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
            index: 0,
          }],
          usage: {
            prompt_tokens: 16454,
            completion_tokens: 333,
            prompt_tokens_details: {
              cached_tokens: 13128,
            },
            raw_usage: rawUsage,
          },
        })

      const model = createModel()
      const result = await model.doGenerate(defaultCallOptions)

      const langtailMeta = result.providerMetadata?.langtail as Record<string, any>
      expect(langtailMeta.usage.rawUsage).toEqual(rawUsage)
      expect(langtailMeta.usage.promptTokens).toBe(16454)
      expect(langtailMeta.usage.completionTokens).toBe(333)
      expect(langtailMeta.usage.cachedInputTokens).toBe(13128)
      scope.done()
    })

    it("should preserve providerMetadata.openai for backward compatibility", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, {
          id: "chatcmpl-123",
          choices: [{
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
            index: 0,
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            prompt_tokens_details: {
              cached_tokens: 50,
            },
            completion_tokens_details: {
              reasoning_tokens: 10,
            },
          },
        })

      const model = createModel()
      const result = await model.doGenerate(defaultCallOptions)

      // openai metadata should still be set
      expect(result.providerMetadata?.openai).toEqual({
        reasoningTokens: 10,
        cachedPromptTokens: 50,
      })

      // langtail metadata should also be set
      expect(result.providerMetadata?.langtail).toEqual({
        usage: {
          promptTokens: 100,
          completionTokens: 20,
          cachedInputTokens: 50,
          reasoningTokens: 10,
        },
      })
      scope.done()
    })

    it("should default to 0 for missing detail fields", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, {
          id: "chatcmpl-123",
          choices: [{
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
            index: 0,
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
          },
        })

      const model = createModel()
      const result = await model.doGenerate(defaultCallOptions)

      const langtailMeta = result.providerMetadata?.langtail as Record<string, any>
      expect(langtailMeta.usage.cachedInputTokens).toBe(0)
      expect(langtailMeta.usage.reasoningTokens).toBe(0)
      expect(langtailMeta.usage.rawUsage).toBeUndefined()
      scope.done()
    })
  })

  describe("doStream", () => {
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

    it("should emit usage in the finish event", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, createSSEResponse([
          {
            id: "chatcmpl-123",
            choices: [{
              delta: { role: "assistant", content: "Hi" },
              index: 0,
            }],
          },
          {
            id: "chatcmpl-123",
            choices: [{
              delta: {},
              finish_reason: "stop",
              index: 0,
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
            },
          },
        ]), {
          "content-type": "text/event-stream",
        })

      const model = createModel()
      const { stream } = await model.doStream(defaultCallOptions)
      const parts = await collectStreamParts(stream)

      const finishPart = parts.find((p) => p.type === "finish")
      expect(finishPart).toBeDefined()
      if (finishPart?.type === "finish") {
        expect(finishPart.usage).toEqual({
          promptTokens: 10,
          completionTokens: 5,
        })
      }
      scope.done()
    })

    it("should expose rich usage via providerMetadata.langtail in stream finish", async () => {
      const rawUsage = {
        origin: "anthropic",
        input_tokens: 48,
        output_tokens: 333,
        cache_read_input_tokens: 13128,
        cache_creation_input_tokens: 2622,
      }

      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, createSSEResponse([
          {
            id: "chatcmpl-123",
            choices: [{
              delta: { role: "assistant", content: "Hi" },
              index: 0,
            }],
          },
          {
            id: "chatcmpl-123",
            choices: [{
              delta: {},
              finish_reason: "stop",
              index: 0,
            }],
            usage: {
              prompt_tokens: 16454,
              completion_tokens: 333,
              prompt_tokens_details: {
                cached_tokens: 13128,
              },
              completion_tokens_details: {
                reasoning_tokens: 0,
              },
              raw_usage: rawUsage,
            },
          },
        ]), {
          "content-type": "text/event-stream",
        })

      const model = createModel()
      const { stream } = await model.doStream(defaultCallOptions)
      const parts = await collectStreamParts(stream)

      const finishPart = parts.find((p) => p.type === "finish")
      expect(finishPart).toBeDefined()
      if (finishPart?.type === "finish") {
        const langtailMeta = finishPart.providerMetadata?.langtail as Record<string, any>
        expect(langtailMeta.usage).toEqual({
          promptTokens: 16454,
          completionTokens: 333,
          cachedInputTokens: 13128,
          reasoningTokens: 0,
          rawUsage,
        })
      }
      scope.done()
    })

    it("should preserve providerMetadata.openai in stream finish", async () => {
      const scope = nock(BASE_URL)
        .post(/\/project-prompt\/test-prompt\/production/)
        .reply(200, createSSEResponse([
          {
            id: "chatcmpl-123",
            choices: [{
              delta: { role: "assistant", content: "Hi" },
              index: 0,
            }],
          },
          {
            id: "chatcmpl-123",
            choices: [{
              delta: {},
              finish_reason: "stop",
              index: 0,
            }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              prompt_tokens_details: {
                cached_tokens: 50,
              },
              completion_tokens_details: {
                reasoning_tokens: 10,
              },
            },
          },
        ]), {
          "content-type": "text/event-stream",
        })

      const model = createModel()
      const { stream } = await model.doStream(defaultCallOptions)
      const parts = await collectStreamParts(stream)

      const finishPart = parts.find((p) => p.type === "finish")
      expect(finishPart).toBeDefined()
      if (finishPart?.type === "finish") {
        expect(finishPart.providerMetadata?.openai).toEqual({
          reasoningTokens: 10,
          cachedPromptTokens: 50,
        })
        expect((finishPart.providerMetadata?.langtail as any).usage).toEqual({
          promptTokens: 100,
          completionTokens: 20,
          cachedInputTokens: 50,
          reasoningTokens: 10,
        })
      }
      scope.done()
    })
  })
})
