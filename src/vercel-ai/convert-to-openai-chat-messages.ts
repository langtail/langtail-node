import {
  LanguageModelV1Prompt,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { OpenAIChatPrompt } from './openai-chat-prompt';
import { MessageReasoning } from '../schemas';

export function convertToOpenAIChatMessages({
  prompt
}: {
  prompt: LanguageModelV1Prompt;
}): OpenAIChatPrompt {
  const messages: OpenAIChatPrompt = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }

        messages.push({
          role: 'user',
          content: content.map(part => {
            switch (part.type) {
              case 'text': {
                return { type: 'text', text: part.text };
              }
              case 'image': {
                return {
                  type: 'image_url',
                  image_url: {
                    url:
                      part.image instanceof URL
                        ? part.image.toString()
                        : `data:${part.mimeType ?? 'image/jpeg'
                        };base64,${convertUint8ArrayToBase64(part.image)}`,

                    // OpenAI specific extension: image detail
                    detail: part.providerMetadata?.openai?.imageDetail,
                  },
                };
              }
              case 'file': {
                throw new UnsupportedFunctionalityError({
                  functionality: 'File content parts in user messages',
                });
              }
            }
          }),
        });

        break;
      }

      case 'assistant': {
        let text = '';
        let reasoning: MessageReasoning[] = []
        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args),
                },
              });
              break;
            }
            case 'reasoning': {
              reasoning.push({
                type: "text",
                text: part.text,
                signature: part.signature,
              });
              break;
            }
            case 'redacted-reasoning': {
              reasoning.push({
                type: "redacted",
                data: part.data,
              });
              break;
            }
            default: {
              const _exhaustiveCheck: any = part;
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: text,
          // @ts-expect-error - reasoning is not defined in default openai request params
          reasoning: reasoning.length > 0 ? reasoning : undefined,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });


        break;
      }

      case 'tool': {
        for (const toolResponse of content) {
          messages.push({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result),
          });

        }
        break;
      }

      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return messages;
}