import { deleteEntitySchema, ThreadCreate, threadListResponseSchema, threadSchema } from "./schemas"
import { ILangtailMessages, LangtailMessages } from "./LangtailMessages";
import { IFetcher, LangtailThreadsOptions, PaginationOptions, PublicAPI } from "./types";
import { paginationParamsToQuery } from "./bin/utils";

export type ILangtailThreads = PublicAPI<LangtailThreads>


export class LangtailThreads {
  fetcher: IFetcher
  apiVersion: NonNullable<LangtailThreadsOptions["apiVersion"]> = '/v2/'
  messages: ILangtailMessages


  constructor(fetcher: IFetcher, options: LangtailThreadsOptions = {}) {
    this.fetcher = fetcher
    this.messages = new LangtailMessages(fetcher, options)

    if (options.apiVersion) {
      this.apiVersion = options.apiVersion
    }
  }

  list(paginationOptions: PaginationOptions = {}) {
    return this.fetcher.fetch(`${this.apiVersion}threads${paginationParamsToQuery(paginationOptions)}`).then(res => res.json()).then(threadListResponseSchema.parse)
  }

  retrieve(threadId: string) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}`).then(res => res.json()).then(threadSchema.parse)
  }

  del(threadId: string) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}`, { method: 'DELETE' }).then(res => res.json()).then(deleteEntitySchema.parse)
  }

  create(threadData?: ThreadCreate) {
    return this.fetcher.fetch(`${this.apiVersion}threads`, {
      method: 'POST', body: JSON.stringify({
        createLog: threadData?.createLog ?? {},
        metadata: threadData?.metadata ?? {}
      })
    }).then(res => res.json()).then(threadSchema.parse)
  }

  update(threadId: string, metadata: Record<string, any>) {
    return this.fetcher.fetch(`${this.apiVersion}threads/${threadId}`, {
      method: 'POST',
      body: JSON.stringify({ metadata })
    }).then(res => res.json()).then(threadSchema.parse)
  }
}
