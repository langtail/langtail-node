import { describe, expect, it } from "vitest"
import {
  ReasoningDetailType,
  ReasoningDetailTextSchema,
  ReasoningDetailSummarySchema,
  ReasoningDetailEncryptedSchema,
  ReasoningDetailUnionSchema,
  ReasoningDetailArraySchema,
  ReasoningFormat,
} from "./reasoning-details-schema"
import { MessageSchema } from "./schemas"

describe("ReasoningDetail Schemas", () => {
  describe("ReasoningDetailTextSchema", () => {
    it("should validate a complete text reasoning detail", () => {
      const detail = {
        type: ReasoningDetailType.Text,
        text: "This is my reasoning",
        signature: "abc123",
        id: "reasoning-1",
        format: ReasoningFormat.AnthropicClaudeV1,
        index: 0,
      }

      const result = ReasoningDetailTextSchema.parse(detail)
      expect(result).toEqual(detail)
    })

    it("should validate text reasoning detail with null/optional fields", () => {
      const detail = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: null,
        id: null,
        format: null,
      }

      const result = ReasoningDetailTextSchema.parse(detail)
      expect(result.type).toBe(ReasoningDetailType.Text)
    })

    it("should validate minimal text reasoning detail", () => {
      const detail = {
        type: ReasoningDetailType.Text,
        text: "Minimal reasoning",
      }

      const result = ReasoningDetailTextSchema.parse(detail)
      expect(result.text).toBe("Minimal reasoning")
    })
  })

  describe("ReasoningDetailSummarySchema", () => {
    it("should validate a summary reasoning detail", () => {
      const detail = {
        type: ReasoningDetailType.Summary,
        summary: "Here's a summary of my reasoning",
        id: "summary-1",
        format: ReasoningFormat.OpenAIResponsesV1,
      }

      const result = ReasoningDetailSummarySchema.parse(detail)
      expect(result.summary).toBe("Here's a summary of my reasoning")
    })
  })

  describe("ReasoningDetailEncryptedSchema", () => {
    it("should validate an encrypted reasoning detail", () => {
      const detail = {
        type: ReasoningDetailType.Encrypted,
        data: "encrypted_base64_data_here",
        id: "encrypted-1",
        format: ReasoningFormat.XAIResponsesV1,
      }

      const result = ReasoningDetailEncryptedSchema.parse(detail)
      expect(result.data).toBe("encrypted_base64_data_here")
    })
  })

  describe("ReasoningDetailUnionSchema", () => {
    it("should parse text type", () => {
      const detail = {
        type: ReasoningDetailType.Text,
        text: "Text reasoning",
      }

      const result = ReasoningDetailUnionSchema.parse(detail)
      expect(result.type).toBe(ReasoningDetailType.Text)
    })

    it("should parse summary type", () => {
      const detail = {
        type: ReasoningDetailType.Summary,
        summary: "Summary reasoning",
      }

      const result = ReasoningDetailUnionSchema.parse(detail)
      expect(result.type).toBe(ReasoningDetailType.Summary)
    })

    it("should parse encrypted type", () => {
      const detail = {
        type: ReasoningDetailType.Encrypted,
        data: "encrypted_data",
      }

      const result = ReasoningDetailUnionSchema.parse(detail)
      expect(result.type).toBe(ReasoningDetailType.Encrypted)
    })
  })

  describe("ReasoningDetailArraySchema", () => {
    it("should parse array of mixed reasoning details", () => {
      const details = [
        {
          type: ReasoningDetailType.Text,
          text: "Step 1: Analyze the problem",
        },
        {
          type: ReasoningDetailType.Summary,
          summary: "The problem requires X approach",
        },
        {
          type: ReasoningDetailType.Encrypted,
          data: "encrypted_content",
        },
      ]

      const result = ReasoningDetailArraySchema.parse(details)
      expect(result).toHaveLength(3)
      expect(result[0].type).toBe(ReasoningDetailType.Text)
      expect(result[1].type).toBe(ReasoningDetailType.Summary)
      expect(result[2].type).toBe(ReasoningDetailType.Encrypted)
    })

    it("should filter out invalid/unknown reasoning details", () => {
      const details = [
        {
          type: ReasoningDetailType.Text,
          text: "Valid reasoning",
        },
        {
          type: "unknown_type",
          data: "should be filtered",
        },
        {
          type: ReasoningDetailType.Summary,
          summary: "Another valid one",
        },
      ]

      const result = ReasoningDetailArraySchema.parse(details)
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe(ReasoningDetailType.Text)
      expect(result[1].type).toBe(ReasoningDetailType.Summary)
    })

    it("should handle empty array", () => {
      const result = ReasoningDetailArraySchema.parse([])
      expect(result).toEqual([])
    })
  })
})

