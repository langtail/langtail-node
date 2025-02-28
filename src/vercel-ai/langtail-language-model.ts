import {
  InvalidResponseDataError,
  LanguageModelV1,
  LanguageModelV1FinishReason,
  LanguageModelV1LogProbs,
  LanguageModelV1StreamPart,
} from '@ai-sdk/provider';
import {
  ParseResult,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { convertToOpenAIChatMessages } from './convert-to-openai-chat-messages';
import { mapOpenAIFinishReason } from './map-openai-finish-reason';
import { LangtailChatSettings } from './langtail-chat-settings';
import { openaiFailedResponseHandler } from './openai-error';
import { mapOpenAIChatLogProbsOutput } from './map-openai-chat-logprobs';
import { LangtailPrompts } from '../Langtail';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import { FunctionParameters } from 'openai/resources';
import type { PromptSlug, Environment, Version, LangtailEnvironment } from '../types';
import { ILangtailExtraProps, MessageReasoning } from '../schemas';

type LangtailChatConfig = {
  provider: string;
  langtailPrompts: LangtailPrompts;
  headers: Record<string, string | undefined>;
};

// modelId cannot be undefined, therefore we use 'langtail'
// to choose the default model from Langtail playground
const MODEL_IN_LANGTAIL = 'langtail';

export class LangtailChatLanguageModel<P extends PromptSlug = PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> implements LanguageModelV1 {
  readonly specificationVersion: 'v1' = 'v1';
  readonly defaultObjectGenerationMode = 'tool';

  readonly modelId: string;
  readonly promptId: P;

  readonly settings: LangtailChatSettings<P, E, V>;

  private readonly config: LangtailChatConfig;

  constructor(
    promptId: P,
    settings: LangtailChatSettings<P, E, V>,
    config: LangtailChatConfig,
  ) {
    this.promptId = promptId;
    this.modelId = settings.model ?? MODEL_IN_LANGTAIL;
    this.settings = settings;
    this.config = config;
  }

  get environment(): E extends LangtailEnvironment ? E : "production" {
    return (this.settings.environment ?? 'production') as E extends LangtailEnvironment ? E : "production";
  }

  get version(): NonNullable<V> | "default" {
    return (this.settings.version ?? 'default');
  }

  get provider(): string {
    return this.config.provider;
  }

  get headers(): Record<string, string | undefined> {
    return this.config.headers;
  }

  private createPromptPath(): string {
    return this.config.langtailPrompts.createPromptPath({
      prompt: this.promptId,
      environment: this.environment,
      version: this.settings.version,  // use undefined if version is 'default'
    });
  }

  private getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
  }: Parameters<LanguageModelV1['doGenerate']>[0]): ChatCompletionCreateParamsBase & ILangtailExtraProps {
    const type = mode.type;

    const baseArgs = {
      model: this.modelId,

      // Langtail-specific parameters:
      variables: this.settings.variables,

      // model specific settings:
      user: this.settings.user,

      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,

      // messages:
      messages: convertToOpenAIChatMessages({ prompt }),
    };

    switch (type) {
      case 'regular': {
        const tools = mode.tools ?? [];

        return {
          ...baseArgs,
          tools: tools?.filter(tool => tool.type === 'function').map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description ?? "",
              parameters: tool.parameters,
            },
          })),
        };
      }

      case 'object-json': {
        return {
          ...baseArgs,
          response_format: { type: 'json_object' },
        };
      }

      case 'object-tool': {
        return {
          ...baseArgs,
          tool_choice: { type: 'function', function: { name: mode.tool.name } },
          tools: [
            {
              type: 'function',
              function: {
                name: mode.tool.name,
                description: mode.tool.description ?? "",
                parameters: mode.tool.parameters as FunctionParameters,
              },
            },
          ],
        };
      }

      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }

  async doGenerate(
    options: Parameters<LanguageModelV1['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const args = this.getArgs(options);

    const body = {
      ...args,
      stream: false,
      model: args.model === MODEL_IN_LANGTAIL ? undefined : args.model,
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.createPromptPath(),
      headers: this.headers,
      body: body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openAIChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
    });

    const { messages: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];

    return {
      text: choice.message.content ?? undefined,
      // @ts-expect-error - reasoning is not defined in default openai response types
      reasoning: choice.message.reasoning,
      toolCalls: choice.message.tool_calls?.map(toolCall => ({
        toolCallType: 'function',
        toolCallId: toolCall.id ?? generateId(),
        toolName: toolCall.function.name,
        args: toolCall.function.arguments!,
      })),
      finishReason: mapOpenAIFinishReason(choice.finish_reason),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: [],
      logprobs: mapOpenAIChatLogProbsOutput(choice.logprobs),
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const args = this.getArgs(options);

    const body = {
      ...args,
      stream: true,
      model: args.model === MODEL_IN_LANGTAIL ? undefined : args.model,
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.createPromptPath(),
      headers: this.headers,
      body: body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        langtailChatChunksSchema,
      ),
      abortSignal: options.abortSignal,
    });

    const { messages: rawPrompt, ...rawSettings } = args;

    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }> = [];

    let finishReason: LanguageModelV1FinishReason = 'other';
    let usage: { promptTokens: number; completionTokens: number } = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN,
    };
    let logprobs: LanguageModelV1LogProbs;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof langtailChatChunksSchema>>,
          LanguageModelV1StreamPart
        >({
          transform(chunk, controller) {
            if (!chunk.success) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens,
              };
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = mapOpenAIFinishReason(choice.finish_reason);
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            if (delta.content != null) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: delta.content,
              });
            }

            if (delta.reasoning != null) {
              const reasoningDelta = delta.reasoning
              if (typeof reasoningDelta === 'string') {
                controller.enqueue({
                  type: 'reasoning',
                  textDelta: reasoningDelta,
                });
              } else {
                if (reasoningDelta.type === "text") {
                  if (reasoningDelta.signature != null) {
                    controller.enqueue({
                      type: 'reasoning-signature',
                      signature: reasoningDelta.signature,
                    });
                  }
                  if (reasoningDelta.text != null) {
                    controller.enqueue({
                      type: 'reasoning',
                      textDelta: reasoningDelta.text,
                    });
                  }
                } else if (reasoningDelta.type === "redacted") {
                  controller.enqueue({
                    type: 'redacted-reasoning',
                    data: reasoningDelta.data,
                  });
                }
              }
            }

            const mappedLogprobs = mapOpenAIChatLogProbsOutput(
              choice?.logprobs,
            );
            if (mappedLogprobs?.length) {
              if (logprobs === undefined) logprobs = [];
              logprobs.push(...mappedLogprobs);
            }

            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;

                // Tool call start. OpenAI returns all information except the arguments in the first chunk.
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== 'function') {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`,
                    });
                  }

                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`,
                    });
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`,
                    });
                  }

                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: 'function',
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? '',
                    },
                  };

                  continue;
                }

                // existing tool call, merge
                const toolCall = toolCalls[index];

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function!.arguments +=
                    toolCallDelta.function?.arguments ?? '';
                }

                // send delta
                controller.enqueue({
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: toolCallDelta.function.arguments ?? '',
                });

                // check if tool call is complete
                if (
                  toolCall.function?.name == null ||
                  toolCall.function?.arguments == null ||
                  !isParsableJson(toolCall.function.arguments)
                ) {
                  continue;
                }

                controller.enqueue({
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: toolCall.id ?? generateId(),
                  toolName: toolCall.function.name,
                  args: toolCall.function.arguments,
                });
              }
            }
          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              logprobs,
              usage,
            });
          },
        }),
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings: [],
    };
  }
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const openAIChatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant'),
        content: z.string().nullable().optional(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().optional().nullable(),
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            }),
          )
          .optional(),
      }),
      index: z.number(),
      logprobs: z
        .object({
          content: z
            .array(
              z.object({
                token: z.string(),
                logprob: z.number(),
                top_logprobs: z.array(
                  z.object({
                    token: z.string(),
                    logprob: z.number(),
                  }),
                ),
              }),
            )
            .nullable(),
        })
        .nullable()
        .optional(),
      finish_reason: z.string().optional().nullable(),
    }),
  ),
  object: z.literal('chat.completion'),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
  }),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const langtailChatChunksSchema = z.object({
  object: z.enum([
    'chat.completion.chunk',
    'chat.completion', // support for OpenAI-compatible providers such as Perplexity
  ]),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(['assistant']).optional(),
        content: z.string().nullable().optional(),
        reasoning: z.union([z.string(), z.object({
          type: z.enum(['text']),
          text: z.string().optional(),
          signature: z.string().optional(),
        }), z.object({
          type: z.enum(['redacted']),
          data: z.string(),
        })]).optional(),
        tool_calls: z
          .array(
            z.object({
              index: z.number(),
              id: z.string().optional().nullable(),
              type: z.literal('function').optional(),
              function: z.object({
                name: z.string().optional(),
                arguments: z.string().optional(),
              }),
            }),
          )
          .optional(),
      }),
      logprobs: z
        .object({
          content: z
            .array(
              z.object({
                token: z.string(),
                logprob: z.number(),
                top_logprobs: z.array(
                  z.object({
                    token: z.string(),
                    logprob: z.number(),
                  }),
                ),
              }),
            )
            .nullable(),
        })
        .nullable()
        .optional(),
      finish_reason: z.string().nullable().optional(),
      index: z.number(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
    })
    .optional()
    .nullable(),
});