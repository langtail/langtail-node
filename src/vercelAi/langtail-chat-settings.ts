import { ILangtailExtraProps } from '../LangtailNode';
import { PromptSlug, Environment, LangtailEnvironment, Version } from '../LangtailPrompts';
import { OpenAiBodyType } from '../getOpenAIBody';

export interface LangtailChatSettings<P extends PromptSlug, E extends Environment<P> = "production", V extends Version<P, E> | undefined = undefined> extends ILangtailExtraProps, OpenAiBodyType {
  environment?: E;
  version?: V;
  variables?: Record<string, any>
}
