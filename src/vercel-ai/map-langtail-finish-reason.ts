import { LanguageModelV1FinishReason } from '@ai-sdk/provider';

export function mapLangtailFinishReason(
  finishReason: string | null | undefined,
  hasToolCalls: boolean,
): LanguageModelV1FinishReason {
  switch (finishReason) {
    // openai:
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'function_call':
    case 'tool_calls':
      return 'tool-calls';
    // anthropic:
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool-calls';
    case 'max_tokens':
      return 'length';
    // google:
    case 'STOP':
      return hasToolCalls ? 'tool-calls' : 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'RECITATION':
    case 'SAFETY':
      return 'content-filter';
    case 'FINISH_REASON_UNSPECIFIED':
    case 'OTHER':
      return 'other';

    default:
      console.warn('Unknown finish reason: ', finishReason);
      return 'unknown';
  }
}
