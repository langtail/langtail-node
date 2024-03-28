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
  baseURL: () => baseURL
});
module.exports = __toCommonJS(LangtailNode_exports);
var import_openai = __toESM(require("openai"));

// src/LangtailCompletion.ts
var import_undici = require("undici");
var import_streaming = require("openai/streaming");
var LangtailCompletion = class {
  constructor(options) {
    const { apiKey, baseURL: baseUrl } = options;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.langtail.com";
    this.options = options;
  }
  createPromptPath(prompt, environment) {
    const envPath = typeof environment === "string" ? environment : `${environment.name}/${environment.version}`;
    if (this.options.organization && this.options.project) {
      return `${this.options.organization}/${this.options.project}/${prompt}/${envPath}`;
    }
    if (this.options.project) {
      return `${this.options.project}/${prompt}/${envPath}`;
    }
    const urlPath = `${prompt}/${envPath}`;
    return urlPath.startsWith("/") ? this.baseUrl + urlPath : `${this.baseUrl}/${urlPath}`;
  }
  async request({ prompt, environment, ...rest }) {
    const options = {
      method: "POST",
      headers: { "X-API-Key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ stream: false, ...rest })
    };
    const promptPath = this.createPromptPath(prompt, environment);
    const res = await (0, import_undici.fetch)(promptPath, options);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt: ${res.status} ${await res.text()}`
      );
    }
    if (rest.stream) {
      if (!res.body) {
        throw new Error("No body in response");
      }
      return import_streaming.Stream.fromSSEResponse(res, new AbortController());
    }
    const result = await res.json();
    result.httpResponse = res;
    return result;
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
      apiKey
    };
    console.log(options);
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
    this.completions = new LangtailCompletion({
      apiKey,
      organization: options?.organization,
      project: options?.project
    });
    this.chat = {
      completions: {
        // @ts-expect-error
        create: (params, options2) => {
          if (params.doNotRecord) {
            options2 = options2 ?? {};
            options2.headers = {
              ["x-langtail-do-not-record"]: "true",
              ...options2?.headers
            };
            delete params.doNotRecord;
          }
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
  baseURL
});
//# sourceMappingURL=LangtailNode.js.map