describe("Message Schema with reasoning_details", () => {
  it("should validate message with reasoning_details", () => {
    const message = {
      role: "assistant",
      content: "Here's my answer",
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: "I thought about this carefully",
          signature: "sig123",
        },
        {
          type: ReasoningDetailType.Summary,
          summary: "In summary, the answer is X",
        },
      ],
    }

    const result = MessageSchema.parse(message)
    expect(result.reasoning_details).toHaveLength(2)
    expect(result.reasoning_details?.[0].type).toBe(ReasoningDetailType.Text)
  })

  it("should validate message with both reasoning and reasoning_details", () => {
    const message = {
      role: "assistant",
      content: "Here's my answer",
      reasoning: [
        {
          type: "text",
          text: "Legacy reasoning format",
        },
      ],
      reasoning_details: [
        {
          type: ReasoningDetailType.Text,
          text: "New reasoning_details format",
        },
      ],
    }

    const result = MessageSchema.parse(message)
    expect(result.reasoning).toBeDefined()
    expect(result.reasoning_details).toBeDefined()
  })

  it("should validate message with null reasoning_details", () => {
    const message = {
      role: "assistant",
      content: "Simple answer",
      reasoning_details: null,
    }

    const result = MessageSchema.parse(message)
    expect(result.reasoning_details).toBeNull()
  })

  it("should validate message without reasoning_details", () => {
    const message = {
      role: "assistant",
      content: "Simple answer",
    }

    const result = MessageSchema.parse(message)
    expect(result.reasoning_details).toBeUndefined()
  })
})

describe("ReasoningFormat enum", () => {
  it("should have all expected format values", () => {
    expect(ReasoningFormat.Unknown).toBe("unknown")
    expect(ReasoningFormat.OpenAIResponsesV1).toBe("openai-responses-v1")
    expect(ReasoningFormat.XAIResponsesV1).toBe("xai-responses-v1")
    expect(ReasoningFormat.AnthropicClaudeV1).toBe("anthropic-claude-v1")
    expect(ReasoningFormat.GoogleGeminiV1).toBe("google-gemini-v1")
  })
})

describe("ReasoningDetailType enum", () => {
  it("should have all expected type values", () => {
    expect(ReasoningDetailType.Summary).toBe("reasoning.summary")
    expect(ReasoningDetailType.Encrypted).toBe("reasoning.encrypted")
    expect(ReasoningDetailType.Text).toBe("reasoning.text")
  })
})

describe("Reasoning details with all format types", () => {
  it("should validate reasoning details with different formats", () => {
    const formats = [
      ReasoningFormat.Unknown,
      ReasoningFormat.OpenAIResponsesV1,
      ReasoningFormat.XAIResponsesV1,
      ReasoningFormat.AnthropicClaudeV1,
      ReasoningFormat.GoogleGeminiV1,
    ]

    formats.forEach((format) => {
      const detail = {
        type: ReasoningDetailType.Text,
        text: `Reasoning with ${format} format`,
        format: format,
      }

      const result = ReasoningDetailTextSchema.parse(detail)
      expect(result.format).toBe(format)
    })
  })
})
