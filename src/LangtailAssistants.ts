
import { Environment, PromptSlug, PublicAPI, Version } from './types';
import { IInvokeOptionalCallbacks, ILangtailPrompts, IRequestParamsStream, OpenAIResponseWithHttp, StreamResponseType } from "./LangtailPrompts";


export type ILangtailAssistants = PublicAPI<LangtailAssistants>

export class LangtailAssistants {
  langtailPrompts: ILangtailPrompts

  constructor(langtailPrompts: ILangtailPrompts) {
    this.langtailPrompts = langtailPrompts
  }

  invoke<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined, S extends boolean = false>(options: Omit<IRequestParamsStream<P, E, V, S>, "prompt"> & {
    assistant: P
  }, optionalCallbacks: IInvokeOptionalCallbacks = {}): Promise<S extends true ? StreamResponseType : OpenAIResponseWithHttp> {
    const { assistant, ...rest } = options
    return this.langtailPrompts.invoke<P, E, V, S>({
      ...rest,
      prompt: assistant,
    }, optionalCallbacks)
  }
}
