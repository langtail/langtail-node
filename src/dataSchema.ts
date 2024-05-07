import z from "zod"

// Define the schema for the data
const choiceStreamedSchema = z.object({
  index: z.number(),
  delta: z.any(), // Adjust based on the actual shape of delta
  logprobs: z.null(),
  finish_reason: z.string().nullable(),
})
export const openAIStreamingResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number(),
  model: z.string(),
  system_fingerprint: z.string().nullish(), // TODO change back to non nullable when openAI fixes the issue where system_fingerprint is returned as null
  choices: z.array(choiceStreamedSchema),
})
