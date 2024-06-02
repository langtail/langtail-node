import { IRequestParams, LangtailEnvironment } from '../LangtailPrompts';

export interface LangtailChatSettings<E extends LangtailEnvironment = "production", V extends string = "default"> extends Omit<IRequestParams, 'prompt'> {
  environment?: E;
  version?: V;
}
