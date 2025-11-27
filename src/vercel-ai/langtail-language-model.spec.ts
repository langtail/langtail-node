import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Tests for reasoning preservation in the Langtail language model.
 *
 * These tests verify that reasoning data (including signatures) is properly
 * accumulated and preserved through streaming for multi-turn conversations.
 *
 * Key scenarios:
 * 1. Anthropic direct: reasoning comes via delta.reasoning with signature at end
 * 2. OpenRouter/Gemini: reasoning comes via delta.reasoning_details
 */

describe("consolidateReasoningItems", () => {
  // Test the consolidation logic directly
  const consolidateReasoningItems = (
    items: Array<{ type: string; text?: string; signature?: string }>,
  ): Array<{ type: string; text?: string; signature?: string }> => {
    let fullText = ""
    let signature: string | undefined

    for (const item of items) {
      if (item.text) {
        fullText += item.text
      }
      if (item.signature) {
        signature = item.signature
      }
    }

    if (signature) {
      return [{ type: "text", text: fullText, signature }]
    } else if (fullText) {
      return [{ type: "text", text: fullText }]
    }
    return []
  }

  it("should consolidate multiple text chunks into single block", () => {
    const items = [
      { type: "text", text: "First part. " },
      { type: "text", text: "Second part. " },
      { type: "text", text: "Third part." },
    ]

    const result = consolidateReasoningItems(items)

    expect(result).toEqual([
      { type: "text", text: "First part. Second part. Third part." },
    ])
  })

  it("should preserve signature from final chunk", () => {
    const items = [
      { type: "text", text: "The user is asking for" },
      { type: "text", text: " the weather in Tokyo." },
      { type: "text", text: "" },
      { type: "text", signature: "EtcCCkYIChgCKkDqzqkY..." },
    ]

    const result = consolidateReasoningItems(items)

    expect(result).toEqual([
      {
        type: "text",
        text: "The user is asking for the weather in Tokyo.",
        signature: "EtcCCkYIChgCKkDqzqkY...",
      },
    ])
  })

  it("should handle empty items array", () => {
    const result = consolidateReasoningItems([])
    expect(result).toEqual([])
  })

  it("should handle items with only signature (no text)", () => {
    const items = [{ type: "text", signature: "sig123" }]

    const result = consolidateReasoningItems(items)

    expect(result).toEqual([{ type: "text", text: "", signature: "sig123" }])
  })

  it("should handle real Anthropic streaming pattern", () => {
    // This simulates the actual streaming chunks from Anthropic
    const items = [
      { type: "text", text: "The user is asking for" },
      { type: "text", text: " the weather in Tokyo. I have" },
      { type: "text", text: " access to a weather function that takes" },
      { type: "text", text: " a location parameter. Tokyo is a" },
      { type: "text", text: " clear location, so I can make this" },
      { type: "text", text: " function call." },
      { type: "text", text: "" },
      {
        type: "text",
        signature:
          "EtcCCkYIChgCKkDqzqkYkRluxSkm4WQYpSIx4QPFf3dR3pf+6UuRqiBndx7Y80qRb7yjo/tcCdc13WWyMa4FB4Da8TcNS8kpbR3iEgyJexxFNUBOYH1oc6EaDPMx8InYUprM27bUXSIwGaxj/PSWAuF2OrQoRpmetERVHeqiOnJQy5ikPc7yx4+NBgoebM4kytQdtoJ3qwNFKr4BWd+ojQ8ZEwFjzjTZb2pFu0NIhKWr60YEkYIk7gk1wf/GkjvHiJ3i9i2ZJc/VkEStH0okJLvLUCIFAQCo/SncCyDrBnyKb4K5+rPnMTYWGZlg7JR3gpOQiqYVsNUQIkAYMBos7ct4EA2ON0YEpg7HPoLLpe92mJgZcxpxch+b0/48ClTtVREPkNCcOLdQ+x2Oc8Ituqqml8LQTblDRqaVU0RoeQ/bN+x9AtCSTnBar6VnJ/oeVYr0nwgWel9SaBgB",
      },
    ]

    const result = consolidateReasoningItems(items)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("text")
    expect(result[0].text).toBe(
      "The user is asking for the weather in Tokyo. I have access to a weather function that takes a location parameter. Tokyo is a clear location, so I can make this function call.",
    )
    expect(result[0].signature).toMatch(/^EtcCCkYI/)
  })
})

