import {
  JSONSchema7,
  LanguageModelV2CallWarning,
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2ToolChoice,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider"

export function prepareTools({
  tools,
  toolChoice,
  structuredOutputs,
}: {
  tools?: Array<
    LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool
  >
  toolChoice?: LanguageModelV2ToolChoice
  structuredOutputs: boolean
}): {
  mappedTools?: {
    type: "function"
    function: {
      name: string
      description: string | undefined
      parameters: JSONSchema7
      strict?: boolean
    }
  }[]
  mappedToolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } }
  toolWarnings: LanguageModelV2CallWarning[]
} {
  // when the tools array is empty, change it to undefined to prevent errors:
  const toolsArray = tools?.length ? tools : undefined

  const toolWarnings: LanguageModelV2CallWarning[] = []

  if (toolsArray == null) {
    return { mappedTools: undefined, mappedToolChoice: undefined, toolWarnings }
  }

  const openaiTools: Array<{
    type: "function"
    function: {
      name: string
      description: string | undefined
      parameters: JSONSchema7
      strict: boolean | undefined
    }
  }> = []

  for (const tool of toolsArray) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool })
    } else {
      // V2 uses inputSchema instead of parameters
      openaiTools.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema as JSONSchema7,
          strict: structuredOutputs ? true : undefined,
        },
      })
    }
  }

  if (toolChoice == null) {
    return {
      mappedTools: openaiTools,
      mappedToolChoice: undefined,
      toolWarnings,
    }
  }

  const type = toolChoice.type

  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { mappedTools: openaiTools, mappedToolChoice: type, toolWarnings }
    case "tool":
      return {
        mappedTools: openaiTools,
        mappedToolChoice: {
          type: "function",
          function: {
            name: toolChoice.toolName,
          },
        },
        toolWarnings,
      }
    default: {
      const _exhaustiveCheck: never = type
      throw new UnsupportedFunctionalityError({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`,
      })
    }
  }
}
