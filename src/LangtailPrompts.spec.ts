import "dotenv-flow/config"
import { describe, expect, it } from "vitest"

import { LangtailPrompts } from "./LangtailPrompts"
import { ChatCompletionChunkSchema } from "./dataSchema"
import { getOpenAIBody } from "./getOpenAIBody"

const lt = new LangtailPrompts({
  apiKey: process.env.LANGTAIL_API_KEY!,
})

const prompt = "short-story-teller"

const liveTesting = process.env.TEST_LIVE === "true"

describe.skipIf(!liveTesting)(
  "LangtailPrompts",
  () => {
    describe("createPromptPath", () => {
      it("should return the correct path for project prompt", () => {
        const path = lt.createPromptPath({
          prompt: "prompt",
          environment: "preview",
          version: "6vy19bmp",
        })

        expect(path).toBe(
          "https://api.langtail.com/project-prompt/prompt/preview?v=6vy19bmp",
        )
      })

      it("staging with no version parameter", () => {
        const path = lt.createPromptPath({
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

        const path = ltProject.createPromptPath({
          prompt: "prompt",
          environment: "preview",
          version: "6vy19bmp",
        })

        expect(path).toBe(
          "https://api.langtail.com/some-workspace/ci-tests-project/prompt/preview?v=6vy19bmp",
        )

        const pathForPromptConfig = ltProject.createPromptPath({
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

          ChatCompletionChunkSchema.parse(part)
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
              headers: new Headers({}),
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

        const openAiBody = getOpenAIBody(playgroundState, {
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
            "temperature": 0.5,
            "top_p": 1,
          }
        `)
      })
    })
  },
  { timeout: 20000 },
)

describe("LangtailPrompts", () => {
  describe("invoke with optional callbacks", () => {

    it("should pass parallel_tool_calls param to fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test response",
              },
            },
          ],
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
          'x-langtail-thread-id': 'test-thread-id'
        }),
      });

      const lt = new LangtailPrompts({
        apiKey: "test-api-key",
        fetch: mockFetch,
      });

      await lt.invoke({
        prompt: "test-prompt",
        environment: "production",
        parallelToolCalls: true,
      });

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toHaveProperty('parallelToolCalls', true);
    });
    it("should trigger onRawResponse callback when response is returned", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test response",
              },
            },
          ],
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
          'x-langtail-thread-id': 'test-thread-id'
        }),
      });

      const lt = new LangtailPrompts({
        apiKey: "test-api-key",
        fetch: mockFetch,
      });

      const onRawResponse = vi.fn();

      await lt.invoke({
        prompt: "test-prompt",
        environment: "production",
      }, { onRawResponse });

      expect(mockFetch).toHaveBeenCalled();
      expect(onRawResponse).toHaveBeenCalledTimes(1);
      expect(onRawResponse).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        status: 200,
      }));
    });

    it("should trigger onThreadId callback when thread ID is present in headers", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test response",
              },
            },
          ],
        }),
        headers: new Headers({
          'x-langtail-thread-id': 'test-thread-id'
        }),
      });

      const lt = new LangtailPrompts({
        apiKey: "test-api-key",
        fetch: mockFetch,
      });

      const onThreadId = vi.fn();

      await lt.invoke({
        prompt: "test-prompt",
        environment: "production",
      }, { onThreadId });

      expect(mockFetch).toHaveBeenCalled();
      expect(onThreadId).toHaveBeenCalledTimes(1);
      expect(onThreadId).toHaveBeenCalledWith('test-thread-id');
    });

    it("should trigger both onThreadId and onRawResponse callbacks with the same headers", async () => {
      const testHeaders = new Headers({
        'x-langtail-thread-id': 'test-thread-id',
        'content-type': 'application/json'
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Test response",
              },
            },
          ],
        }),
        headers: testHeaders,
      });

      const lt = new LangtailPrompts({
        apiKey: "test-api-key",
        fetch: mockFetch,
      });

      const onThreadId = vi.fn();
      const onRawResponse = vi.fn();

      await lt.invoke({
        prompt: "test-prompt",
        environment: "production",
      }, { onThreadId, onRawResponse });

      expect(mockFetch).toHaveBeenCalled();
      expect(onThreadId).toHaveBeenCalledTimes(1);
      expect(onThreadId).toHaveBeenCalledWith('test-thread-id');
      expect(onRawResponse).toHaveBeenCalledTimes(1);
      expect(onRawResponse).toHaveBeenCalledWith(expect.objectContaining({
        headers: testHeaders
      }));

      // Verify that the headers in onRawResponse match the original headers
      const rawResponseHeaders = onRawResponse.mock.calls[0][0].headers;
      expect(rawResponseHeaders.get('x-langtail-thread-id')).toBe('test-thread-id');
    });
  })
})
