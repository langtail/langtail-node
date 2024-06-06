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


## Vercel AI provider

You can use Langtail with [Vercel AI SDK](https://github.com/vercel/ai).
Import `langtail` from `langtail/dist/vercelAi` and provide your prompt slug as an argument.
```typescript
import { generateText } from 'ai'
import { langtail } from 'langtail/dist/vercelAi'

async function main() {
  const result = await generateText({
    // API key is loaded from env variable LANGTAIL_API_KEY
    model: langtail('stock-simple', {
      // Optional Langtail options:
      variables: { 'ticker': 'TSLA' },
      environment: "production",
      version: "2",
      doNotRecord: false,
      metadata: {},
    }),
    // Optional LLM options:
    prompt: 'show me the price',
    temperature: 0,  // overrides setting in Langtail
  })

  console.log(result.text)
}

main().catch(console.error);
```

You can also use `aiBridge` from `langtail/dist/vercelAi` to use already existing Langtail instance:
```typescript
const langtail = new Langtail({ apiKey })
const lt = aiBridge(langtail)

const result = await generateText({
  model: lt('stock-simple', {
    variables: { 'ticker': 'TSLA' },
  }),
  prompt: 'show me the price',
})
```

### Using tools from Langtail

If your prompts in Langtail contain tools, you can generate a file containing tool parameters for every prompt deployment in your project. Run `npx langtail generate-tools --out [output_filepath]` to generate the file.

After the file is generated, you can provide the Langtail tools to AI SDK like this:
```typescript
import { generateText } from 'ai'
import { langtail } from 'langtail/dist/vercelAi'
import tools from './langtailTools';  // generated langtailTools.ts file

const ltModel = langtail('stock-simple',
  {
    environment: "production",
    version: "3"  // pinning the version is recommended
  }
);
const result = await generateText({
  model: ltModel,
  prompt: 'Show me the current price!',
  tools: tools(ltModel),  // loads all the tools for the specified prompt version
});
```

You can also define custom execute functions for your tools as follows:
```typescript
tools(ltModel, {
  get_current_stock_price: {
    execute: async ({ ticker }) => {
      return ({
        ticker,
        price: 200 + Math.floor(Math.random() * 50),
      });
    },
  },
})
```