import { z } from "zod"

export enum ReasoningFormat {
  Unknown = "unknown",
  OpenAIResponsesV1 = "openai-responses-v1",
  XAIResponsesV1 = "xai-responses-v1",
  AnthropicClaudeV1 = "anthropic-claude-v1",
}

// Anthropic Claude was the first reasoning that we're
// passing back and forth
export const DEFAULT_REASONING_FORMAT = ReasoningFormat.AnthropicClaudeV1

export enum ReasoningDetailType {
  Summary = "reasoning.summary",
  Encrypted = "reasoning.encrypted",
  Text = "reasoning.text",
}

export const CommonReasoningDetailSchema = z.object({
  id: z.string().nullish(),
  format: z.nativeEnum(ReasoningFormat).nullish(),
  index: z.number().optional(),
})

export const ReasoningDetailSummarySchema = z
  .object({
    type: z.literal(ReasoningDetailType.Summary),
    summary: z.string(),
  })
  .extend(CommonReasoningDetailSchema.shape)

export type ReasoningDetailSummary = z.infer<
  typeof ReasoningDetailSummarySchema
>

export const ReasoningDetailEncryptedSchema = z
  .object({
    type: z.literal(ReasoningDetailType.Encrypted),
    data: z.string(),
  })
  .extend(CommonReasoningDetailSchema.shape)

export type ReasoningDetailEncrypted = z.infer<
  typeof ReasoningDetailEncryptedSchema
>

export const ReasoningDetailTextSchema = z
  .object({
    type: z.literal(ReasoningDetailType.Text),
    text: z.string().nullish(),
    signature: z.string().nullish(),
  })
  .extend(CommonReasoningDetailSchema.shape)

export type ReasoningDetailText = z.infer<typeof ReasoningDetailTextSchema>

export const ReasoningDetailUnionSchema = z.union([
  ReasoningDetailSummarySchema,
  ReasoningDetailEncryptedSchema,
  ReasoningDetailTextSchema,
])

export type ReasoningDetailUnion = z.infer<typeof ReasoningDetailUnionSchema>

const ReasoningDetailsWithUnknownSchema = z.union([
  ReasoningDetailUnionSchema,
  z.unknown().transform(() => null),
])

export const ReasoningDetailArraySchema = z
  .array(ReasoningDetailsWithUnknownSchema)
  .transform((d) => d.filter((d): d is ReasoningDetailUnion => !!d))

export type ReasoningDetail = ReasoningDetailUnion
