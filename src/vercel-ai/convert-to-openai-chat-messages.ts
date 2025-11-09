import {
  LanguageModelV1Prompt,
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
  prompt: LanguageModelV1Prompt
}): OpenAIChatPrompt {
  const messages: OpenAIChatPrompt = []

  // Helper function to add a message with cacheControl if needed
  const addMessage = (message: any, cacheControl: boolean) => {
    if (cacheControl) {
      message.cache_enabled = true
    }

    messages.push(message)
  }

  for (const { role, content, providerMetadata } of prompt) {
    const anthropicCacheControl = Boolean(
      providerMetadata?.anthropic?.cacheControl,
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
                case "image": {
                  return {
                    type: "image_url",
                    image_url: {
                      url:
                        part.image instanceof URL
                          ? part.image.toString()
                          : `data:${
                              part.mimeType ?? "image/jpeg"
                            };base64,${convertUint8ArrayToBase64(part.image)}`,

                      // OpenAI specific extension: image detail
                      detail: part.providerMetadata?.openai?.imageDetail,
                    },
                  }
                }
                case "file": {
                  throw new UnsupportedFunctionalityError({
                    functionality: "File content parts in user messages",
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

        // Check if providerMetadata contains preserved reasoning_details
        const langtailMetadata = providerMetadata?.langtail as
          | { reasoning_details?: ReasoningDetail[] }
          | undefined
        if (langtailMetadata?.reasoning_details) {
          reasoningDetails = langtailMetadata.reasoning_details
        }

        for (const part of content) {
          switch (part.type) {
            case "reasoning": {
              reasoning.push({
                type: "text",
                text: part.text,
                signature: part.signature,
              })
              break
            }
            case "redacted-reasoning": {
              reasoning.push({
                type: "redacted",
                data: part.data,
              })
              break
            }

            case "text": {
              text += part.text
              break
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args),
                },
              })
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
          let toolContent: string | Array<ChatCompletionContentPart>

          // Check if result is already in message array format
          if (
            Array.isArray(toolResponse.result) &&
            toolResponse.result.length > 0 &&
            toolResponse.result.every(
              (item: any) =>
                typeof item === "object" &&
                item !== null &&
                "type" in item &&
                ["text", "image_url"].includes(item.type),
            )
          ) {
            // Handle as content array (supports images and text)
            toolContent = toolResponse.result.map((part: any) => {
              switch (part.type) {
                case "text": {
                  return { type: "text", text: part.text }
                }
                case "image_url": {
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.image_url.url,
                    },
                  }
                }
                default: {
                  throw new Error(
                    `Unsupported tool result content type: ${part.type}`,
                  )
                }
              }
            })
          } else {
            // Fall back to JSON string for backward compatibility
            toolContent = JSON.stringify(toolResponse.result)
          }

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
