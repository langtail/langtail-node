# Changelog

## 0.16.16

- Add `providerMetadata.langtail.toolCallDiagnostics` to streamed Vercel AI responses so tool-call delta counts, recovery mode, emitted/recovered call counts, and `finish_reason: "tool_calls"` streams without tool-call deltas can be diagnosed from the final stream part.

## 0.16.15

- Fall back to raw buffered args when flush-time tool-call recovery cannot find a parseable JSON prefix (e.g. an unescaped `"` mid-string from `moonshotai/kimi-k2.6`). The synthetic `tool-call` is still emitted so downstream repair (`experimental_repairToolCall`) can fix or re-prompt, instead of silently dropping a tool call the model committed to with `finish_reason: "tool_calls"`.

## 0.16.14

- Recover tool-calls in the Vercel AI bridge when a model emits the closing `}` of tool arguments bundled with trailing junk in the same SSE delta (e.g. `moonshotai/kimi-k2.6`). The flush handler now parses the longest valid JSON prefix of buffered args and emits a synthetic `tool-call` chunk before `finish`.
- Gate tool-call recovery on `finish_reason === "tool_calls"` so streams that end with `stop`, `length`, `error`, etc. no longer synthesize a tool invocation the model never committed to.
- Iterate only populated tool-call entries during flush recovery — adversarial or buggy upstreams sending a large `delta.index` no longer add per-request latency walking sparse array slots.

## 0.16.13

- Add support for `reasoning_content` field in streaming and non-streaming responses (used by Fireworks/Kimi K2.5 and similar providers)

## 0.16.12

- Support adaptive thinking (`thinking: { type: "adaptive" }`) in Vercel AI bridge — no longer sends `max_thinking_tokens` for adaptive models
- Forward `reasoning_effort` from settings to the request body for Claude Opus 4.6 and Sonnet 4.6

## 0.16.11

- Extend `reasoning_effort` to support `"minimal"` and `"max"` values in addition to `"low"`, `"medium"`, and `"high"`

## 0.16.10

- Add rich usage reporting for Vercel AI SDK via `providerMetadata.langtail.usage`
- Exposes `promptTokens`, `completionTokens`, `cachedInputTokens`, `reasoningTokens`, and `rawUsage` (full provider-specific usage data)
- Works with both `generateText` and `streamText`
- Expanded usage schema to support `accepted_prediction_tokens`, `rejected_prediction_tokens`, and `raw_usage` fields
- Backward compatible: existing `providerMetadata.openai` fields are preserved

## 0.16.9

- Added TTL support for Anthropic cache control (`cache_ttl` field)
- Cache control now accepts object format with `ttl` option: `{ type: "ephemeral", ttl: "1h" }`

## 0.16.8

- Add GoogleGeminiV1 to ReasoningFormat and update related tests

## 0.16.7

- Improved shape of reasoning_details values - not using native enum

## 0.16.6

- Add support for reasoning_details (openrouter specific) returned in providerMetadata in the vercel ai sdk provider

## 0.16.5

- Add support for tool results as message type arrays with images in Vercel AI SDK integration
- Tool results can now return rich content arrays containing text and images instead of just strings
- Maintains backward compatibility with existing string-based tool results
- Updated `ChatCompletionToolMessageParam` to support both string and array content types

## 0.16.1

- Add support for message.reasoning in schema

## 0.16.0

- Add simpleHash function to generate unique IDs for tool calls in LangtailChatLanguageModel to prevent collisions, particularly with Google Gemini 2.5
- Update tool call ID logic to incorporate hashed arguments

## 0.15.3

- support null in reasoning (returned by openrouter sometimes)

## 0.15.2

- Fixed streaming support for Claude 3.7 Sonnet reasoning format
- Enhanced Zod schema for reasoning field to handle a wider variety of response formats
- Improved type handling for reasoning in Vercel AI SDK integration

## 0.15.1

- Added cache_enabled support to message schema
- Added Anthropic cache control support to Vercel AI SDK integration
- Updated dependencies: '@ai-sdk/provider' to 1.1.1 and '@ai-sdk/provider-utils' to 2.2.5
- Added 'ai' package as dev dependency
- Added playground examples for Vercel integration with cache control

## 0.15.0

- Fixed reasoning for Claude thinking

## 0.14.2

- Added changes from 0.13.11 and 0.13.10
- Reasoning data support

## 0.14.1

- Fix `finishReason` for Anthropic and Google providers in Vercel AI SDK integration

## 0.14.0

- Update `openai` version
- Fix tool calls issues for Vercel AI SDK integration
- Remove `useChatStream` (moved to separate repo)

## 0.13.11

- Add `max_thinking_tokens` support (Anthropic enhanced thinking)

## 0.13.10

- Add reasoning_effort support

## 0.13.9

- Fix for browser runtime

## 0.13.8

- New Handlebars helpers: last, toJSON, formatMessage (more variants)

## 0.13.7

- Fix react peerDependency version syntax #73

## 0.13.6

- Keep the tool_calls in final message callback #72

# 0.13.5

- Option to append template to the end in `getOpenAIBody`.
- Fix IntelliSense for tools when using Vercel AI SDK.

# 0.13.4

- add parallelToolCalls option to pass it to the API

# 0.13.3

- Support for Langtail hosted tools

# 0.5.4

- Fix: don't send `stop` parameter if it's empty (this causes validation error in OpenAI in some cases)
- Add schemas to entrypoints

# 0.5.3

- Fix CommonJS support
- Add `prompt` parameter to OpenAI proxy

# 0.5.2

- Fix generating quoted variable values with
- BREAKING CHANGE: rename vercelAi -> vercel-ai
- BREAKING CHANGE: rename `LangtailNode` class to `Langtail`
- add `langtail/openai` with `OpenAIProxy` class
- BREAKING CHANGE: remove `Langtail.chat`, use `OpenAIProxy` instead

# 0.5.1

- BREAKING CHANGE: remove `langtail.build` method, use `getOpenAIBody` instead

# 0.5.0

- BREAKING CHANGE: remove `dist/` from import paths

# 0.4.6

- IntelliSense for variables

# 0.4.4

- useChatStream react hook
- export stream helpers `chatStreamToRunner` and `assistantStreamToRunner`

# 0.4.3

- Langtail types generator

# 0.4.2

- list deployments EP
- Langtail tools generator for Vercel AI SDK

# 0.4.1

- remove zod openapi dependency
- internal changes #24

# 0.4.0

- provider for Vercel AI (https://github.com/vercel/ai)

# 0.3.1

- fix next.js compatibility

# 0.3.0

- add ability to `get` and `build` to run langtail prompts without using a proxy

# 0.2.2

- invoke `environment` parameter now defaults to production
- start sending user-agent header #10

# 0.2.1

- Small README update - move short description above CI badges

# 0.2.0

- Rename to just `langtail` NPM package

# 0.1.5

- Fixed an issue when passing `doNotRecord: false` as option, support for metadata fields

# 0.1.4

- Allow Node 18 (engines.node set to >= 18)

# 0.1.3

- First publicly used version 🎉🎉🎉
