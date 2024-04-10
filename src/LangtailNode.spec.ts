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
      doNotRecord: false,
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

  it("should not record", async (t) => {
    nock(baseURL) // nock works by intercepting requests at the network level, if open AI switches to undici we will need to intercept differently
      .post("/chat/completions")
      .reply(200, function (uri, req) {
        expect(this.req.headers["x-langtail-do-not-record"][0]).toBe("true")
        expect(this.req.headers["x-langtail-metadata-custom-field"][0]).toBe(
          "1",
        )

        // check that body has no metadata or doNotRecord
        expect(req).toMatchInlineSnapshot(`
          {
            "messages": [
              {
                "content": "You are a helpful assistant.",
                "role": "system",
              },
              {
                "content": "What is the weather like?",
                "role": "user",
              },
            ],
            "model": "gpt-3.5-turbo",
          }
        `)
      })
    await lt.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the weather like?" },
      ],

      model: "gpt-3.5-turbo",
      doNotRecord: true,
      metadata: {
        "custom-field": 1,
      },
    })

    expect(nock.pendingMocks()).toEqual([])
    // if we had some API for logs we could assert on that too
  })
})
