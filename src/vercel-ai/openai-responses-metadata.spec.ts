import type { LanguageModelV1StreamPart } from "@ai-sdk/provider"
import nock from "nock"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { LangtailPrompts } from "../LangtailPrompts"
import { convertToOpenAIChatMessages } from "./convert-to-openai-chat-messages"
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

const refusal = "I cannot help with that request."
const refusalProviderMetadata = {
  openai: {
    responses: {
      output_items: [
        {
          id: "msg_refusal",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "refusal", refusal }],
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

function convertToolCallWithMetadata({
  args,
  rawArguments,
}: {
  args: Record<string, unknown>
  rawArguments: string
}) {
  return convertToOpenAIChatMessages({
    prompt: [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_weather",
            toolName: "get_weather",
            args,
          },
        ],
        providerMetadata: {
          langtail: {
            provider_metadata: {
              openai: {
                responses: {
                  output_items: [
                    {
                      type: "function_call",
                      call_id: "call_weather",
                      name: "get_weather",
                      arguments: rawArguments,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ],
  })
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

  it("preserves a non-streamed refusal in the next request", async () => {
    nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(200, {
        id: "chatcmpl-refusal",
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              refusal,
              provider_metadata: refusalProviderMetadata,
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
      prompt: [{ role: "user", content: [{ type: "text", text: "Request" }] }],
    })

    expect(result.providerMetadata?.langtail).toMatchObject({ refusal })

    const secondRequest = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/, (body) => {
        expect(body.messages[0].refusal).toBe(refusal)
        return true
      })
      .reply(200, {
        id: "chatcmpl-after-refusal",
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
          content: [],
          providerMetadata: result.providerMetadata,
        },
        { role: "user", content: [{ type: "text", text: "Continue" }] },
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

  it("preserves a streamed refusal in the next request", async () => {
    nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          {
            id: "chatcmpl-refusal-stream",
            choices: [{ index: 0, delta: { refusal } }],
          },
          {
            id: "chatcmpl-refusal-stream",
            choices: [
              {
                index: 0,
                delta: { provider_metadata: refusalProviderMetadata },
              },
            ],
          },
          {
            id: "chatcmpl-refusal-stream",
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
      prompt: [{ role: "user", content: [{ type: "text", text: "Request" }] }],
    })
    const parts = await collectStreamParts(stream)
    const finishPart = parts.find((part) => part.type === "finish")

    expect(finishPart).toMatchObject({
      type: "finish",
      providerMetadata: { langtail: { refusal } },
    })

    const secondRequest = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/, (body) => {
        expect(body.messages[0].refusal).toBe(refusal)
        return true
      })
      .reply(200, {
        id: "chatcmpl-after-refusal-stream",
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
          content: [],
          providerMetadata:
            finishPart?.type === "finish"
              ? finishPart.providerMetadata
              : undefined,
        },
        { role: "user", content: [{ type: "text", text: "Continue" }] },
      ],
    })
    secondRequest.done()
  })

  it("keeps the original function-call arguments when they match semantically", () => {
    const rawArguments = '{ "city": "Prague" }'
    const messages = convertToolCallWithMetadata({
      args: { city: "Prague" },
      rawArguments,
    })

    expect(messages[0]).toMatchObject({
      tool_calls: [
        {
          function: { arguments: rawArguments },
        },
      ],
    })
  })

  it("does not restore original function-call arguments after they change", () => {
    const messages = convertToolCallWithMetadata({
      args: { city: "Brno" },
      rawArguments: '{ "city": "Prague" }',
    })

    expect(messages[0]).toMatchObject({
      tool_calls: [
        {
          function: { arguments: '{"city":"Brno"}' },
        },
      ],
    })
  })
})
