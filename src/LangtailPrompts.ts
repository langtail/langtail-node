import type {
  ChatCompletion,
} from "openai/resources/chat/completions"
import type { ChatCompletionChunk } from "openai/resources/chat/completions"
import type { Fetch } from "openai/core"

import { Stream } from "openai/streaming"
import { ILangtailExtraProps } from "./schemas"
import { userAgent } from "./userAgent"
import queryString from "query-string"
import { OpenAiBodyType, Deployment, PlaygroundState } from "./schemas"
import { Environment, PromptOptions, PromptSlug, Version, LangtailEnvironment, Variables, PublicAPI } from "./types"

interface LangtailPromptVariables { } // TODO use this when generating schema for deployed prompts

export { LangtailEnvironment }

export type StreamResponseType = Stream<ChatCompletionChunk>

export type OpenAIResponseWithHttp = ChatCompletion & {
  httpResponse: Response | globalThis.Response
}

interface CreatePromptPathOptions<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E>> {
  prompt: P,
  environment: E,
  version?: V,
  configGet?: boolean
}

export type Options = {
  apiKey: string
  baseURL?: string | undefined
  workspace?: string | undefined
  project?: string | undefined
  fetch?: Fetch
  onResponse?: (response: ChatCompletion) => void
}

type IPromptIdProps<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = PromptOptions<P, E, V> & ILangtailExtraProps & OpenAiBodyType

export type IRequestParams<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> = IPromptIdProps<P, E, V> & {
  variables?: Variables<P, E, V>
}

export type IRequestParamsStream<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined, S extends boolean | undefined = false> = IRequestParams<P, E, V> & {
  stream?: S
}

export type ILangtailPrompts = PublicAPI<LangtailPrompts>

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

  createPromptPath<P extends PromptSlug, E extends Environment<P> & LangtailEnvironment, V extends Version<P, E>>({
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

  async invoke<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined, S extends boolean = false>({
    prompt,
    environment,
    version,
    doNotRecord,
    metadata,
    stream,
    ...rest
  }: IRequestParamsStream<P, E, V, S>): Promise<S extends true ? StreamResponseType : OpenAIResponseWithHttp> {
    type OutputType = S extends true ? StreamResponseType : OpenAIResponseWithHttp

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
      body: JSON.stringify({ stream: stream === true, ...rest }),
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

    if (stream) {
      if (!res.body) {
        throw new Error("No body in response")
      }
      return Stream.fromSSEResponse(res, new AbortController()) as OutputType
    }

    const result = (await res.json()) as OpenAIResponseWithHttp
    if (this.options.onResponse) {
      this.options.onResponse(result)
    }
    result.httpResponse = res
    return result as OutputType
  }

  async listDeployments<P extends PromptSlug>(): Promise<Deployment<P>[]> {
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
    throw new Error("Deprecated, use getOpenAIBody instead")
  }
}
