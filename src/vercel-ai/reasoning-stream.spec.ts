import { afterAll, beforeAll, describe, expect, it } from "vitest"
import nock from "nock"
import { LangtailPrompts } from "../LangtailPrompts"
import { ReasoningDetailType } from "../reasoning-details-schema"
import { LangtailChatLanguageModel } from "./langtail-language-model"
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

describe("Reasoning stream", () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
    nock.cleanAll()
  })

  it("emits reasoning text before the signature when both arrive in the same reasoning detail", async () => {
    const scope = nock(BASE_URL)
      .post(/\/project-prompt\/test-prompt\/production/)
      .reply(
        200,
        createSSEResponse([
          {
            id: "chatcmpl-test",
            choices: [
              {
                index: 0,
                delta: {
                  reasoning_details: [
                    {
                      type: ReasoningDetailType.Text,
                      signature: "sig-1",
                      text: "thinking",
                    },
                  ],
                },
              },
            ],
          },
          {
            id: "chatcmpl-test",
            choices: [{ index: 0, delta: { content: "done" } }],
          },
          {
            id: "chatcmpl-test",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          },
        ]),
        { "content-type": "text/event-stream" },
      )

    const model = createModel()
    const { stream } = await model.doStream(defaultCallOptions)
    const parts = await collectStreamParts(stream)

    expect(
      parts.filter(
        (part) =>
          part.type === "reasoning" || part.type === "reasoning-signature",
      ),
    ).toEqual([
      { type: "reasoning", textDelta: "thinking" },
      { type: "reasoning-signature", signature: "sig-1" },
    ])

    const finishPart = parts.find((part) => part.type === "finish")
    expect(finishPart).toMatchObject({
      type: "finish",
      providerMetadata: {
        langtail: {
          reasoning_details: [
            {
              type: ReasoningDetailType.Text,
              signature: "sig-1",
              text: "thinking",
            },
          ],
        },
      },
    })
    scope.done()
  })
})