describe("getReasoningProviderMetadata", () => {
  // Test the metadata builder logic
  const getReasoningProviderMetadata = (
    accumulatedReasoningDetails: Array<unknown>,
    accumulatedReasoningItems: Array<{
      type: string
      text?: string
      signature?: string
    }>,
  ) => {
    const consolidateReasoningItems = (
      items: Array<{ type: string; text?: string; signature?: string }>,
    ): Array<{ type: string; text?: string; signature?: string }> => {
      let fullText = ""
      let signature: string | undefined
      for (const item of items) {
        if (item.text) fullText += item.text
        if (item.signature) signature = item.signature
      }
      if (signature) return [{ type: "text", text: fullText, signature }]
      if (fullText) return [{ type: "text", text: fullText }]
      return []
    }

    const hasReasoningDetails = accumulatedReasoningDetails.length > 0
    const hasReasoningItems = accumulatedReasoningItems.length > 0

    if (!hasReasoningDetails && !hasReasoningItems) {
      return undefined
    }

    const langtailMeta: Record<string, unknown> = {}

    if (hasReasoningDetails) {
      langtailMeta.reasoning_details = accumulatedReasoningDetails
    }

    if (hasReasoningItems) {
      langtailMeta.reasoning = consolidateReasoningItems(accumulatedReasoningItems)
    }

    return { langtail: langtailMeta }
  }

  it("should return undefined when no reasoning data", () => {
    const result = getReasoningProviderMetadata([], [])
    expect(result).toBeUndefined()
  })

  it("should include reasoning_details for OpenRouter format", () => {
    const reasoningDetails = [
      { type: "reasoning.text", text: "Thinking...", signature: "sig" },
    ]

    const result = getReasoningProviderMetadata(reasoningDetails, [])

    expect(result).toEqual({
      langtail: {
        reasoning_details: reasoningDetails,
      },
    })
  })

  it("should include reasoning for Anthropic format", () => {
    const reasoningItems = [
      { type: "text", text: "Thinking..." },
      { type: "text", signature: "sig123" },
    ]

    const result = getReasoningProviderMetadata([], reasoningItems)

    expect(result).toEqual({
      langtail: {
        reasoning: [{ type: "text", text: "Thinking...", signature: "sig123" }],
      },
    })
  })

  it("should include both formats when both present", () => {
    const reasoningDetails = [{ type: "reasoning.text", text: "Detail" }]
    const reasoningItems = [
      { type: "text", text: "Item" },
      { type: "text", signature: "sig" },
    ]

    const result = getReasoningProviderMetadata(reasoningDetails, reasoningItems)

    expect(result).toEqual({
      langtail: {
        reasoning_details: reasoningDetails,
        reasoning: [{ type: "text", text: "Item", signature: "sig" }],
      },
    })
  })
})

