# @langtail/node

[![CI check](https://github.com/langtail/langtail-node/workflows/CI%20check/badge.svg)](https://github.com/langtail/langtail-node/actions?query=workflow:"CI+check")
[![GitHub tag](https://img.shields.io/github/tag/langtail/langtail-node?include_prereleases=&sort=semver&color=blue)](https://github.com/langtail/langtail-node/releases/)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

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

### Deployed prompts

Completion from a deployed prompt can be called like this:

```ts
const deployedPrompCompletion = await lt.completions.request({
  prompt: "<PROMPT_SLUG>",
  environment: "staging",
  variables: {
    about: "cowboy Bebop",
  },
}) // results in an openAI ChatCompletion
```

Of course this assumes that you have already deployed your prompt to `staging` environment. If not, you will get an error thrown an error: `Error: Failed to fetch prompt: 404 {"error":"Prompt deployment not found"}`

## LangtailCompletion

If you only need deployed prompts, you can import just `LangtailCompletion` like this:

```ts
import { LangtailCompletion } from "@langtail/node"

const lt = new LangtailCompletion({
  apiKey: "<LANGTAIL_API_KEY>"
})
// usage
const deployedPromptCompletion = await lt.request({...})
```

this way whole `LangtailNode` can get tree shaked away.

You can also initialize LangtailCompletion with organization and project slugs like so:

```ts
import { Langtail } from "@langtail/node"

const lt = new Langtail({
  apiKey: "<LANGTAIL_API_KEY>",
  organization: "<ORGANIZATION_SLUG>",
  project: "<PROJECT_SLUG>",
})
```

which is necessary if your API key is organization wide.

## Streaming responses

both chat.completions.create and completions.request support streaming responses. All you need to enable it is `{ stream: true }` flag like this:

```ts
const deployedPrompCompletion = await lt.completions.request({
  prompt: "<PROMPT_SLUG>",
  environment: "staging",
  stream: true,
}) // results in an openAI ChatCompletion
```

Full API reference is in [API.md](API.md)

We support the same [runtimes as OpenAI](https://github.com/openai/openai-node?tab=readme-ov-file#requirements).
