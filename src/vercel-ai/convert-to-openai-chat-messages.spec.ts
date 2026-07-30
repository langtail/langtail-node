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