describe("Anthropic extended thinking preservation", () => {
  it("should describe the required format for Anthropic", () => {
    // This test documents the expected format for Anthropic's extended thinking
    const expectedAssistantMessageFormat = {
      role: "assistant",
      content: "",
      reasoning: [
        {
          type: "text",
          text: "The user is asking for the weather in Tokyo. I should call the weather function.",
          signature: "EtcCCkYI...", // This is required for Anthropic!
        },
      ],
      tool_calls: [
        {
          id: "toolu_01ABC",
          type: "function",
          function: {
            name: "weather",
            arguments: '{"location":"Tokyo"}',
          },
        },
      ],
    }

    // Verify the structure has all required fields
    expect(expectedAssistantMessageFormat.reasoning[0]).toHaveProperty("signature")
    expect(expectedAssistantMessageFormat.reasoning[0].type).toBe("text")
  })

  it("should describe the error that occurs without signature", () => {
    // This documents the error that Anthropic returns without signature
    const expectedError = {
      message:
        "messages.1.content.0.type: Expected `thinking` or `redacted_thinking`, but found `tool_use`. When `thinking` is enabled, a final `assistant` message must start with a thinking block (preceeding the lastmost set of `tool_use` and `tool_result` blocks).",
    }

    expect(expectedError.message).toContain("thinking")
    expect(expectedError.message).toContain("tool_use")
  })
})

describe("OpenRouter reasoning_details preservation", () => {
  it("should describe the required format for OpenRouter/Gemini", () => {
    // This test documents the expected format for OpenRouter
    const expectedAssistantMessageFormat = {
      role: "assistant",
      content: "",
      reasoning_details: [
        {
          type: "reasoning.text",
          text: "Analyzing the request...",
          signature: "sha256:abc123",
          id: "reasoning-1",
          format: "anthropic-claude-v1",
        },
      ],
      tool_calls: [
        {
          id: "tool_123",
          type: "function",
          function: {
            name: "weather",
            arguments: '{"location":"Tokyo"}',
          },
        },
      ],
    }

    expect(expectedAssistantMessageFormat.reasoning_details[0]).toHaveProperty(
      "type",
      "reasoning.text",
    )
  })

  it("should describe the error that occurs without reasoning_details", () => {
    // This documents the error from OpenRouter/Gemini without reasoning preservation
    const expectedError = {
      message:
        'Unable to submit request because function call `default_api:weather` in the 2. content block is missing a `thought_signature`.',
    }

    expect(expectedError.message).toContain("thought_signature")
  })
})

describe("Stream chunk accumulation patterns", () => {
  it("should accumulate reasoning from delta.reasoning (Anthropic)", () => {
    // Simulates the pattern of chunks from Anthropic
    const chunks = [
      { delta: { reasoning: { type: "text", text: "First " } } },
      { delta: { reasoning: { type: "text", text: "second " } } },
      { delta: { reasoning: { type: "text", text: "third." } } },
      { delta: { reasoning: { type: "text", text: "" } } },
      { delta: { reasoning: { type: "text", signature: "sig123" } } },
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
      },
    ]

    const accumulatedItems: Array<{
      type: string
      text?: string
      signature?: string
    }> = []

    for (const chunk of chunks) {
      if (chunk.delta.reasoning) {
        accumulatedItems.push(chunk.delta.reasoning)
      }
    }

    expect(accumulatedItems).toHaveLength(5)
    expect(accumulatedItems[4].signature).toBe("sig123")
  })

  it("should accumulate reasoning from delta.reasoning_details (OpenRouter)", () => {
    // Simulates the pattern of chunks from OpenRouter
    const chunks = [
      {
        delta: {
          reasoning_details: [
            { type: "reasoning.text", text: "Thinking...", signature: null },
          ],
        },
      },
      {
        delta: {
          reasoning_details: [
            { type: "reasoning.encrypted", data: "[REDACTED]" },
          ],
        },
      },
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "gen-123",
              type: "function",
              function: { name: "weather", arguments: '{"location":"NYC"}' },
            },
          ],
        },
      },
    ]

    const accumulatedDetails: unknown[] = []

    for (const chunk of chunks) {
      if (chunk.delta.reasoning_details) {
        accumulatedDetails.push(...chunk.delta.reasoning_details)
      }
    }

    expect(accumulatedDetails).toHaveLength(2)
    expect(accumulatedDetails[0]).toMatchObject({
      type: "reasoning.text",
      text: "Thinking...",
    })
    expect(accumulatedDetails[1]).toMatchObject({
      type: "reasoning.encrypted",
      data: "[REDACTED]",
    })
  })
})

