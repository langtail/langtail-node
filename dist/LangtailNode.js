"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/LangtailNode.ts
var LangtailNode_exports = {};
__export(LangtailNode_exports, {
  Langtail: () => LangtailNode,
  LangtailNode: () => LangtailNode,
  LangtailPrompts: () => LangtailPrompts,
  baseURL: () => baseURL
});
module.exports = __toCommonJS(LangtailNode_exports);
var import_openai = __toESM(require("openai"));

// src/LangtailPrompts.ts
var import_streaming = require("openai/streaming");

// package.json
var package_default = {
  name: "langtail",
  version: "0.3.0-beta.1",
  description: "",
  main: "./dist/LangtailNode.js",
  packageManager: "pnpm@8.15.6",
  engines: {
    node: ">=18"
  },
  scripts: {
    test: "vitest",
    ts: "tsc --noEmit",
    format: "prettier --write .",
    build: "tsup",
    prepublishOnly: "pnpm run build"
  },
  keywords: [
    "openai",
    "langtail",
    "nlp",
    "ai",
    "natural language processing",
    "gpt-3",
    "gpt-4",
    "anthropic"
  ],
  authors: [
    "Langtail <hi@langtail.com>"
  ],
  license: "MIT",
  devDependencies: {
    "@types/node": "^20.12.7",
    dotenv: "^16.4.5",
    nock: "14.0.0-beta.5",
    prettier: "^3.2.5",
    tsup: "^8.0.2",
    typescript: "^5.4.5",
    vitest: "^1.5.2"
  },
  module: "./dist/LangtailNode.mjs",
  types: "./dist/LangtailNode.d.ts",
  exports: {
    ".": {
      require: "./dist/LangtailNode.js",
      import: "./dist/LangtailNode.mjs",
      types: "./dist/LangtailNode.d.ts"
    }
  },
  files: [
    "dist",
    "src"
  ],
  dependencies: {
    "@asteasolutions/zod-to-openapi": "^7.0.0",
    "@langtail/handlebars-evalless": "^0.0.1",
    "date-fns": "^3.6.0",
    handlebars: "^4.7.8",
    openai: "^4.38.5",
    "query-string": "^9.0.0",
    zod: "^3.23.4"
  },
  tsup: {
    dts: true,
    sourcemap: true,
    format: [
      "cjs",
      "esm"
    ],
    clean: true,
    entryPoints: [
      "src/LangtailNode.ts",
      "src/template.ts",
      "src/getOpenAIBody.ts"
    ]
  }
};

// src/userAgent.ts
var userAgent = `langtail-js-sdk:${package_default.version}`;

// src/LangtailPrompts.ts
var import_query_string = __toESM(require("query-string"));

// src/getOpenAIBody.ts
var import_zod2 = require("zod");
var import_zod_to_openapi = require("@asteasolutions/zod-to-openapi");

// src/schemas.ts
var import_zod = require("zod");
var ContentItemTextSchema = import_zod.z.object({
  type: import_zod.z.literal("text"),
  text: import_zod.z.string()
});
var ContentItemImageSchema = import_zod.z.object({
  type: import_zod.z.literal("image_url"),
  image_url: import_zod.z.object({
    url: import_zod.z.string(),
    detail: import_zod.z.enum(["auto", "low", "high"]).default("auto")
  })
});
var ContentArraySchema = import_zod.z.array(
  import_zod.z.union([ContentItemTextSchema, ContentItemImageSchema])
);
var FunctionCallSchema = import_zod.z.object({
  name: import_zod.z.string(),
  arguments: import_zod.z.string()
});
var ToolCallSchema = import_zod.z.object({
  id: import_zod.z.string(),
  type: import_zod.z.literal("function"),
  function: FunctionCallSchema
});
var ToolChoiceSchema = import_zod.z.union([
  import_zod.z.literal("auto"),
  import_zod.z.literal("none"),
  import_zod.z.object({
    type: import_zod.z.literal("function"),
    function: import_zod.z.object({
      name: import_zod.z.string()
    })
  })
]);
var MessageSchema = import_zod.z.object({
  role: import_zod.z.union([
    import_zod.z.literal("assistant"),
    import_zod.z.literal("user"),
    import_zod.z.literal("system"),
    import_zod.z.literal("function"),
    import_zod.z.literal("tool")
  ]),
  name: import_zod.z.string().optional(),
  content: ContentArraySchema.or(import_zod.z.string().nullable()),
  function_call: FunctionCallSchema.optional(),
  tool_calls: import_zod.z.array(ToolCallSchema).optional(),
  tool_choice: ToolChoiceSchema.optional(),
  tool_call_id: import_zod.z.string().optional()
});

