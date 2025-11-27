import { describe, expect, it } from "vitest"
import { convertToOpenAIChatMessages } from "./convert-to-openai-chat-messages"
import type { LanguageModelV2Prompt } from "@ai-sdk/provider"

describe("convertToOpenAIChatMessages", () => {
  describe("system messages", () => {
    it("should convert a simple system message", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "system", content: "You are a helpful assistant." },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result).toEqual([
        { role: "system", content: "You are a helpful assistant." },
      ])
    })

    it("should add cache_enabled for anthropic cache control", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "system",
          content: "You are a helpful assistant.",
          providerOptions: { anthropic: { cacheControl: true } },
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toHaveProperty("cache_enabled", true)
    })
  })

  describe("user messages", () => {
    it("should convert a simple text user message", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "user", content: [{ type: "text", text: "Hello!" }] },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result).toEqual([{ role: "user", content: "Hello!" }])
    })

    it("should convert user message with image file part", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "file",
              data: "https://example.com/image.png",
              mediaType: "image/png",
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What's in this image?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png", detail: undefined },
          },
        ],
      })
    })
  })

  describe("assistant messages with reasoning", () => {
    it("should convert assistant message with basic reasoning parts", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Let me think about this..." },
            { type: "text", text: "The answer is 42." },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "assistant",
        content: "The answer is 42.",
        reasoning: [{ type: "text", text: "Let me think about this..." }],
        reasoning_details: undefined,
        tool_calls: undefined,
      })
    })

    it("should preserve reasoning with signature from providerOptions (Anthropic format)", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Let me think about this..." },
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "weather",
              input: { location: "Tokyo" },
            },
          ],
          providerOptions: {
            langtail: {
              reasoning: [
                {
                  type: "text",
                  text: "Let me think about this...",
                  signature: "EtcCCkYI...",
                },
              ],
            },
          },
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "assistant",
        reasoning: [
          {
            type: "text",
            text: "Let me think about this...",
            signature: "EtcCCkYI...",
          },
        ],
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: { name: "weather", arguments: '{"location":"Tokyo"}' },
          },
        ],
      })
    })

    it("should preserve reasoning with signature from tool-call providerOptions", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Thinking..." },
            {
              type: "tool-call",
              toolCallId: "call_456",
              toolName: "search",
              input: { query: "test" },
              providerOptions: {
                langtail: {
                  reasoning: [
                    {
                      type: "text",
                      text: "Thinking...",
                      signature: "sig456",
                    },
                  ],
                },
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "assistant",
        reasoning: [
          { type: "text", text: "Thinking...", signature: "sig456" },
        ],
      })
    })

    it("should preserve reasoning_details from providerOptions (OpenRouter format)", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Step by step reasoning" },
            {
              type: "tool-call",
              toolCallId: "call_789",
              toolName: "calculate",
              input: { expression: "2+2" },
            },
          ],
          providerOptions: {
            langtail: {
              reasoning_details: [
                {
                  type: "reasoning.text",
                  text: "Step by step reasoning",
                  signature: "openrouter_sig",
                },
              ],
            },
          },
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "assistant",
        reasoning_details: [
          {
            type: "reasoning.text",
            text: "Step by step reasoning",
            signature: "openrouter_sig",
          },
        ],
      })
    })

    it("should preserve both reasoning and reasoning_details when both present", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "My thinking" },
            {
              type: "tool-call",
              toolCallId: "call_abc",
              toolName: "api",
              input: {},
            },
          ],
          providerOptions: {
            langtail: {
              reasoning: [
                { type: "text", text: "My thinking", signature: "anthro_sig" },
              ],
              reasoning_details: [
                { type: "reasoning.text", text: "My thinking", signature: "or_sig" },
              ],
            },
          },
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "assistant",
        reasoning: [
          { type: "text", text: "My thinking", signature: "anthro_sig" },
        ],
        reasoning_details: [
          { type: "reasoning.text", text: "My thinking", signature: "or_sig" },
        ],
      })
    })

    it("should handle tool calls with string input", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_str",
              toolName: "func",
              input: '{"already":"stringified"}',
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "assistant",
        tool_calls: [
          {
            id: "call_str",
            type: "function",
            function: {
              name: "func",
              arguments: '{"already":"stringified"}',
            },
          },
        ],
      })
    })
  })

  describe("tool messages", () => {
    it("should convert tool result with text output", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_123",
              toolName: "weather",
              output: { type: "text", value: "Sunny, 25°C" },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "tool",
        tool_call_id: "call_123",
        content: "Sunny, 25°C",
      })
    })

    it("should convert tool result with JSON output", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_456",
              toolName: "api",
              output: {
                type: "json",
                value: { temperature: 25, condition: "sunny" },
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "tool",
        tool_call_id: "call_456",
        content: '{"temperature":25,"condition":"sunny"}',
      })
    })

    it("should convert tool result with content containing image URL", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_img",
              toolName: "image_gen",
              output: {
                type: "content",
                value: [
                  { type: "text", text: "Here's the image:" },
                  {
                    type: "media",
                    data: "https://example.com/image.png",
                    mediaType: "image/png",
                  },
                ],
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "tool",
        tool_call_id: "call_img",
        content: [
          { type: "text", text: "Here's the image:" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/image.png" },
          },
        ],
      })
    })

    it("should convert tool result with content containing base64 image", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_b64",
              toolName: "screenshot",
              output: {
                type: "content",
                value: [
                  {
                    type: "media",
                    data: "iVBORw0KGgoAAAANSUhEUg==",
                    mediaType: "image/png",
                  },
                ],
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "tool",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            },
          },
        ],
      })
    })

    it("should pass through data URLs unchanged", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_data",
              toolName: "gen",
              output: {
                type: "content",
                value: [
                  {
                    type: "media",
                    data: "data:image/png;base64,abc123",
                    mediaType: "image/png",
                  },
                ],
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toMatchObject({
        role: "tool",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,abc123" },
          },
        ],
      })
    })

    it("should convert error-text output", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_err",
              toolName: "api",
              output: { type: "error-text", value: "Connection failed" },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "tool",
        tool_call_id: "call_err",
        content: "Connection failed",
      })
    })

    it("should convert error-json output", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_err_json",
              toolName: "api",
              output: {
                type: "error-json",
                value: { code: 500, message: "Internal error" },
              },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      expect(result[0]).toEqual({
        role: "tool",
        tool_call_id: "call_err_json",
        content: '{"code":500,"message":"Internal error"}',
      })
    })
  })

  describe("full conversation flow with reasoning preservation", () => {
    it("should preserve Anthropic reasoning signature through multi-turn conversation", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "system", content: "You are a helpful weather assistant." },
        { role: "user", content: [{ type: "text", text: "What's the weather in Tokyo?" }] },
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "User wants weather for Tokyo..." },
            {
              type: "tool-call",
              toolCallId: "toolu_01ABC",
              toolName: "weather",
              input: { location: "Tokyo" },
              providerOptions: {
                langtail: {
                  reasoning: [
                    {
                      type: "text",
                      text: "User wants weather for Tokyo...",
                      signature: "EtcCCkYIChgCKkDqzqkY...",
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "toolu_01ABC",
              toolName: "weather",
              output: { type: "json", value: { temperature: 22, condition: "cloudy" } },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      // Verify the assistant message has the signature preserved
      const assistantMessage = result.find((m) => m.role === "assistant")
      expect(assistantMessage).toMatchObject({
        role: "assistant",
        reasoning: [
          {
            type: "text",
            text: "User wants weather for Tokyo...",
            signature: "EtcCCkYIChgCKkDqzqkY...",
          },
        ],
        tool_calls: [
          {
            id: "toolu_01ABC",
            type: "function",
            function: { name: "weather", arguments: '{"location":"Tokyo"}' },
          },
        ],
      })

      // Verify the tool result is properly converted
      const toolMessage = result.find((m) => m.role === "tool")
      expect(toolMessage).toEqual({
        role: "tool",
        tool_call_id: "toolu_01ABC",
        content: '{"temperature":22,"condition":"cloudy"}',
      })
    })

    it("should preserve OpenRouter reasoning_details through multi-turn conversation", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "user", content: [{ type: "text", text: "What's the weather?" }] },
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Analyzing weather request..." },
            {
              type: "tool-call",
              toolCallId: "gen-123",
              toolName: "get_weather",
              input: { city: "NYC" },
              providerOptions: {
                langtail: {
                  reasoning_details: [
                    {
                      type: "reasoning.text",
                      text: "Analyzing weather request...",
                      signature: "sha256:abc123",
                      id: "reasoning-1",
                      format: "anthropic-claude-v1",
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "gen-123",
              toolName: "get_weather",
              output: { type: "text", value: "Sunny, 75°F" },
            },
          ],
        },
      ]

      const result = convertToOpenAIChatMessages({ prompt })

      const assistantMessage = result.find((m) => m.role === "assistant")
      expect(assistantMessage).toMatchObject({
        role: "assistant",
        reasoning_details: [
          {
            type: "reasoning.text",
            text: "Analyzing weather request...",
            signature: "sha256:abc123",
            id: "reasoning-1",
            format: "anthropic-claude-v1",
          },
        ],
      })
    })
  })
})

