import { IRequestParams } from '../LangtailPrompts';

export interface LangtailChatSettings extends Omit<IRequestParams, 'prompt'> { }
