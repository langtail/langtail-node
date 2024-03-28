// src/LangtailNode.ts
import OpenAI from "openai";

// src/LangtailCompletion.ts
import { fetch } from "undici";
import { Stream } from "openai/streaming";
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
    const res = await fetch(promptPath, options);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch prompt: ${res.status} ${await res.text()}`
      );
    }
    if (rest.stream) {
      if (!res.body) {
        throw new Error("No body in response");
      }
      return Stream.fromSSEResponse(res, new AbortController());
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
    this._open_ai = new OpenAI({
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
export {
  LangtailNode as Langtail,
  LangtailNode,
  baseURL
};
//# sourceMappingURL=LangtailNode.mjs.map