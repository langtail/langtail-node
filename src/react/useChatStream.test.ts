import { describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useChatStream } from "./useChatStream"
import { EventEmitter } from "stream"

class DataEventListener extends EventEmitter {
  addEventListener(event: string, listener: (...args: any[]) => void) {
    this.on(event, listener)
  }

  removeEventListener(event: string, listener: (...args: any[]) => void) {
    this.off(event, listener)
  }

  dispatchEvent(event: string, ...args: any[]) {
    this.emit(event, ...args)
  }

}

describe("useAIStream", () => {
  describe("public API", () => {
    it("should pass paramters of send() to the createReadableStream()", async () => {
      const mockedStream = new ReadableStream()

      const createReadableStream = vi.fn((parameter: string) => {
        expect(parameter).toEqual(expectedParameter)
        return Promise.resolve(mockedStream)
      })

      const expectedParameter = "hello"
      const { result } = renderHook(() => useChatStream({ fetcher: createReadableStream }))

      act(() => {
        result.current.send(expectedParameter)
      })

      await vi.waitFor(() => {
        expect(createReadableStream).toHaveBeenCalledTimes(1)
      })
    })

    it("should call createReadableStream() as many times as send() is called", async () => {
      const createReadableStream = vi.fn(() => {
        return Promise.resolve(new ReadableStream())
      })

      const { result } = renderHook(() => useChatStream({ fetcher: createReadableStream }))

      act(() => {
        result.current.send('')
        result.current.send('')
        result.current.send('')
      })

      await vi.waitFor(() => {
        expect(createReadableStream).toHaveBeenCalledTimes(3)
      })
    })

    it("should call trigger that stream was aborted when abort() is called", async () => {
      const abortAgent = vi.fn()
      function createMockReadadbleStream(dataEmitter: DataEventListener) {
        return new ReadableStream({
          start(controller) {
            dataEmitter.addEventListener('data', (data: string) => {
              controller.enqueue(data)
            })
            dataEmitter.addEventListener('close', (data: string) => {
              controller.close();
            })
          },
        });
      }

      const dataEmitter = new DataEventListener()

      const stream = createMockReadadbleStream(dataEmitter)

      const createReadableStream = vi.fn(() =>
        Promise.resolve(stream)
      )

      const { result } = renderHook(() =>
        useChatStream({
          fetcher: createReadableStream,
          onAbort: abortAgent
        }),
      )

      act(() => {
        result.current.send('user input')
        dataEmitter.dispatchEvent('data',
          `${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "hello" }, "logprobs": null, "finish_reason": null }], "usage": null })}\n
          ${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "." }, "logprobs": null, "finish_reason": "stop" }], "usage": null })}\n`
        )
        dataEmitter.dispatchEvent('close')
        result.current.abort()
      })

      await vi.waitFor(() => {
        expect(abortAgent).toHaveBeenCalledTimes(1)
      })
    })

    it("should call onError callback when an error occurs", async () => {
      const createReadableStream = vi.fn(() => {
        return Promise.reject(new Error('threw by test'))
      })

      const onError = vi.fn()


      const { result } = renderHook(() => useChatStream({ fetcher: createReadableStream, onError }))

      act(() => {
        result.current.send('')
      })

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1)
      })
    })

    describe("return values", () => {
      it("should return isLoading when request is running", async () => {
        const createReadableStream = vi.fn(() =>
          Promise.resolve(new ReadableStream())
        )

        const { result } = renderHook(() =>
          useChatStream({
            fetcher: createReadableStream,
          }),
        )

        act(() => {
          expect(result.current.isLoading).toBe(false)
          result.current.send('')
        })

        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(true)
        })
      })

      it("should return isLoading: false when request finishes", async () => {
        const createReadableStream = vi.fn(() =>
          Promise.resolve(new ReadableStream())
        )

        const { result } = renderHook(() =>
          useChatStream({
            fetcher: createReadableStream,
          }),
        )

        await act(async () => {
          expect(result.current.isLoading).toBe(false)
          result.current.send('')
          await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false)
          })
        })
      })

      it("should return and error when request fails", async () => {
        const createReadableStream = vi.fn(() => {
          return Promise.reject(new Error('threw by test'))
        })

        const { result } = renderHook(() =>
          useChatStream({
            fetcher: createReadableStream,
          }),
        )

        act(() => {
          result.current.send('')
        })

        await vi.waitFor(() => {
          expect(result.current.error?.message).toEqual('threw by test')
        })
      })

      describe("messages", () => {
        it("should fill messages with user data", async () => {
          const createReadableStream = vi.fn(() =>
            Promise.resolve(new ReadableStream())
          )

          const { result } = renderHook(() =>
            useChatStream({
              fetcher: createReadableStream,
            }),
          )

          act(() => {
            result.current.send('user input')
          })

          await vi.waitFor(() => {
            expect(result.current.messages).toEqual([{ role: 'user', content: 'user input' }])
          })
        })

        it("should add another message to the initial one", async () => {
          function createMockReadadbleStream(dataEmitter: DataEventListener) {
            return new ReadableStream({
              start(controller) {
                dataEmitter.addEventListener('data', (data: string) => {
                  controller.enqueue(data)
                  controller.close();
                })
              },
            });
          }

          const dataEmitter = new DataEventListener()

          const stream = createMockReadadbleStream(dataEmitter)

          const createReadableStream = vi.fn(() =>
            Promise.resolve(stream)
          )

          const { result } = renderHook(() =>
            useChatStream({
              fetcher: createReadableStream,
            }),
          )

          act(() => {
            result.current.send('user input')
            dataEmitter.dispatchEvent('data',
              `${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "hello" }, "logprobs": null, "finish_reason": null }], "usage": null })}\n
              ${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "." }, "logprobs": null, "finish_reason": "stop" }], "usage": null })}\n`
            )
          })

          await vi.waitFor(() => {
            expect(result.current.messages).toEqual([
              { role: 'user', content: 'user input' },
              { role: 'assistant', content: 'hello.' },
            ])
          })
        })

        it("should complete 2 messages", async () => {
          function createMockReadadbleStream(dataEmitter: DataEventListener) {
            return new ReadableStream({
              start(controller) {
                dataEmitter.addEventListener('data', (data: string) => {
                  controller.enqueue(data)
                })
                dataEmitter.addEventListener('close', (data: string) => {
                  controller.close();
                })
              },
            });
          }

          const dataEmitter = new DataEventListener()

          const stream = createMockReadadbleStream(dataEmitter)

          const createReadableStream = vi.fn(() =>
            Promise.resolve(stream)
          )

          const { result } = renderHook(() =>
            useChatStream({
              fetcher: createReadableStream,
            }),
          )

          act(() => {
            result.current.send('user input')
            dataEmitter.dispatchEvent('data',
              `${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "hello" }, "logprobs": null, "finish_reason": null }], "usage": null })}\n
              ${JSON.stringify({ "id": "chatcmpl-9a0ckk5rq36dtBFE2ail2G2AZbk9s", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "!" }, "logprobs": null, "finish_reason": 'stop' }], "usage": null })}\n`
            )
            dataEmitter.dispatchEvent('data',
              `${JSON.stringify({ "id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": " And this " }, "logprobs": null, "finish_reason": null }], "usage": null })}\n
              ${JSON.stringify({ "id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": "is my" }, "logprobs": null, "finish_reason": null }], "usage": null })}\n
              ${JSON.stringify({ "id": "chatcmpl-123", "object": "chat.completion.chunk", "created": 1718369234, "model": "gpt-4o-2024-05-13", "system_fingerprint": "fp_319be4768e", "choices": [{ "index": 0, "delta": { "role": "assistant", "content": " end." }, "logprobs": null, "finish_reason": 'stop' }], "usage": null })}\n`
            )

            dataEmitter.dispatchEvent('close')
          })

          await vi.waitFor(() => {
            expect(result.current.messages).toEqual([
              { role: 'user', content: 'user input' },
              { role: 'assistant', content: 'hello!' },
              { role: 'assistant', content: ' And this is my end.' },
            ])
          })
        })

        it("should return message with a tool call", async () => {
          function createMockReadadbleStream(dataEmitter: DataEventListener) {
            return new ReadableStream({
              start(controller) {
                dataEmitter.addEventListener('data', (data: string) => {
                  controller.enqueue(data)
                  controller.close();
                })
              },
            });
          }

          const dataEmitter = new DataEventListener()

          const stream = createMockReadadbleStream(dataEmitter)

          const createReadableStream = vi.fn(() =>
            Promise.resolve(stream)
          )

          const { result } = renderHook(() =>
            useChatStream({
              fetcher: createReadableStream,
            }),
          )

          act(() => {
            result.current.send('user input')
            dataEmitter.dispatchEvent('data',
              `{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":"Understood, I will get the current weather for Prague, Czech Republic."},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0, "id":"call_tNW2f79DhRvuuwrslSYt3yVT", "type": "function", "function":{"name":"get_weather", "arguments":"{\\"location\\":\\"Prague, Czech Republic\\"}"}}]},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[],"usage":{"prompt_tokens":284,"completion_tokens":34,"total_tokens":318}}\n\n`
            )
          })

          await vi.waitFor(() => {
            expect(result.current.messages).toEqual([
              { role: 'user', content: 'user input' },
              {
                "content": "Understood, I will get the current weather for Prague, Czech Republic.",
                "role": "assistant",
                "tool_calls": [
                  {
                    "function": {
                      "arguments": "{\"location\":\"Prague, Czech Republic\"}",
                      "name": "get_weather",
                    },
                    "id": "call_tNW2f79DhRvuuwrslSYt3yVT",
                    "type": "function",
                  },
                ]
              },
            ])
          })
        })
      })
    })

    describe('too calls', () => {
      it.only("should trigger a tool call", async () => {
        function createMockReadadbleStream(dataEmitter: DataEventListener) {
          return new ReadableStream({
            start(controller) {
              dataEmitter.addEventListener('data', (data: string) => {
                controller.enqueue(data)
              })
              dataEmitter.addEventListener('close', (data: string) => {
                controller.close();
              })
            },
          });
        }

        const dataEmitter = new DataEventListener()

        const stream = createMockReadadbleStream(dataEmitter)

        let ran = false
        const createReadableStream = vi.fn(() => {
          // NOTE: run this only once
          if (ran) {
            return Promise.reject('Error in tools!')
          }

          ran = true
          return Promise.resolve(stream)
        }
        )

        const onToolCall = vi.fn(() => Promise.reject('Error in tools!'))

        const { result } = renderHook(() =>
          useChatStream({
            fetcher: createReadableStream,
            onToolCall
          }),
        )

        act(() => {
          result.current.send('user input')
          dataEmitter.dispatchEvent('data',
            `{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":"Under"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":"stood"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":","},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" I"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" will"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" get"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" the"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" current"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" weather"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" for"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" Prague"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":","},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" Czech"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":" Republic"},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":"."},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0, "id":"call_tNW2f79DhRvuuwrslSYt3yVT","type":"function", "function":{ "name": "get_weather", "arguments":"{\\""}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"location"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\""}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Pr"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ague"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":","}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Czech"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":" Republic"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"}"}}]},"logprobs":null,"finish_reason":null}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}],"usage":null}
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[],"usage":{"prompt_tokens":284,"completion_tokens":34,"total_tokens":318}}
`)
          dataEmitter.dispatchEvent('close')
        })

        await vi.waitFor(() => {
          expect(onToolCall).toBeCalledWith(
            {
              "function": {
                "arguments": "{\"location\":\"Prague, Czech Republic\"}",
                "name": "get_weather",
              },
              "id": "call_tNW2f79DhRvuuwrslSYt3yVT",
              "type": "function",
            },
            {
              "content": "Understood, I will get the current weather for Prague, Czech Republic.",
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{\"location\":\"Prague, Czech Republic\"}",
                    "name": "get_weather",
                  },
                  "id": "call_tNW2f79DhRvuuwrslSYt3yVT",
                  "type": "function",
                },
              ],
            }
          )
          result.current.abort()
        })
      })

      it("should pass tool call result to the messages", async () => {
        function createMockReadadbleStream(dataEmitter: DataEventListener) {
          return new ReadableStream({
            start(controller) {
              dataEmitter.addEventListener('data', (data: string) => {
                controller.enqueue(data)
                controller.close();
              })
            },
          });
        }

        const dataEmitter = new DataEventListener()

        const stream = createMockReadadbleStream(dataEmitter)

        const createReadableStream = vi.fn(() =>
          Promise.resolve(stream)
        )

        const onToolCall = () => Promise.resolve('Result in test')

        const { result } = renderHook(() =>
          useChatStream({
            fetcher: createReadableStream,
            onToolCall
          }),
        )

        act(() => {
          result.current.send('user input')
          dataEmitter.dispatchEvent('data',
            `{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"role":"assistant","content":"U"},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"content":"nderstood, I will get the current weather for Prague, Czech Republic."},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{"tool_calls":[{"index":0, "id":"call_tNW2f79DhRvuuwrslSYt3yVT", "type": "function", "function":{"name":"get_weather", "arguments":"{\\"location\\":\\"Prague, Czech Republic\\"}"}}]},"logprobs":null,"finish_reason":null}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"tool_calls"}],"usage":null}\n
{"id":"chatcmpl-9aJwNzlnvn1jG845CJe2QZH6AKcow","object":"chat.completion.chunk","created":1718443487,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_319be4768e","choices":[],"usage":{"prompt_tokens":284,"completion_tokens":34,"total_tokens":318}}\n\n`
          )
        })

        await vi.waitFor(() => {
          expect(result.current.messages).toEqual([
            { role: 'user', content: 'user input' },
            {
              "content": "Understood, I will get the current weather for Prague, Czech Republic.",
              "role": "assistant",
              "tool_calls": [
                {
                  "function": {
                    "arguments": "{\"location\":\"Prague, Czech Republic\"}",
                    "name": "get_weather",
                  },
                  "id": "call_tNW2f79DhRvuuwrslSYt3yVT",
                  "type": "function",
                },
              ]
            },
            {
              "content": "Result in test",
              "role": "tool",
              "tool_call_id": "call_tNW2f79DhRvuuwrslSYt3yVT",
            }
          ])
        })
      })
    })
  })
})
