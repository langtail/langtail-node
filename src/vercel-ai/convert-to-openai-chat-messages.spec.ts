import { describe, expect, it } from "vitest"
import type { LanguageModelV1Prompt } from "@ai-sdk/provider"
import { convertToOpenAIChatMessages } from "./convert-to-openai-chat-messages"

describe("convertToOpenAIChatMessages explicit prompt caching", () => {
  it("converts a marked system string to a text content block", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "system",
        content: "Stable instructions",
        providerMetadata: {
          openai: {
            promptCacheBreakpoint: { mode: "explicit" },
          },
        },
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "system",
        content: [
          {
            type: "text",
            text: "Stable instructions",
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      },
    ])
  })

  it("marks only the final text or image block in a multipart user message", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image" },
          {
            type: "image",
            image: new URL("https://example.com/image.png"),
            mimeType: "image/png",
          },
        ],
        providerMetadata: {
          openai: {
            promptCacheBreakpoint: { mode: "explicit" },
          },
        },
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image",
          },
          {
            type: "image_url",
            image_url: {
              url: "https://example.com/image.png",
            },
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      },
    ])
  })

  it("marks assistant content while preserving tool calls", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "I will check both sources." },
          {
            type: "tool-call",
            toolCallId: "call-weather",
            toolName: "weather",
            args: { city: "Prague" },
          },
        ],
        providerMetadata: {
          openai: {
            promptCacheBreakpoint: { mode: "explicit" },
          },
        },
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I will check both sources.",
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
        tool_calls: [
          {
            id: "call-weather",
            type: "function",
            function: {
              name: "weather",
              arguments: '{"city":"Prague"}',
            },
          },
        ],
      },
    ])
  })

  it("marks only the final emitted tool message", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-weather",
            toolName: "weather",
            result: { temperature: 25 },
          },
          {
            type: "tool-result",
            toolCallId: "call-time",
            toolName: "time",
            result: { time: "21:15" },
          },
        ],
        providerMetadata: {
          openai: {
            promptCacheBreakpoint: { mode: "explicit" },
          },
        },
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "tool",
        tool_call_id: "call-weather",
        content: '{"temperature":25}',
      },
      {
        role: "tool",
        tool_call_id: "call-time",
        content: [
          {
            type: "text",
            text: '{"time":"21:15"}',
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      },
    ])
  })

  it("marks the final block of rich tool content", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-map",
            toolName: "map",
            result: [
              { type: "text", text: "Map result" },
              {
                type: "image_url",
                image_url: { url: "https://example.com/map.png" },
              },
            ],
          },
        ],
        providerMetadata: {
          openai: {
            promptCacheBreakpoint: { mode: "explicit" },
          },
        },
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "tool",
        tool_call_id: "call-map",
        content: [
          { type: "text", text: "Map result" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/map.png" },
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      },
    ])
  })

  it("leaves unmarked content and Anthropic cache control unchanged", () => {
    const prompt: LanguageModelV1Prompt = [
      {
        role: "system",
        content: "Cached by Anthropic",
        providerMetadata: {
          anthropic: {
            cacheControl: { type: "ephemeral", ttl: "1h" },
          },
        },
      },
      {
        role: "user",
        content: [{ type: "text", text: "Unmarked OpenAI message" }],
      },
    ]

    expect(convertToOpenAIChatMessages({ prompt })).toEqual([
      {
        role: "system",
        content: "Cached by Anthropic",
        cache_enabled: true,
        cache_ttl: "1h",
      },
      {
        role: "user",
        content: "Unmarked OpenAI message",
      },
    ])
  })
})
