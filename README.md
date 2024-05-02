# Langtail SDK

Typescript SDK for Langtail.

[![CI check](https://github.com/langtail/langtail-node/workflows/CI%20check/badge.svg)](https://github.com/langtail/langtail-node/actions?query=workflow:"CI+check")
[![GitHub tag](https://img.shields.io/github/tag/langtail/langtail-node?include_prereleases=&sort=semver&color=blue)](https://github.com/langtail/langtail-node/releases/)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

## Install

```bash
npm i langtail
```

## Usage

### OpenAI chat completion

basic completion without any prompt. This just wraps openAI api and adds a few extra parameters you can use to affect how the request gets logged in langtail.

```ts
import { Langtail } from "langtail"

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

Completion from a deployed prompt can be called with `lt.prompts.invoke`:

```ts
const deployedPromptCompletion = await lt.prompts.invoke({
  prompt: "<PROMPT_SLUG>", // required
  environment: "staging",
  variables: {
    about: "cowboy Bebop",
  },
}) // results in an openAI ChatCompletion
```

Of course this assumes that you have already deployed your prompt to `staging` environment. If not, you will get an error thrown an error: `Error: Failed to fetch prompt: 404 {"error":"Prompt deployment not found"}`

## LangtailPrompts

In case you only need deployed prompts, you can import just `LangtailPrompts` like this:

```ts
import { LangtailPrompts } from "langtail"

const lt = new LangtailPrompts({
  apiKey: "<LANGTAIL_API_KEY>",
})
// usage
const deployedPromptCompletion = await lt.invoke({
  prompt: "<PROMPT_SLUG>",
  environment: "staging",
  variables: {
    about: "cowboy Bebop",
  },
})
```

this way whole `LangtailNode` can get tree shaken away.

You can initialize LangtailPrompts with workspace and project slugs like so:

```ts
import { Langtail } from "langtail"

const lt = new Langtail({
  apiKey: "<LANGTAIL_API_KEY>",
  workspace: "<WORKSPACE_SLUG>",
  project: "<PROJECT_SLUG>",
})
```

which is necessary if your API key is workspace wide. For a project api key this is not necessary.

## Streaming responses

both chat.prompts.create and prompts.invoke support streaming responses. All you need to enable it is `{ stream: true }` flag like this:

```ts
const deployedPromptCompletion = await lt.prompts.invoke({
  prompt: "<PROMPT_SLUG>",
  environment: "staging",
  stream: true, // changes result to be a streaming OpenAI response
}) // results in an openAI Stream<ChatCompletionChunk>
```

Full API reference is in [API.md](API.md)

We support the same [runtimes as OpenAI](https://github.com/openai/openai-node?tab=readme-ov-file#requirements).

### Proxyless usage

You can avoid langtail API all together by constructing your prompt locally and calling your provider like openAI directly.

let's suppose you have a prompt called `joke-teller` deployed on staging in langtail. You can `get` it's template and all the playground config by calling `get` method like this:

```ts
import { LangtailPrompts } from "langtail"

const lt = new LangtailPrompts({
  apiKey: "<LANGTAIL_API_KEY>",
})

const playgroundState = await lt.get({
  prompt: "<PROMPT_SLUG>",
  environment: "preview",
  version: "<PROMPT_VERSION>", // optional
})
```

`get` will return something like this depending on how your prompt configured when it was deployed:

```
          {
            "chatInput": {
              "optionalExtra": "",
            },
            "state": {
              "args": {
                "frequency_penalty": 0,
                "jsonmode": false,
                "max_tokens": 800,
                "model": "gpt-3.5-turbo",
                "presence_penalty": 0,
                "stop": [],
                "stream": true,
                "temperature": 0.5,
                "top_p": 1,
              },
              "functions": [],
              "template": [
                {
                  "content": "I want you to tell me a joke. Topic of the joke: {{topic}}",
                  "role": "system",
                },
              ],
              "tools": [],
              "type": "chat",
            },
          }
```

render your template and builds the final open AI compatible payload:

```ts
const openAiBody = lt.build(playgroundState, {
  stream: true,
  variables: {
    topic: "iron man",
  },
})
```

openAiBody now contains this object:

```js
{
            "frequency_penalty": 0,
            "max_tokens": 800,
            "messages": [
              {
                "content": "I want you to tell me a joke. Topic of the joke: iron man",
                "role": "system",
              },
            ],
            "model": "gpt-3.5-turbo",
            "presence_penalty": 0,
            "temperature": 0.5,
            "top_p": 1,
          }
```

Notice that your langtail template was replaced with a variable passed in. You can directly call openAI SDK with this object:

```ts
import OpenAI from "openai"

const openai = new OpenAI()

const joke = await openai.chat.completions.create(openAiBody)
```

This way you are still using langtail prompts without exposing potentially sensitive data in your variables.
