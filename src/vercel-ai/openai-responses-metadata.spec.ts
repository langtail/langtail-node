import type { LanguageModelV1StreamPart } from "@ai-sdk/provider"
import nock from "nock"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LangtailPrompts } from "../LangtailPrompts"
import { LangtailChatLanguageModel } from "./langtail-language-model"

const BASE_URL = "https://api.langtail.com"

const responsesProviderMetadata = {
  openai: {
    responses: {
      output_items: [
        {
          id: "rs_123",
          type: "reasoning",
          encrypted_content: "encrypted-reasoning",
          summary: [{ type: "summary_text", text: "Checked the inputs." }],
        },
        {
          id: "msg_123",
          type: "message",
          role: "assistant",
          status: "completed",
          phase: "final_answer",
          content: [
            {
              type: "output_text",
              text: "The answer is 42.",
              annotations: [],
            },
          ],
        },
      ],
    },
  },
}

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

describe("OpenAI Responses metadata round-trip", () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
    nock.cleanAll()
  })

  it("preserves output items from a non-streamed response in the next request", async () => {
    const firstResponse = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(200, {
        id: "chatcmpl-first",
        choices: [
          {
            message: {
              role: "assistant",
              content: "The answer is 42.",
              provider_metadata: responsesProviderMetadata,
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })

    const model = createModel()
    const result = await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Solve it" }] }],
    })

    expect(result.providerMetadata?.langtail).toMatchObject({
      provider_metadata: responsesProviderMetadata,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
    })
    firstResponse.done()

    const secondRequest = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/, (body) => {
        expect(body.messages[0].provider_metadata).toEqual(
          responsesProviderMetadata,
        )
        return true
      })
      .reply(200, {
        id: "chatcmpl-second",
        choices: [
          {
            message: { role: "assistant", content: "Continued." },
            finish_reason: "stop",
            index: 0,
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 2 },
      })

    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        {
          role: "assistant",
          content: [{ type: "text", text: result.text ?? "" }],
          providerMetadata: result.providerMetadata,
        },
        {
          role: "user",
          content: [{ type: "text", text: "Continue" }],
        },
      ],
    })
    secondRequest.done()
  })

  it("preserves output items from a streamed response in the next request", async () => {
    const firstResponse = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          {
            id: "chatcmpl-first-stream",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "The answer is 42." },
              },
            ],
          },
          {
            id: "chatcmpl-first-stream",
            choices: [
              {
                index: 0,
                delta: { provider_metadata: responsesProviderMetadata },
              },
            ],
          },
          {
            id: "chatcmpl-first-stream",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          },
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "Solve it" }] }],
    })
    const parts = await collectStreamParts(stream)
    const finishPart = parts.find((part) => part.type === "finish")

    expect(finishPart).toMatchObject({
      type: "finish",
      providerMetadata: {
        langtail: {
          provider_metadata: responsesProviderMetadata,
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            cachedInputTokens: 0,
            reasoningTokens: 0,
          },
        },
      },
    })
    firstResponse.done()

    const secondRequest = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/, (body) => {
        expect(body.messages[0].provider_metadata).toEqual(
          responsesProviderMetadata,
        )
        return true
      })
      .reply(200, {
        id: "chatcmpl-second-stream",
        choices: [
          {
            message: { role: "assistant", content: "Continued." },
            finish_reason: "stop",
            index: 0,
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 2 },
      })

    await model.doGenerate({
      inputFormat: "prompt",
      mode: { type: "regular" },
      prompt: [
        {
          role: "assistant",
          content: [{ type: "text", text: "The answer is 42." }],
          providerMetadata:
            finishPart?.type === "finish"
              ? finishPart.providerMetadata
              : undefined,
        },
        {
          role: "user",
          content: [{ type: "text", text: "Continue" }],
        },
      ],
    })
    secondRequest.done()
  })
})
