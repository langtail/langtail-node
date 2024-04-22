import { describe, expect, it } from "vitest"

import { getOpenAIBody } from "./getOpenAIBody"

describe("getOpenAIBody", () => {
  const parsedBody = {
    variables: {},
    messages: [],
  }

  it("should return the expected openAIbody", () => {
    const expectedOpenAIbody = {
      model: "gpt-3.5-turbo",
      max_tokens: 100,
      temperature: 0.8,
      messages: [],
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
    }

    const openAIbody = getOpenAIBody(
      {
        state: {
          type: "chat",
          args: {
            model: "gpt-3.5-turbo",
            max_tokens: 100,
            temperature: 0.8,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            jsonmode: false,
            seed: null,
            stop: [],
          },
          template: [],
        },
        chatInput: {},
        chatPlaygroundHistory: [],
      },
      parsedBody,
    )

    expect(openAIbody).toEqual(expectedOpenAIbody)
  })
})
