import "dotenv/config"
import { describe, expect, it } from "vitest"

import { LangtailPrompts } from "./LangtailPrompts"
import { openAIStreamingResponseSchema } from "./dataSchema"

const lt = new LangtailPrompts({
  apiKey: process.env.LANGTAIL_API_KEY!,
})

const prompt = "short-story-teller"

describe(
  "LangtailPrompts",
  () => {
    describe("createPromptPath", () => {
      it("should return the correct path for project prompt", () => {
        const path = lt._createPromptPath({
          prompt: "prompt",
          environment: "preview",
          version: "6vy19bmp",
        })

        expect(path).toBe(
          "https://api.langtail.com/project-prompt/prompt/preview?v=6vy19bmp",
        )
      })

      it("staging with no version parameter", () => {
        const path = lt._createPromptPath({
          prompt: "prompt",
          environment: "staging",
        })

        expect(path).toBe(
          "https://api.langtail.com/project-prompt/prompt/staging",
        )
      })

      it("should return the correct path when workspace and project are provided", () => {
        const ltProject = new LangtailPrompts({
          apiKey: process.env.LANGTAIL_API_KEY!,
          project: "ci-tests-project",
          workspace: "some-workspace",
        })

        const path = ltProject._createPromptPath({
          prompt: "prompt",
          environment: "preview",
          version: "6vy19bmp",
        })

        expect(path).toBe(
          "https://api.langtail.com/some-workspace/ci-tests-project/prompt/preview?v=6vy19bmp",
        )

        const pathForPromptConfig = ltProject._createPromptPath({
          prompt: "prompt",
          environment: "preview",
          version: "6vy19bmp",
          configGet: true,
        })

        expect(pathForPromptConfig).toBe(
          "https://api.langtail.com/some-workspace/ci-tests-project/prompt/preview?open-ai-completion-config-payload=true&v=6vy19bmp",
        )
      })
    })

    describe("invoke", () => {
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
            expect(init?.headers?.["x-langtail-metadata-custom-field"]).toBe(1)

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

        const res = await ltWithProject.invoke({
          prompt,
          environment: "staging",
          variables: {
            about: "napoleon",
          },
          doNotRecord: true,
          metadata: {
            "custom-field": 1,
          },
        })

        expect(res.httpResponse.status).toBe(200)
        // TODO when we have some API for logs we could assert on that too that the log record does not have any payload
      })
    })

    describe("build", () => {
      const ltLocal = new LangtailPrompts({
        // baseURL: "https://api-staging.langtail.com",
        apiKey: process.env.LANGTAIL_API_KEY!,
      })

      it("should return the openAI body user can use with openai client", async () => {
        const playgroundState = await ltLocal.get({
          prompt: "optional-var-test",
          environment: "preview",
          version: "c8hrwdiz",
        })
        expect(playgroundState).toMatchInlineSnapshot(`
          {
            "chatInput": {
              "optionalExtra": "",
            },
            "state": {
              "args": {
                "frequency_penalty": 0,
                "jsonmode": false,
                "max_tokens": 800,
                "model": "gpt-3.5-turbo",
                "presence_penalty": 0,
                "stop": [],
                "stream": true,
                "temperature": 0.5,
                "top_p": 1,
              },
              "functions": [],
              "template": [
                {
                  "content": "I want you to act as a storyteller. Be SUPER concise.

          {{optionalExtra}}",
                  "role": "system",
                },
              ],
              "tools": [],
              "type": "chat",
            },
          }
        `)

        const openAiBody = ltLocal.build(playgroundState, {
          stream: true,
          variables: {
            optionalExtra: "This is an optional extra",
          },
          
        })

        expect(openAiBody).toMatchInlineSnapshot(`
          {
            "frequency_penalty": 0,
            "max_tokens": 800,
            "messages": [
              {
                "content": "I want you to act as a storyteller. Be SUPER concise.

          This is an optional extra",
                "role": "system",
              },
            ],
            "model": "gpt-3.5-turbo",
            "presence_penalty": 0,
            "stop": [],
            "temperature": 0.5,
            "top_p": 1,
          }
        `)
      })
    })
  },
  { timeout: 20000 },
)
