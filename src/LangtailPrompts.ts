import { ChatCompletion } from "openai/resources/chat/completions"
import { ChatCompletionChunk } from "openai/resources/chat/completions"

import { Stream } from "openai/streaming"
import {
  ChatCompletionsCreateParams,
  ILangtailExtraProps,
} from "./LangtailNode"
import { Fetch } from "openai/core"
import { userAgent } from "./userAgent"
import queryString from "query-string"
import { PlaygroundState } from "./schemas"
import { OpenAiBodyType, getOpenAIBody } from "./getOpenAIBody"
import { LogDataType, OpenAIResponseType } from "./dataSchema"
import OpenAI from "openai"

export type LangtailEnvironment = "preview" | "staging" | "production"

interface LangtailPromptVariables {} // TODO use this when generating schema for deployed prompts

type StreamResponseType = Stream<ChatCompletionChunk>

type OpenAIResponseWithHttp = ChatCompletion & {
  httpResponse: Response | globalThis.Response
}

type Options = {
  apiKey: string
  openAIKey?: string | undefined
  baseURL?: string | undefined
  workspace?: string | undefined
  project?: string | undefined
  fetch?: Fetch
  onResponse?: (response: ChatCompletion) => void
}

interface IPromptIdProps extends ILangtailExtraProps {
  prompt: string
  /**
   * The environment to fetch the prompt from. Defaults to "production".
   * @default "production"
   **/
  environment?: LangtailEnvironment
  version?: string
}

type PromptIdProps = {
  prompt: string
  /**
   * The environment to fetch the prompt from. Defaults to "production".
   * @default "production"
   **/
  environment?: LangtailEnvironment
  version?: string
}

interface IRequestParams extends IPromptIdProps {
  variables?: Record<string, any>
}

interface IRequestParamsStream extends IRequestParams {
  stream: boolean
}

interface IPromptObject {
  _promptIdProps: IPromptIdProps
  promptConfig: PlaygroundState
  variables: Record<string, string> | undefined
  toOpenAI: () => ChatCompletionsCreateParams
}

export class LangtailPrompts {
  apiKey: string
  baseUrl: string
  options: Options
  openAIKey: string | undefined

  constructor(options: Options) {
    const { apiKey, baseURL: baseUrl } = options
    this.apiKey = apiKey
    this.baseUrl = baseUrl ?? "https://api.langtail.com"
    this.options = options
    this.openAIKey = options.openAIKey
  }

  _createPromptPath({
    prompt,
    environment,
    version,
    configGet,
  }: {
    prompt: string
    environment: LangtailEnvironment
    version?: string
    configGet?: boolean
  }) {
    if (prompt.includes("/")) {
      throw new Error(
        "prompt should not include / character, either omit workspace/project or use just the prompt name.",
      )
    }
    const queryParams = queryString.stringify({
      v: version,
      "open-ai-completion-config-payload": configGet,
    })

    if (this.options.workspace && this.options.project) {
      const url = `${this.baseUrl}/${this.options.workspace}/${this.options.project}/${prompt}/${environment}?${queryParams}`
      // user supplied workspace and project in constructor

      return url
    }

    if (this.options.project) {
      return `${this.options.project}/${prompt}/${environment}?${queryParams}`
    }

    const urlPath = `project-prompt/${prompt}/${environment}`
    return urlPath.startsWith("/")
      ? this.baseUrl + urlPath + `?${queryParams}`
      : `${this.baseUrl}/${urlPath}?${queryParams}`
  }

  invoke(
    options: Omit<IRequestParams, "stream">,
  ): Promise<OpenAIResponseWithHttp>
  invoke(options: IRequestParamsStream): Promise<StreamResponseType>
  async invoke({
    prompt,
    environment,
    version,
    doNotRecord,
    metadata,
    ...rest
  }: IRequestParams | IRequestParamsStream) {
    const metadataHeaders = this.formatMetadataHeaders(metadata)

    const fetchInit = {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json",
        "x-langtail-do-not-record": doNotRecord ? "true" : "false",
        ...metadataHeaders,
      },
      body: JSON.stringify({ stream: false, ...rest }),
    }
    const promptPath = this._createPromptPath({
      prompt,
      environment: environment ?? "production",
      version: version,
    })

