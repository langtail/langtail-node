import { LangtailNode, baseURL } from "./LangtailNode"
import "dotenv/config"
import { describe, expect, it } from "vitest"
import nock from "nock"
import { openAIStreamingResponseSchema } from "./dataSchema"

const lt = new LangtailNode()

describe("LangtailNode", () => {
  it("should support streaming", async () => {
    const proxyCompletion = await lt.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the weather like?" },
      ],
      stream: true,
      model: "gpt-3.5-turbo",

      metadata: {
        "custom-field": 1,
      },
    })
    let partCount = 0
    for await (const part of proxyCompletion) {
      partCount++

      openAIStreamingResponseSchema.parse(part)
    }

    expect(partCount > 1).toBe(true)
  })

  it("should not record", async () => {
    nock(baseURL)
      .post("/chat/completions")
      .reply(200, function (uri, req) {
        expect(this.req.headers["x-langtail-do-not-record"][0]).toBe("true")
      })
    await lt.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the weather like?" },
      ],

      model: "gpt-3.5-turbo",
      doNotRecord: true,
    })
    // if we had some API for logs we could assert on that too
  })
})
