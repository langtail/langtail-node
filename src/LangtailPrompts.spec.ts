import "dotenv/config"
import { describe, expect, it } from "vitest"
import nock from "nock"
import { LangtailPrompts } from "./LangtailPrompts"
import { openAIStreamingResponseSchema } from "./dataSchema"
import { MockAgent } from "undici"

const lt = new LangtailPrompts({
  apiKey: process.env.LANGTAIL_API_KEY!,
})

const prompt = "short-story-teller"

describe(
  "LangtailPrompts",
  () => {
    it("should support a simple prompt with variables", async () => {
      const completion = await lt.invoke({
        prompt,
        environment: "staging",
        variables: {
          about: "cowboy Bebop",
        },
      })

      expect(completion.choices[0].message.content?.includes("Bebop")).toBe(
        true,
      )
      expect(completion.choices.length).toBeGreaterThan(0)
      expect(completion.httpResponse.status).toBe(200)
    })

    it("should make a single request with variables using the project-prompt path", async () => {
      const completion = await lt.invoke({
        prompt: "short-story-teller",
        environment: "staging",
        variables: {
          about: "Aragorn",
        },
      })

      expect(completion.choices[0].message.content?.includes("Aragorn")).toBe(
        true,
      )
      expect(completion.choices.length).toBeGreaterThan(0)
      expect(completion.httpResponse.status).toBe(200)
    })

    it("should support streaming", async () => {
      const proxyCompletion = await lt.invoke({
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
      //full deployed prompt path "do-not-delete-api-key-used-on-ci-iSNqij/ci-tests-project/short-story-teller/staging"
      const ltWithProject = new LangtailPrompts({
        apiKey: process.env.LANGTAIL_API_KEY!,
        workspace: "do-not-delete-api-key-used-on-ci-iSNqij",
        project: "ci-tests-project",
        fetch: async (url, init) => {
          expect(init?.headers?.["x-langtail-do-not-record"]).toBe("true")

          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: "This is a test",
                  },
                },
              ],
            }),
          } as any
        },
      })

      const agent = new MockAgent()
      agent.disableNetConnect()

      const res = await ltWithProject.invoke({
        prompt,
        environment: "staging",
        variables: {
          about: "napoleon",
        },
        doNotRecord: true,
      })

      expect(res.httpResponse.status).toBe(200)
      // TODO when we have some API for logs we could assert on that too that the log record does not have any payload
    })
  },
  { timeout: 20000 },
)