// src/template.ts
var import_handlebars_evalless = __toESM(require("@langtail/handlebars-evalless"));
var import_handlebars = require("handlebars");

// src/handlebars-helpers.ts
var import_date_fns = require("date-fns");
var isObject = function(val) {
  return typeof val === "object";
};
var isOptions = function(val) {
  return isObject(val) && isObject(val.hash);
};
var defaultDateFormat = "MMMM dd, yyyy";
var formatDateSafe = function(date, pattern) {
  try {
    return (0, import_date_fns.format)(date, pattern);
  } catch (e) {
    return "";
  }
};
function handlebarsDateHelper(str, pattern, options) {
  if (isOptions(pattern)) {
    options = pattern;
    pattern = null;
  }
  if (isOptions(str)) {
    options = str;
    pattern = null;
    str = null;
  }
  if (str == null && pattern == null) {
    return formatDateSafe(/* @__PURE__ */ new Date(), defaultDateFormat);
  }
  const date = str instanceof Date ? str : new Date(str);
  if (typeof str === "string" && typeof pattern === "string") {
    return formatDateSafe((0, import_date_fns.parseISO)(str), pattern);
  }
  if (typeof str === "string" && !pattern) {
    return formatDateSafe(/* @__PURE__ */ new Date(), str);
  }
  return formatDateSafe(date, pattern);
}
var operatorHelpers = {
  eq: (v1, v2) => v1 == v2,
  ne: (v1, v2) => v1 != v2,
  lt: (v1, v2) => v1 < v2,
  gt: (v1, v2) => v1 > v2,
  lte: (v1, v2) => v1 <= v2,
  gte: (v1, v2) => v1 >= v2,
  and() {
    return Array.prototype.every.call(arguments, Boolean);
  },
  or() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
  }
};

// src/template.ts
import_handlebars_evalless.default.registerHelper("$date", handlebarsDateHelper);
import_handlebars_evalless.default.registerHelper(operatorHelpers);
var TemplateObject = class {
  constructor(props) {
    this._value = props;
  }
  toString() {
    return JSON.stringify(this._value, null, 2);
  }
};
function castToTemplateObject(value) {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map((item) => castToTemplateObject(item));
    }
    return new TemplateObject(value);
  }
  return value;
}
var compileStringHandlebars = (text, input) => {
  try {
    const preprocessedText = text.replace(/\n?({{else}})\n?/g, "$1").replace(/\n({{\/(if|unless|with)}})/g, "$1");
    const template = import_handlebars_evalless.default.compileAST(preprocessedText, { noEscape: true });
    const parsedInput = {};
    for (const key in input) {
      try {
        const parsed = JSON.parse(input[key]);
        if (typeof parsed === "object" && parsed !== null) {
          if (Array.isArray(parsed)) {
            parsedInput[key] = parsed.map((item) => castToTemplateObject(item));
          } else {
            parsedInput[key] = new TemplateObject(parsed);
          }
        } else {
          parsedInput[key] = input[key];
        }
      } catch {
        parsedInput[key] = input[key];
      }
    }
    const handlebarsOutput = template(parsedInput).replace(/\n$/g, "");
    return {
      text: handlebarsOutput,
      // ideally we would not even encode it, but in handlebars HTML entities encoding cannot be turned off. We could only use triple curly braces
      error: null
    };
  } catch (err) {
    return { text, error: err };
  }
};
var compileLTTemplate = (content, input) => {
  if (content === null) {
    return null;
  }
  if (typeof content === "string") {
    return compileStringHandlebars(content, input).text;
  }
  return content.map((item) => {
    if (item.type === "text") {
      return { ...item, text: compileStringHandlebars(item.text, input).text };
    }
    return item;
  });
};

