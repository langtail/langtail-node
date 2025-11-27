import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider"
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils"
import {
  OpenAIChatPrompt,
  ChatCompletionContentPart,
} from "./openai-chat-prompt"
import { MessageReasoning } from "../schemas"
import { ReasoningDetail } from "../reasoning-details-schema"

export function convertToOpenAIChatMessages({
  prompt,
}: {
  prompt: LanguageModelV2Prompt
}): OpenAIChatPrompt {
  const messages: OpenAIChatPrompt = []

  // Helper function to add a message with cacheControl if needed
  const addMessage = (message: any, cacheControl: boolean) => {
    if (cacheControl) {
      message.cache_enabled = true
    }

    messages.push(message)
  }

  for (const { role, content, providerOptions } of prompt) {
    const anthropicCacheControl = Boolean(
      providerOptions?.anthropic?.cacheControl,
    )

    switch (role) {
      case "system": {
        addMessage({ role: "system", content }, anthropicCacheControl)
        break
      }

      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          addMessage(
            { role: "user", content: content[0].text },
            anthropicCacheControl,
          )
          break
        }

        addMessage(
          {
            role: "user",
            content: content.map((part) => {
              switch (part.type) {
                case "text": {
                  return { type: "text", text: part.text }
                }
                case "file": {
                  // Handle file parts - in V2, images are now file parts with mediaType
                  if (part.mediaType?.startsWith("image/")) {
                    const url = getFileUrl(part)
                    return {
                      type: "image_url",
                      image_url: {
                        url,
                        // OpenAI specific extension: image detail
                        detail: part.providerOptions?.openai?.imageDetail,
                      },
                    }
                  }
                  throw new UnsupportedFunctionalityError({
                    functionality: `File content parts with mediaType ${part.mediaType} in user messages`,
                  })
                }
              }
            }),
          },
          anthropicCacheControl,
        )
        break
      }

      case "assistant": {
        let text = ""
        let reasoning: MessageReasoning[] = []
        let reasoningDetails: ReasoningDetail[] | undefined
        const toolCalls: Array<{
          id: string
          type: "function"
          function: { name: string; arguments: string }
        }> = []

        // Check if providerOptions contains preserved reasoning data
        const langtailMetadata = providerOptions?.langtail as
          | {
              reasoning_details?: ReasoningDetail[]
              reasoning?: Array<{
                type: string
                text?: string
                signature?: string
              }>
            }
          | undefined

        if (langtailMetadata?.reasoning_details) {
          reasoningDetails = langtailMetadata.reasoning_details
        }

        // If we have preserved reasoning with signature (from Anthropic), use it directly
        if (
          langtailMetadata?.reasoning &&
          langtailMetadata.reasoning.length > 0
        ) {
          reasoning = langtailMetadata.reasoning as MessageReasoning[]
        }

        for (const part of content) {
          switch (part.type) {
            case "reasoning": {
              // Only add reasoning from parts if we don't have preserved reasoning with signature
              if (!langtailMetadata?.reasoning) {
                reasoning.push({
                  type: "text",
                  text: part.text,
                })
              }
              break
            }

            case "text": {
              text += part.text
              break
            }
            case "tool-call": {
              // Check for reasoning data in tool call providerOptions
              const partLangtail = part.providerOptions?.langtail as
                | {
                    reasoning_details?: ReasoningDetail[]
                    reasoning?: Array<{
                      type: string
                      text?: string
                      signature?: string
                    }>
                  }
                | undefined

              if (partLangtail?.reasoning_details) {
                if (!reasoningDetails) {
                  reasoningDetails = []
                }
                reasoningDetails.push(...partLangtail.reasoning_details)
              }

              // Use preserved reasoning with signature if available
              if (
                partLangtail?.reasoning &&
                partLangtail.reasoning.length > 0
              ) {
                reasoning = partLangtail.reasoning as MessageReasoning[]
              }

              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  // V2 uses `input` (unknown) instead of `args` (string)
                  arguments:
                    typeof part.input === "string"
                      ? part.input
                      : JSON.stringify(part.input),
                },
              })
              break
            }
            case "file": {
              // Skip file parts in assistant messages for now
              break
            }
            case "tool-result": {
              // Tool results in assistant content are handled separately
              break
            }

            default: {
              const _exhaustiveCheck: any = part
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`)
            }
          }
        }

        addMessage(
          {
            role: "assistant",
            content: text,
            reasoning: reasoning.length > 0 ? reasoning : undefined,
            reasoning_details: reasoningDetails,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          anthropicCacheControl,
        )
        break
      }

      case "tool": {
        for (const toolResponse of content) {
          const toolContent = getToolResultContent(toolResponse.output)

          addMessage(
            {
              role: "tool",
              tool_call_id: toolResponse.toolCallId,
              content: toolContent,
            },
            anthropicCacheControl,
          )
        }
        break
      }

      default: {
        const _exhaustiveCheck: never = role
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
      }
    }
  }

  return messages
}

// Helper to convert V2 file part to URL
function getFileUrl(part: {
  data: Uint8Array | string | URL
  mediaType: string
}): string {
  if (part.data instanceof URL) {
    return part.data.toString()
  }
  if (typeof part.data === "string") {
    // Check if it's already a data URL or regular URL
    if (
      part.data.startsWith("data:") ||
      part.data.startsWith("http://") ||
      part.data.startsWith("https://")
    ) {
      return part.data
    }
    // Assume base64 string
    return `data:${part.mediaType};base64,${part.data}`
  }
  // Uint8Array
  return `data:${part.mediaType};base64,${convertUint8ArrayToBase64(part.data)}`
}

// Helper to convert V2 tool result output to content
function getToolResultContent(
  output:
    | { type: "text"; value: string }
    | { type: "json"; value: unknown }
    | { type: "error-text"; value: string }
    | { type: "error-json"; value: unknown }
    | {
        type: "content"
        value: Array<
          | { type: "text"; text: string }
          | { type: "media"; data: string; mediaType: string }
        >
      },
): string | Array<ChatCompletionContentPart> {
  switch (output.type) {
    case "text":
    case "error-text":
      return output.value
    case "json":
    case "error-json":
      return JSON.stringify(output.value)
    case "content":
      return output.value.map((item) => {
        if (item.type === "text") {
          return { type: "text" as const, text: item.text }
        }
        // media type - support both URLs and base64 data
        const data = item.data
        const isUrl =
          data.startsWith("http://") ||
          data.startsWith("https://") ||
          data.startsWith("data:")
        return {
          type: "image_url" as const,
          image_url: {
            url: isUrl ? data : `data:${item.mediaType};base64,${data}`,
          },
        }
      })
  }
}
