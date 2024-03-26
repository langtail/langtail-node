# @langtail/node

langtail node.js SDK

## Install

```bash
npm i @langtail/node
```

## Usage

basic completion without any prompt:

```ts
import { Langtail } from "@langtail/node"

const lt = new Langtail({
  apiKey: "<LANGTAIL_API_KEY>",
  organization: "<ORGANIZATION_SLUG>",
})

const rawCompletion = await lt.chat.completions.create({
  // Required
  messages: [{ role: "system", content: "You are a helpful assistant." }],
  model: "gpt-3.5-turbo",
  // Optional:
  // All OpenAI fields (temperature, top_p, tools,...)
  prompt: "<prompt-slug>",
  doNotRecord: false, // false will ensure logs do not contain any info about payloads. You can still see the request in the logs, but you cannot see the variables etc.
  metadata: {
    "custom-field": 1,
  },
})
```

Completion from an existing prompt can be called like this:

```ts
const deployedPrompCompletion = await lt.completions.request({
  prompt: "<PROJECT_SLUG>/<PROMPT>",
  environment: "staging",
  variables: {
    about: "cowboy Bebop",
  },
}) // results in an openAI ChatCompletion
```

Of course this assumes that you have already deployed your prompt to `staging` environment. If not, you will get an error thrown an error: `Error: Failed to fetch prompt: 404 {"error":"Prompt deployment not found"}`

## Streaming responses

both chat.completions.create and completions.request support streaming responses. All you need to enable it is `{ stream: true }` flag like this:

```ts
const deployedPrompCompletion = await lt.completions.request({
  prompt: "<PROJECT_SLUG>/<PROMPT>",
  environment: "staging",
  stream: true,
}) // results in an openAI ChatCompletion
```
