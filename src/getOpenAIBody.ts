
import type OpenAI from "openai"

import { compileLTTemplate } from "./template"
import { ChatCompletionsCreateParams, PlaygroundMessage } from "./schemas"
import { IncomingBodyType, PlaygroundState } from "./schemas"
import { ChatCompletionMessageParam } from "openai/resources"

function compileMessages(
  messages: PlaygroundMessage[],
  variables: Record<string, any>,
): ChatCompletionMessageParam[] {
  return messages.map((item) => {
    const needsCompilation =
      typeof item.content === "string" ? item.content?.includes("{{") : true

    return {
      ...item,
      content:
        item.content &&
        (needsCompilation
          ? compileLTTemplate(item.content, variables)
          : item.content),
    } as ChatCompletionMessageParam
  })
}

/**
 * Get the body for the OpenAI API request. Used in the langtail prompt API. // TODO remove this from our prompt-API when this is merged so that we don't have this code duplicated
 */
export function getOpenAIBody(
  completionConfig: PlaygroundState,
  parsedBody: IncomingBodyType,
  threadParams?: {
    threadMessages?: PlaygroundMessage[]
  }
): ChatCompletionsCreateParams {
  const completionArgs = completionConfig.state.args

  const template = parsedBody.template ?? completionConfig.state.template
  const inputMessages = [
    ...compileMessages(template, Object.assign(
      completionConfig.chatInput,
      parsedBody.variables ?? {},
    )),
    ...[...(threadParams?.threadMessages ?? []) as ChatCompletionMessageParam[]],
    ...(parsedBody.messages ?? []) as ChatCompletionMessageParam[]
  ]

  const openAIbody: OpenAI.Chat.ChatCompletionCreateParams = {
    model: parsedBody.model ?? completionArgs.model,
    temperature: parsedBody.temperature ?? completionArgs.temperature,
    messages: inputMessages,
    top_p: parsedBody.top_p ?? completionArgs.top_p,
    presence_penalty:
      parsedBody.presence_penalty ?? completionArgs.presence_penalty,
    frequency_penalty:
      parsedBody.frequency_penalty ?? completionArgs.frequency_penalty,
    ...(parsedBody.seed || completionArgs.seed
      ? {
        seed: parsedBody.seed ?? completionArgs.seed,
      }
      : {}),
    ...(Array.isArray(completionArgs.stop) && completionArgs.stop.length > 0
      ? { stop: completionArgs.stop }
      : {}),
  }

  if (parsedBody.max_tokens || completionArgs.max_tokens) {
    openAIbody.max_tokens = parsedBody.max_tokens ?? completionArgs.max_tokens
    if (openAIbody.max_tokens === -1) {
      delete openAIbody.max_tokens
    }
  }

  if (completionArgs.jsonmode || parsedBody.response_format) {
    openAIbody.response_format = parsedBody.response_format ?? {
      type: "json_object",
    }
  }

  if (parsedBody.stop) {
    openAIbody.stop = parsedBody.stop
  }

  const toolChoice = parsedBody.tool_choice ?? completionArgs.tool_choice
  if (toolChoice) {
    openAIbody.tool_choice = toolChoice
  }

  if (
    completionConfig.state.functions &&
    completionConfig.state.functions.length > 0
  ) {
    openAIbody.functions = completionConfig.state.functions
  }
  if (completionConfig.state.tools && completionConfig.state.tools.length > 0) {
    // Remove tools[0].function.id from the tools array as that is an internal langtail id
    openAIbody.tools = completionConfig.state.tools.map((tool) => {
      const { id: _, ...rest } = tool.function
      return { ...tool, function: rest }
    })
  }
  if (parsedBody.tools) {
    if (parsedBody.tools.length > 0) {
      openAIbody.tools = parsedBody.tools
    } else {
      // replace empty array with undefined to avoid OpenAI API error
      openAIbody.tools = undefined
    }
  }

  if (parsedBody.response_format?.type === "json_object") {
    openAIbody.messages.push({
      role: "system",
      content: "format: JSON",
    })
  }
  return openAIbody as ChatCompletionsCreateParams
}
