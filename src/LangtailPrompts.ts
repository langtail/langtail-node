import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
} from "openai/resources/chat/completions"
import { ChatCompletionChunk } from "openai/resources/chat/completions"

import { Stream } from "openai/streaming"
import { ILangtailExtraProps } from "./LangtailNode"
import { Fetch } from "openai/core"
import { userAgent } from "./userAgent"
import queryString from "query-string"
import { Deployment, PlaygroundState } from "./schemas"
import { OpenAiBodyType, getOpenAIBody } from "./getOpenAIBody"
import { Environment, PromptOptions, PromptSlug, Version, LangtailEnvironment } from "./types"

interface LangtailPromptVariables { } // TODO use this when generating schema for deployed prompts

export { LangtailEnvironment }

type StreamResponseType = Stream<ChatCompletionChunk>

type OpenAIResponseWithHttp = ChatCompletion & {
  httpResponse: Response | globalThis.Response
}

interface CreatePromptPathOptions<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E> = undefined> {
  prompt: P,
  environment: E,
  version?: V
  configGet?: boolean
}

type Options = {
  apiKey: string
  baseURL?: string | undefined
  workspace?: string | undefined
  project?: string | undefined
  fetch?: Fetch
  onResponse?: (response: ChatCompletion) => void
}

interface IPromptIdProps<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> extends PromptOptions<P, E, V>, ILangtailExtraProps, OpenAiBodyType { }

export interface IRequestParams<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> extends IPromptIdProps<P, E, V> {
  variables?: Record<string, any>
}

interface IRequestParamsStream<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> extends IRequestParams<P, E, V> {
  stream: boolean
}

export class LangtailPrompts {
  apiKey: string
  baseUrl: string
  options: Options

  constructor(options: Options) {
    const { apiKey, baseURL: baseUrl } = options
    this.apiKey = apiKey
    this.baseUrl = baseUrl ?? "https://api.langtail.com"
    this.options = options
  }

  createPromptPath<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E> = undefined>({
    prompt,
    environment,
    version,
    configGet,
  }: CreatePromptPathOptions<P, E, V>) {
    if (prompt.includes("/")) {
      throw new Error(
        "prompt should not include / character, either omit workspace/project or use just the prompt name.",
      )
    }
    const queryParams = queryString.stringify({
      v: version,
      "open-ai-completion-config-payload": configGet,
    })
    const queryParamsString = queryParams ? `?${queryParams}` : ""

    if (this.options.workspace && this.options.project) {
      const url = `${this.baseUrl}/${this.options.workspace}/${this.options.project}/${prompt}/${environment}?${queryParams}`
      // user supplied workspace and project in constructor

      return url
    }

    if (this.options.project) {
      return `${this.options.project}/${prompt}/${environment}${queryParamsString}`
    }

    const urlPath = `project-prompt/${prompt}/${environment}`
    return urlPath.startsWith("/")
      ? this.baseUrl + urlPath + `${queryParamsString}`
      : `${this.baseUrl}/${urlPath}${queryParamsString}`
  }

  invoke<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(
    options: Omit<IRequestParams<P, E, V>, "stream">,
  ): Promise<OpenAIResponseWithHttp>
  invoke<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>(options: IRequestParamsStream<P, E, V>): Promise<StreamResponseType>
  async invoke<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>({
    prompt,
    environment,
    version,
    doNotRecord,
    metadata,
    ...rest
  }: IRequestParams<P, E, V> | IRequestParamsStream<P, E, V>) {
    const metadataHeaders = metadata
      ? Object.entries(metadata).reduce((acc, [key, value]) => {
        acc[`x-langtail-metadata-${key}`] = value
        return acc
      }, {})
      : {}

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
    const promptPath = this.createPromptPath({
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

  async listDeployments<P extends PromptSlug, E extends Environment<P> = Environment<P>, V extends Version<P, E> = Version<P, E>>(): Promise<Deployment<P, E, V>[]> {
    const res = await fetch(`${this.baseUrl}/list-deployments`, {
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json",
      },
    })

    if (!res.ok) {
      throw new Error(
        `Failed to fetch deployments: ${res.status} ${await res.text()}`,
      )
    }

    const responseJson = await res.json()
    return responseJson.deployments
  }

  async get<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined>({
    prompt,
    environment,
    version,
  }: PromptOptions<P, E, V>): Promise<PlaygroundState> {
    const promptPath = this.createPromptPath({
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

    return res.json()
  }

  build(completionConfig: PlaygroundState, parsedBody: OpenAiBodyType) {
    return getOpenAIBody(completionConfig, parsedBody)
  }
}
