import { ILangtailExtraProps } from '../LangtailNode';
import { PromptSlug, Environment, Version } from '../types';
import { OpenAiBodyType } from '../getOpenAIBody';

export interface LangtailChatSettings<P extends PromptSlug, E extends Environment<P> = undefined, V extends Version<P, E> = undefined> extends ILangtailExtraProps, OpenAiBodyType {
  environment?: E;
  version?: V;
  variables?: Record<string, any>
}
