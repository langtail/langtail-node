import OpenAI from 'openai';
import { z } from 'zod';
import { P as PlaygroundState } from './schemas-BCLbcYMU.js';

declare const bodyMetadataSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
declare const langtailBodySchema: z.ZodObject<{
    doNotRecord: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    _langtailTestRunId: z.ZodOptional<z.ZodString>;
    _langtailTestInputId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    doNotRecord?: boolean | undefined;
    metadata?: Record<string, string | number> | undefined;
    _langtailTestRunId?: string | undefined;
    _langtailTestInputId?: string | undefined;
}, {
    doNotRecord?: boolean | undefined;
    metadata?: Record<string, string | number> | undefined;
    _langtailTestRunId?: string | undefined;
    _langtailTestInputId?: string | undefined;
}>;
declare const openAiBodySchema: z.ZodObject<{
    stream: z.ZodOptional<z.ZodBoolean>;
    user: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    messages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodUnion<[z.ZodLiteral<"assistant">, z.ZodLiteral<"user">, z.ZodLiteral<"system">, z.ZodLiteral<"function">, z.ZodLiteral<"tool">]>;
        name: z.ZodOptional<z.ZodString>;
        content: z.ZodUnion<[z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            type: "text";
        }, {
            text: string;
            type: "text";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"image_url">;
            image_url: z.ZodObject<{
                url: z.ZodString;
                detail: z.ZodDefault<z.ZodEnum<["auto", "low", "high"]>>;
            }, "strip", z.ZodTypeAny, {
                url: string;
                detail: "auto" | "low" | "high";
            }, {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        }, {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        }>]>, "many">, z.ZodNullable<z.ZodString>]>;
        function_call: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            arguments: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            arguments: string;
        }, {
            name: string;
            arguments: string;
        }>>;
        tool_calls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodLiteral<"function">;
            function: z.ZodObject<{
                name: z.ZodString;
                arguments: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                arguments: string;
            }, {
                name: string;
                arguments: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }, {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }>, "many">>;
        tool_choice: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"auto">, z.ZodLiteral<"none">, z.ZodObject<{
            type: z.ZodLiteral<"function">;
            function: z.ZodObject<{
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
            }, {
                name: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            function: {
                name: string;
            };
            type: "function";
        }, {
            function: {
                name: string;
            };
            type: "function";
        }>]>>;
        tool_call_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }, {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    stream?: boolean | undefined;
    messages?: {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }[] | undefined;
    seed?: number | undefined;
    user?: string | undefined;
    variables?: Record<string, string> | undefined;
}, {
    stream?: boolean | undefined;
    messages?: {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }[] | undefined;
    seed?: number | undefined;
    user?: string | undefined;
    variables?: Record<string, string> | undefined;
}>;
declare const bothBodySchema: z.ZodObject<z.objectUtil.extendShape<{
    doNotRecord: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    _langtailTestRunId: z.ZodOptional<z.ZodString>;
    _langtailTestInputId: z.ZodOptional<z.ZodString>;
}, {
    stream: z.ZodOptional<z.ZodBoolean>;
    user: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    messages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodUnion<[z.ZodLiteral<"assistant">, z.ZodLiteral<"user">, z.ZodLiteral<"system">, z.ZodLiteral<"function">, z.ZodLiteral<"tool">]>;
        name: z.ZodOptional<z.ZodString>;
        content: z.ZodUnion<[z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            type: "text";
        }, {
            text: string;
            type: "text";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"image_url">;
            image_url: z.ZodObject<{
                url: z.ZodString;
                detail: z.ZodDefault<z.ZodEnum<["auto", "low", "high"]>>;
            }, "strip", z.ZodTypeAny, {
                url: string;
                detail: "auto" | "low" | "high";
            }, {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        }, {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        }>]>, "many">, z.ZodNullable<z.ZodString>]>;
        function_call: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            arguments: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            arguments: string;
        }, {
            name: string;
            arguments: string;
        }>>;
        tool_calls: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodLiteral<"function">;
            function: z.ZodObject<{
                name: z.ZodString;
                arguments: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                arguments: string;
            }, {
                name: string;
                arguments: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }, {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }>, "many">>;
        tool_choice: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"auto">, z.ZodLiteral<"none">, z.ZodObject<{
            type: z.ZodLiteral<"function">;
            function: z.ZodObject<{
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
            }, {
                name: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            function: {
                name: string;
            };
            type: "function";
        }, {
            function: {
                name: string;
            };
            type: "function";
        }>]>>;
        tool_call_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }, {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }>, "many">>;
}>, "strip", z.ZodTypeAny, {
    doNotRecord?: boolean | undefined;
    stream?: boolean | undefined;
    messages?: {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail: "auto" | "low" | "high";
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }[] | undefined;
    seed?: number | undefined;
    user?: string | undefined;
    metadata?: Record<string, string | number> | undefined;
    _langtailTestRunId?: string | undefined;
    _langtailTestInputId?: string | undefined;
    variables?: Record<string, string> | undefined;
}, {
    doNotRecord?: boolean | undefined;
    stream?: boolean | undefined;
    messages?: {
        content: string | ({
            text: string;
            type: "text";
        } | {
            image_url: {
                url: string;
                detail?: "auto" | "low" | "high" | undefined;
            };
            type: "image_url";
        })[] | null;
        role: "function" | "user" | "assistant" | "system" | "tool";
        function_call?: {
            name: string;
            arguments: string;
        } | undefined;
        tool_choice?: "auto" | "none" | {
            function: {
                name: string;
            };
            type: "function";
        } | undefined;
        name?: string | undefined;
        tool_calls?: {
            function: {
                name: string;
                arguments: string;
            };
            type: "function";
            id: string;
        }[] | undefined;
        tool_call_id?: string | undefined;
    }[] | undefined;
    seed?: number | undefined;
    user?: string | undefined;
    metadata?: Record<string, string | number> | undefined;
    _langtailTestRunId?: string | undefined;
    _langtailTestInputId?: string | undefined;
    variables?: Record<string, string> | undefined;
}>;
type IncomingBodyType = z.infer<typeof bothBodySchema>;
type OpenAiBodyType = z.infer<typeof openAiBodySchema>;
declare function getOpenAIBody(completionConfig: PlaygroundState, parsedBody: IncomingBodyType): OpenAI.Chat.Completions.ChatCompletionCreateParams;
type ChatCompletionCreateParams = OpenAI.Chat.ChatCompletionCreateParams;

export { type ChatCompletionCreateParams, type IncomingBodyType, type OpenAiBodyType, bodyMetadataSchema, bothBodySchema, getOpenAIBody, langtailBodySchema, openAiBodySchema };
