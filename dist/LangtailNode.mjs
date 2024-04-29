import {
  getOpenAIBody
} from "./chunk-KLLTR5Q2.mjs";
import "./chunk-AADRTTL6.mjs";

// src/LangtailNode.ts
import OpenAI from "openai";

// src/LangtailPrompts.ts
import { Stream } from "openai/streaming";

// package.json
var package_default = {
  name: "langtail",
  version: "0.3.0-beta.0",
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
import queryString from "query-string";
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
    const queryParams = queryString.stringify({
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
      return Stream.fromSSEResponse(res, new AbortController());
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
    this._open_ai = new OpenAI({
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
export {
  LangtailNode as Langtail,
  LangtailNode,
  LangtailPrompts,
  baseURL
};
//# sourceMappingURL=LangtailNode.mjs.map