// src/getOpenAIBody.ts
(0, import_zod_to_openapi.extendZodWithOpenApi)(import_zod2.z);
var bodyMetadataSchema = import_zod2.z.record(import_zod2.z.string().max(64), import_zod2.z.union([import_zod2.z.string(), import_zod2.z.number()])).optional();
var langtailBodySchema = import_zod2.z.object({
  doNotRecord: import_zod2.z.boolean().optional().openapi({
    description: "If true, potentially sensitive data like the prompt and response will not be recorded in the logs",
    example: false
  }),
  metadata: bodyMetadataSchema,
  _langtailTestRunId: import_zod2.z.string().optional(),
  _langtailTestInputId: import_zod2.z.string().optional()
});
var openAiBodySchema = import_zod2.z.object({
  stream: import_zod2.z.boolean().optional().openapi({ example: false }),
  user: import_zod2.z.string().optional().openapi({
    description: "A unique identifier representing your end-user",
    example: "user_123"
  }),
  seed: import_zod2.z.number().optional().openapi({
    description: "A seed is used  to generate reproducible results",
    example: 123
  }),
  variables: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).optional(),
  messages: import_zod2.z.array(MessageSchema).optional().openapi({
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

// src/LangtailPrompts.ts
var LangtailPrompts = class {
  constructor(options) {
    const { apiKey, baseURL: baseUrl } = options;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.langtail.com";
    this.options = options;
  }
  _createPromptPath({
    prompt,
    environment,
    version,
    configGet
  }) {
    if (prompt.includes("/")) {
      throw new Error(
        "prompt should not include / character, either omit workspace/project or use just the prompt name."
      );
    }
    const queryParams = import_query_string.default.stringify({
      v: version,
      "open-ai-completion-config-payload": configGet
    });
    if (this.options.workspace && this.options.project) {
      const url = `${this.baseUrl}/${this.options.workspace}/${this.options.project}/${prompt}/${environment}?${queryParams}`;
      return url;
    }
    if (this.options.project) {
      return `${this.options.project}/${prompt}/${environment}?${queryParams}`;
    }
    const urlPath = `project-prompt/${prompt}/${environment}`;
    return urlPath.startsWith("/") ? this.baseUrl + urlPath + `?${queryParams}` : `${this.baseUrl}/${urlPath}?${queryParams}`;
  }
  async invoke({
    prompt,
    environment,
    doNotRecord,
    metadata,
    ...rest
  }) {
    const metadataHeaders = metadata ? Object.entries(metadata).reduce((acc, [key, value]) => {
      acc[`x-langtail-metadata-${key}`] = value;
      return acc;
    }, {}) : {};
    const fetchInit = {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json",
        "x-langtail-do-not-record": doNotRecord ? "true" : "false",
        ...metadataHeaders
      },
      body: JSON.stringify({ stream: false, ...rest })
    };
    const promptPath = this._createPromptPath({
      prompt,
      environment: environment ?? "production",
      version: rest.version
    });
    let res;
    if (this.options.fetch) {
      res = await this.options.fetch(promptPath, fetchInit);
    } else {
      res = await fetch(promptPath, fetchInit);
    }
    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt: ${res.status} ${await res.text()}`
      );
    }
    if ("stream" in rest && rest.stream) {
      if (!res.body) {
        throw new Error("No body in response");
      }
      return import_streaming.Stream.fromSSEResponse(res, new AbortController());
    }
    const result = await res.json();
    result.httpResponse = res;
    return result;
  }
  async get({
    prompt,
    environment,
    version
  }) {
    const promptPath = this._createPromptPath({ prompt, environment, version });
    const res = await fetch(promptPath, {
      headers: {
        "X-API-Key": this.apiKey,
        "user-agent": userAgent,
        "content-type": "application/json"
      }
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt config payload: ${res.status} ${await res.text()}`
      );
    }
    return res.json();
  }
  build(completionConfig, parsedBody) {
    return getOpenAIBody(completionConfig, parsedBody);
  }
};

// src/LangtailNode.ts
var baseURL = "https://proxy.langtail.com/v1";
var LangtailNode = class {
  constructor(options) {
    const organization = options?.organization;
    const apiKey = options?.apiKey || process.env.LANGTAIL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "apiKey is required. You can pass it as an option or set the LANGTAIL_API_KEY environment variable."
      );
    }
    const optionsToPass = {
      baseURL,
      apiKey,
      fetch: options?.fetch
    };
    const defaultHeaders = {};
    if (options?.doNotRecord) {
      defaultHeaders["x-langtail-do-not-record"] = "true";
    }
    this._open_ai = new import_openai.default({
      defaultHeaders: {
        ...defaultHeaders,
        "x-langtail-organization": organization
      },
      ...optionsToPass
    });
    this.prompts = new LangtailPrompts({
      apiKey,
      workspace: options?.organization,
      project: options?.project
    });
    this.chat = {
      completions: {
        // @ts-expect-error
        create: (params, options2 = {}) => {
          if (params.doNotRecord) {
            options2.headers = {
              ["x-langtail-do-not-record"]: "true",
              "user-agent": userAgent,
              ...options2?.headers
            };
          }
          delete params.doNotRecord;
          if (params.metadata) {
            const metadataHeaders = Object.entries(params.metadata).reduce(
              (acc, [key, value]) => {
                acc[`x-langtail-metadata-${key}`] = value;
                return acc;
              },
              {}
            );
            options2.headers = {
              ...metadataHeaders,
              ...options2?.headers
            };
          }
          delete params.metadata;
          return this._open_ai.chat.completions.create(params, options2);
        }
      }
    };
    return this;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Langtail,
  LangtailNode,
  LangtailPrompts,
  baseURL
});
//# sourceMappingURL=LangtailNode.js.map