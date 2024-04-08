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
import { Stream } from "openai/src/streaming"

export const baseURL = "https://proxy.langtail.com/v1"

export interface ILangtailExtraProps {
  doNotRecord?: boolean
  metadata?: Record<string, any>
}

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

  constructor(options?: {
    apiKey: string
    baseURL?: string
    doNotRecord?: boolean
    organization?: string
    project?: string
    fetch: Core.Fetch
  }) {
    const organization = options?.organization

    const apiKey = options?.apiKey || process.env.LANGTAIL_API_KEY
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable.",
      )
    }
    const optionsToPass = {
      baseURL: baseURL,
      apiKey,
      fetch: options?.fetch,
    }

    const defaultHeaders: Record<string, string> = {}
    if (options?.doNotRecord) {
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
      workspace: options?.organization,
      project: options?.project,
    })

    this.chat = {
      completions: {
        // @ts-expect-error
        create: (params, options) => {
          if (params.doNotRecord) {
            options = options ?? {}
            options.headers = {
              ["x-langtail-do-not-record"]: "true",
              ...options?.headers,
            }
            delete params.doNotRecord // openAI does not support this parameter
          }

          return this._open_ai.chat.completions.create(params, options)
        },
      },
    }

    return this
  }
}

export { LangtailNode as Langtail }
export { LangtailPrompts as LangtailPrompts }
