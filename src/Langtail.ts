import { Fetch } from "openai/core"
import { ILangtailAssistants, LangtailAssistants } from "./LangtailAssistants"
import { LangtailPrompts } from "./LangtailPrompts"
import { ILangtailThreads, LangtailThreads } from "./LangtailThreads"
import { LangtailThreadsOptions } from "./types"

export const createFetcher = (baseUrl: string, apiKey: string) => {
  return {
    fetch: async (url: string, options?: RequestInit) => {
      return fetch(`${baseUrl}${url}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...options,
      })
    },
  }
}

export class Langtail {
  prompts: LangtailPrompts
  threads: ILangtailThreads
  assistants: ILangtailAssistants

  constructor(clientOptions?: {
    apiKey: string
    organization?: string
    project?: string
    baseURL?: string
    fetch?: Fetch
  }) {
    const apiKey = clientOptions?.apiKey || process.env.LANGTAIL_API_KEY
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable.",
      )
    }

    const baseURL = clientOptions?.baseURL ?? "https://api.langtail.com"
    const threadsAPIVersion: LangtailThreadsOptions["apiVersion"] = '/v2/'

    this.prompts = new LangtailPrompts({
      apiKey,
      baseURL,
      workspace: clientOptions?.organization,
      project: clientOptions?.project,
      fetch: clientOptions?.fetch,
    })

    this.assistants = new LangtailAssistants(this.prompts)

    this.threads = new LangtailThreads(createFetcher(baseURL, apiKey), {
      apiVersion: threadsAPIVersion,
    })

    return this
  }
}

export { LangtailPrompts, LangtailThreads, LangtailAssistants }
