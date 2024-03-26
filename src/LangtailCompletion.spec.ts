import "dotenv/config"
import { describe, expect, it } from "vitest"
import nock from "nock"
import { LangtailCompletion } from "./LangtailCompletion"
import { openAIStreamingResponseSchema } from "./dataSchema"

const lt = new LangtailCompletion({
  apiKey: process.env.LANGTAIL_API_KEY!,
})
const prompt = 'do-not-delete-api-key-used-on-ci-iSNqij/ci-tests-project/short-story-teller'
describe(
  "LangtailCompletion",
  () => {
    it("should support a simple prompt with variables", async () => {
      const completion = await lt.request({
        prompt,
        environment: "staging",
        variables: {
          about: "cowboy Bebop",
        },
      })

      expect(completion.choices[0].message.content?.includes("Bebop")).toBe(true)
      expect(completion.choices.length).toBeGreaterThan(0)
      expect(completion.httpResponse.status).toBe(200)
    })

    it("should support streaming", async () => {
      const proxyCompletion = await lt.request({
        prompt,
        environment: "staging",
        variables: {
          about: "napoleon",
        },
        stream: true,
      })
      let partCount = 0
      for await (const part of proxyCompletion) {
        partCount++

        openAIStreamingResponseSchema.parse(part)
      }

      expect(partCount > 1).toBe(true)
    })

    it("should not record", async () => {
      nock(lt.baseUrl)
        .post("/formpilot-Iwwc-q/capajs-project/bbb/staging")
        .reply(200, function (uri, req) {
          expect(this.req.headers["x-langtail-do-not-record"][0]).toBe("true")
        })
      await lt.request({
        prompt,
        environment: "staging",
        variables: {
          about: "napoleon",
        },
      })
      // if we had some API for logs we could assert on that too
    })
  },
  { timeout: 20000 },
)