    let res: Response | globalThis.Response

    if (this.options.fetch) {
      res = await this.options.fetch(promptPath, fetchInit)
    } else {
      res = await fetch(promptPath, fetchInit)
    }

    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt: ${res.status} ${await res.text()}`,
      )
    }

    if ("stream" in rest && rest.stream) {
      if (!res.body) {
        throw new Error("No body in response")
      }
      return Stream.fromSSEResponse(res, new AbortController())
    }

    const result = (await res.json()) as OpenAIResponseWithHttp
    if (this.options.onResponse) {
      this.options.onResponse(result)
    }
    result.httpResponse = res
    return result
  }

  private formatMetadataHeaders(metadata: Record<string, any> | undefined) {
    return metadata
      ? Object.entries(metadata).reduce((acc, [key, value]) => {
          acc[`x-langtail-metadata-${key}`] = value
          return acc
        }, {})
      : {}
  }

  async get({
    prompt,
    environment,
    version,
  }: {
    prompt: string
    /**
     * The environment to fetch the prompt from. Defaults to "production".
     * @default "production"
     **/
    environment?: LangtailEnvironment
    version?: string
  }): Promise<
    PlaygroundState & {
      _promptIdProps: PromptIdProps
    }
  > {
    const promptPath = this._createPromptPath({
      prompt,
      environment: environment ?? "production",
      version,
    })

    const res = await fetch(promptPath, {
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt config payload: ${res.status} ${await res.text()}`,
      )
    }

    const payload = await res.json()

    Object.defineProperty(payload, "_promptIdProps", {
      value: {
        prompt,
        environment,
        version,
      },
      writable: false,
      enumerable: false,
      configurable: false,
    })

    return payload
  }

  build(
    completionConfig: PlaygroundState & {
      _promptIdProps: PromptIdProps
    },
    parsedBody: OpenAiBodyType,
  ): IPromptObject {
    const openAiBody = getOpenAIBody(completionConfig, parsedBody)
    return {
      _promptIdProps: completionConfig._promptIdProps,
      promptConfig: completionConfig,
      variables: parsedBody.variables,
      toOpenAI: () => openAiBody,
    }
  }

  completions = {
    create: async (prompt: IPromptObject) => {
      const openAI = new OpenAI({
        apiKey: this.openAIKey,
      })

      const openAIBody = prompt.toOpenAI()

      const startedAt = new Date()

      let finishedAt: Date | null = null
      if (openAIBody.stream) {
        const completionResponse =
          await openAI.chat.completions.create(openAIBody)

        const [streamForMeasuringDuration, streamToReturn] =
          completionResponse.tee()

        ;(async () => {
          const data: ChatCompletionChunk[] = []
          for await (const part of streamForMeasuringDuration) {
            data.push(part)
          }
          finishedAt = new Date()

          void this._record(prompt._promptIdProps, prompt.toOpenAI(), {
            // @ts-expect-error
            data: data,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            status: 200,
            error: null,
          })
        })()
        return streamToReturn
      } else {
        const completionResponse = await openAI.chat.completions
          .create(openAIBody)
          .asResponse()
        finishedAt = new Date()

        const data =
          completionResponse.status > 299
            ? null
            : await completionResponse.json()
        void this._record(prompt._promptIdProps, prompt.toOpenAI(), {
          data: data,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          status: completionResponse.status,
          error:
            completionResponse.status > 299
              ? await completionResponse.json()
              : null,
        })
        return data
      }
    },
  }

  async _record(
    promptConfig: IPromptIdProps,
    input: OpenAiBodyType,
    response: OpenAIResponseType,
    metadata?: Record<string, string>,
  ) {
    const path = this._createPromptPath({
      prompt: promptConfig.prompt,
      version: promptConfig.version,
      environment: promptConfig.environment ?? "production",
    })
    const promptPath = promptConfig.version
      ? path.replace("?", "/log?")
      : path + "/log"

    const payload: LogDataType = {
      input,
      openAIResponse: response,
    }

    const res = await fetch(promptPath, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json",
        ...this.formatMetadataHeaders(metadata),
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(
        `Failed to record prompt: ${res.status} ${await res.text()}`,
      )
    }
  }
}
