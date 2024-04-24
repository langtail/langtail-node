import {
  compileLTTemplate
} from "./chunk-AADRTTL6.mjs";

// src/getOpenAIBody.ts
import { z as z2 } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// src/schemas.ts
import { z } from "zod";
var ContentItemTextSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});
var ContentItemImageSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).default("auto")
  })
});
var ContentArraySchema = z.array(
  z.union([ContentItemTextSchema, ContentItemImageSchema])
);
var FunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.string()
});
var ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: FunctionCallSchema
});
var ToolChoiceSchema = z.union([
  z.literal("auto"),
  z.literal("none"),
  z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string()
    })
  })
]);
var MessageSchema = z.object({
  role: z.union([
    z.literal("assistant"),
    z.literal("user"),
    z.literal("system"),
    z.literal("function"),
    z.literal("tool")
  ]),
  name: z.string().optional(),
  content: ContentArraySchema.or(z.string().nullable()),
  function_call: FunctionCallSchema.optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  tool_call_id: z.string().optional()
});

// src/getOpenAIBody.ts
extendZodWithOpenApi(z2);
var bodyMetadataSchema = z2.record(z2.string().max(64), z2.union([z2.string(), z2.number()])).optional();
var langtailBodySchema = z2.object({
  doNotRecord: z2.boolean().optional().openapi({
    description: "If true, potentially sensitive data like the prompt and response will not be recorded in the logs",
    example: false
  }),
  metadata: bodyMetadataSchema,
  _langtailTestRunId: z2.string().optional(),
  _langtailTestInputId: z2.string().optional()
});
var openAiBodySchema = z2.object({
  stream: z2.boolean().optional().openapi({ example: false }),
  user: z2.string().optional().openapi({
    description: "A unique identifier representing your end-user",
    example: "user_123"
  }),
  seed: z2.number().optional().openapi({
    description: "A seed is used  to generate reproducible results",
    example: 123
  }),
  variables: z2.record(z2.string(), z2.string()).optional(),
  messages: z2.array(MessageSchema).optional().openapi({
    description: "Additional messages to seed the conversation with",
    example: [
      {
        role: "user",
        content: "Hello"
      }
    ]
  })
});
var bothBodySchema = langtailBodySchema.merge(openAiBodySchema);
function getOpenAIBody(completionConfig, parsedBody) {
  const completionArgs = completionConfig.state.args;
  const inputMessages = [
    ...completionConfig.state.template.map((item) => {
      const needsCompilation = typeof item.content === "string" ? item.content?.includes("{{") : true;
      return {
        ...item,
        content: item.content && (needsCompilation ? compileLTTemplate(
          item.content,
          parsedBody.variables
        ) : item.content)
      };
    }),
    ...parsedBody.messages ?? []
  ];
  const openAIbody = {
    model: completionArgs.model,
    max_tokens: completionArgs.max_tokens == -1 ? void 0 : completionArgs.max_tokens,
    temperature: completionArgs.temperature,
    // @ts-expect-error
    messages: inputMessages,
    top_p: completionArgs.top_p,
    presence_penalty: completionArgs.presence_penalty,
    frequency_penalty: completionArgs.frequency_penalty,
    ...completionArgs.jsonmode ? {
      response_format: {
        type: "json_object"
      }
    } : {},
    ...parsedBody.seed || completionArgs.seed ? {
      seed: parsedBody.seed ?? completionArgs.seed
    } : {},
    ...Array.isArray(completionArgs.stop) && completionArgs.stop.length > 0 ? { stop: completionArgs.stop } : {}
  };
  if (completionConfig.state.functions && completionConfig.state.functions.length > 0) {
    openAIbody.functions = completionConfig.state.functions;
  }
  if (completionConfig.state.tools && completionConfig.state.tools.length > 0) {
    openAIbody.tools = completionConfig.state.tools.map((tool) => {
      const { id: _, ...rest } = tool.function;
      return { ...tool, function: rest };
    });
  }
  return openAIbody;
}

export {
  bodyMetadataSchema,
  langtailBodySchema,
  openAiBodySchema,
  bothBodySchema,
  getOpenAIBody
};
//# sourceMappingURL=chunk-KLLTR5Q2.mjs.map