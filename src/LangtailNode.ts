import OpenAI from "openai"
import * as Core from "openai/core"
import { LangtailPrompts } from "./LangtailPrompts"
import { ChatCompletionCreateParamsStreaming } from "openai/resources/index"
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsBase,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions"
import { APIPromise } from "openai/core"

import { userAgent } from "./userAgent"
import { Stream } from "openai/streaming"

export const baseURL = "https://proxy.langtail.com/v1"

export interface ILangtailExtraProps {
  doNotRecord?: boolean
  metadata?: Record<string, any>
}

export type ChatCompletionsCreateParams =
  | (ChatCompletionCreateParamsStreaming & ILangtailExtraProps)
  | (ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps)

export class LangtailNode {
  prompts: LangtailPrompts
  chat: {
    completions: {
      create(
        body: ChatCompletionCreateParamsNonStreaming & ILangtailExtraProps,
        options?: Core.RequestOptions,
      ): APIPromise<ChatCompletion>
      create(
        body: ChatCompletionCreateParamsStreaming & ILangtailExtraProps,
        options?: Core.RequestOptions,
      ): APIPromise<Stream<ChatCompletionChunk>>
      create(
        body: ChatCompletionCreateParamsBase & ILangtailExtraProps,
        options?: Core.RequestOptions,
      ): APIPromise<Stream<ChatCompletionChunk> | ChatCompletion>
      create(
        body: ChatCompletionCreateParams & ILangtailExtraProps,
        options?: Core.RequestOptions,
      ): APIPromise<ChatCompletion> | APIPromise<Stream<ChatCompletionChunk>>
    }
  }

  private _open_ai: OpenAI

  constructor(clientOptions?: {
    apiKey: string
    baseURL?: string
    doNotRecord?: boolean
    organization?: string
    project?: string
    fetch?: Core.Fetch
    onResponse?: (response: ChatCompletion) => void
  }) {
    const organization = clientOptions?.organization

    const apiKey = clientOptions?.apiKey || process.env.LANGTAIL_API_KEY
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable.",
      )
    }
    const optionsToPass = {
      baseURL: baseURL,
      apiKey,
      fetch: clientOptions?.fetch,
    }

    const defaultHeaders: Record<string, string> = {}
    if (clientOptions?.doNotRecord) {
      defaultHeaders["x-langtail-do-not-record"] = "true"
    }
    this._open_ai = new OpenAI({
      defaultHeaders: {
        ...defaultHeaders,
        "x-langtail-organization": organization,
      },
      ...optionsToPass,
    })

    this.prompts = new LangtailPrompts({
      apiKey,
      workspace: clientOptions?.organization,
      project: clientOptions?.project,
    })

    this.chat = {
      completions: {
        // @ts-expect-error
        create: async (
          params: ChatCompletionCreateParamsBase & ILangtailExtraProps,
          options: Core.RequestOptions = {},
        ) => {
          if (params.doNotRecord) {
            options.headers = {
              ["x-langtail-do-not-record"]: "true",
              "user-agent": userAgent,
              ...options?.headers,
            }
          }
          delete params.doNotRecord // openAI does not support these parameters

          if (params.metadata) {
            const metadataHeaders = Object.entries(params.metadata).reduce(
              (acc, [key, value]) => {
                acc[`x-langtail-metadata-${key}`] = value
                return acc
              },
              {},
            )
            options.headers = {
              ...metadataHeaders,
              ...options?.headers,
            }
          }
          delete params.metadata

          const res = await this._open_ai.chat.completions.create(
            params,
            options,
          )

          if (clientOptions?.onResponse) {
            if (res instanceof Stream) {
              // not supported
            } else {
              clientOptions.onResponse(res as ChatCompletion)
            }
          }
          return res
        },
      },
    }

    return this
  }
}

export { LangtailNode as Langtail }
export { LangtailPrompts as LangtailPrompts }
