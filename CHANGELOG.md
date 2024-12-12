# Changelog

## 0.14.0

- Update `openai` version
- Fix tool calls issues for Vercel AI SDK integration
- Remove `useChatStream` (moved to separate repo)

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
