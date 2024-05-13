import type OpenAI from "openai"
import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

import {
  MessageSchema,
  PlaygroundState,
  ToolChoiceSchema,
  ToolSchema,
} from "./schemas"
import { compileLTTemplate } from "./template"
import { ChatCompletionsCreateParams } from "./LangtailNode"

extendZodWithOpenApi(z)

export const bodyMetadataSchema = z
  .record(z.string().max(64), z.union([z.string(), z.number()]))
  .optional()

export const langtailBodySchema = z.object({
  doNotRecord: z.boolean().optional().openapi({
    description:
      "If true, potentially sensitive data like the prompt and response will not be recorded in the logs",
    example: false,
  }),
  metadata: bodyMetadataSchema,
  _langtailTestRunId: z.string().optional(),
  _langtailTestInputId: z.string().optional(),
})

export const openAIBodySchemaObjectDefinition = {
  stream: z.boolean().optional().openapi({ example: false }),
  user: z.string().optional().openapi({
    description: "A unique identifier representing your end-user",
    example: "user_123",
  }),

  seed: z.number().optional().openapi({
    description: "A seed is used  to generate reproducible results",
    example: 123,
  }),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  model: z.string().optional(),
  tools: z.array(ToolSchema).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  template: z.array(MessageSchema).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  response_format: z
    .object({
      type: z.enum(["json_object"]),
    })
    .optional(),
  messages: z
    .array(MessageSchema)
    .optional()
    .openapi({
      description: "Additional messages to seed the conversation with",
      example: [
        {
          role: "user",
          content: "Hello",
        },
      ],
    }),
}
export const openAIBodySchema = z.object(openAIBodySchemaObjectDefinition)

export const bothBodySchema = langtailBodySchema.merge(openAIBodySchema)

export type IncomingBodyType = z.infer<typeof bothBodySchema>
export type OpenAiBodyType = z.infer<typeof openAIBodySchema>

/**
 * Get the body for the OpenAI API request. Used in the langtail prompt API. // TODO remove this from our prompt-API when this is merged so that we don't have this code duplicated
 */
export function getOpenAIBody(
  completionConfig: PlaygroundState,
  parsedBody: IncomingBodyType,
): ChatCompletionsCreateParams {
  const completionArgs = completionConfig.state.args

  const template = parsedBody.template ?? completionConfig.state.template
  const inputMessages = [
    ...template.map((item) => {
      const needsCompilation =
        typeof item.content === "string" ? item.content?.includes("{{") : true

      const variables = Object.assign(
        completionConfig.chatInput,
        parsedBody.variables ?? {},
      )
      return {
        ...item,
        content:
          item.content &&
          (needsCompilation
            ? compileLTTemplate(item.content, variables)
            : item.content),
      }
    }),
    ...(parsedBody.messages ?? []),
  ]
  const openAIbody: OpenAI.Chat.ChatCompletionCreateParams = {
    model: parsedBody.model ?? completionArgs.model,
    temperature: parsedBody.temperature ?? completionArgs.temperature,
    messages: inputMessages,
    top_p: parsedBody.top_p ?? completionArgs.top_p,
    presence_penalty:
      parsedBody.presence_penalty ?? completionArgs.presence_penalty,
    frequency_penalty:
      parsedBody.frequency_penalty ?? completionArgs.frequency_penalty,
    ...(parsedBody.seed || completionArgs.seed
      ? {
          seed: parsedBody.seed ?? completionArgs.seed,
        }
      : {}),
    ...(Array.isArray(completionArgs.stop) && completionArgs.stop.length > 0
      ? { stop: completionArgs.stop }
      : {}),
  }

  if (parsedBody.max_tokens || completionArgs.max_tokens) {
    openAIbody.max_tokens = parsedBody.max_tokens ?? completionArgs.max_tokens
    if (parsedBody.max_tokens === -1) {
      delete openAIbody.max_tokens
    }
  }

  if (completionArgs.jsonmode || parsedBody.response_format) {
    openAIbody.response_format = parsedBody.response_format ?? {
      type: "json_object",
    }
  }

  if (completionArgs.stop || parsedBody.stop) {
    openAIbody.stop = parsedBody.stop ?? completionArgs.stop
  }

  const toolChoice = parsedBody.tool_choice ?? completionArgs.tool_choice
  if (toolChoice) {
    openAIbody.tool_choice = toolChoice
  }

  if (
    completionConfig.state.functions &&
    completionConfig.state.functions.length > 0
  ) {
    openAIbody.functions = completionConfig.state.functions
  }
  if (completionConfig.state.tools && completionConfig.state.tools.length > 0) {
    // Remove tools[0].function.id from the tools array as that is an internal langtail id
    openAIbody.tools = completionConfig.state.tools.map((tool) => {
      const { id: _, ...rest } = tool.function
      return { ...tool, function: rest }
    })
  }
  if (parsedBody.tools && parsedBody.tools.length > 0) {
    openAIbody.tools = parsedBody.tools
  }

  if (parsedBody.response_format?.type === "json_object") {
    openAIbody.messages.push({
      role: "system",
      content: "format: JSON",
    })
  }
  return openAIbody as ChatCompletionsCreateParams
}

