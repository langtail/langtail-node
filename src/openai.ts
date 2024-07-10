import type { RequestOptions } from "openai/core"
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/index"
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsBase,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions"
import type { APIPromise } from "openai/core"
import { Stream } from "openai/streaming"

import { userAgent } from "./userAgent"
import { ILangtailExtraProps } from "./schemas"
import { PromptSlug, PromptSlugOption } from "./types"

export const baseURL = "https://proxy.langtail.com/v1"


export interface OpenAIProxyOptions {
  baseURL?: string,
  doNotRecord?: boolean,
  organization?: string,
  onResponse?: (response: ChatCompletion) => void
}

interface OpenAIClient {
  baseURL: string
  chat: {
    completions: {
      create: (body: any, options?: any) => Promise<any>
    }
  }
}

type LangtailSpecificProps = Partial<PromptSlugOption<PromptSlug>> & ILangtailExtraProps

export class OpenAIProxy {
  chat: {
    completions: {
      create(
        body: ChatCompletionCreateParamsNonStreaming & LangtailSpecificProps,
        options?: RequestOptions,
      ): APIPromise<ChatCompletion>
      create(
        body: ChatCompletionCreateParamsStreaming & LangtailSpecificProps,
        options?: RequestOptions,
      ): APIPromise<Stream<ChatCompletionChunk>>
      create(
        body: ChatCompletionCreateParamsBase & LangtailSpecificProps,
        options?: RequestOptions,
      ): APIPromise<Stream<ChatCompletionChunk> | ChatCompletion>
      create(
        body: ChatCompletionCreateParams & LangtailSpecificProps,
        options?: RequestOptions,
      ): APIPromise<ChatCompletion> | APIPromise<Stream<ChatCompletionChunk>>
    }
  }

  private _open_ai: OpenAIClient

  constructor(openai: OpenAIClient, proxyOptions?: OpenAIProxyOptions) {
    this._open_ai = openai
    this._open_ai.baseURL = proxyOptions?.baseURL ?? baseURL

    const defaultHeaders: Record<string, string> = {}
    if (proxyOptions?.doNotRecord) {
      defaultHeaders["x-langtail-do-not-record"] = "true"
    }
    if (proxyOptions?.organization) {
      defaultHeaders["x-langtail-organization"] = proxyOptions.organization
    }

    this.chat = {
      completions: {
        // @ts-expect-error
        create: async (
          params: ChatCompletionCreateParamsBase & LangtailSpecificProps,
          options: RequestOptions = {},
        ) => {
          let headers = {
            "user-agent": userAgent,
            ...defaultHeaders,
            ...options?.headers,
          }
          if (params.doNotRecord) {
            headers["x-langtail-do-not-record"] = "true"
          }
          if (params.prompt) {
            headers["x-langtail-prompt"] = params.prompt
          }
          // openAI does not support these parameters
          delete params.doNotRecord
          delete params.prompt

          if (params.metadata) {
            const metadataHeaders = Object.entries(params.metadata).reduce(
              (acc, [key, value]) => {
                acc[`x-langtail-metadata-${key}`] = value
                return acc
              },
              {},
            )
            headers = { ...headers, ...metadataHeaders }
          }
          delete params.metadata

          options.headers = headers
          const res = await this._open_ai.chat.completions.create(
            params,
            options,
          )

          if (proxyOptions?.onResponse) {
            if (res instanceof Stream) {
              // not supported
            } else {
              proxyOptions.onResponse(res as ChatCompletion)
            }
          }
          return res
        },
      },
    }

    return this
  }
}

export const createOpenAIProxy = (openai: OpenAIClient, proxyOptions?: OpenAIProxyOptions) => {
  return new OpenAIProxy(openai, proxyOptions)
}
