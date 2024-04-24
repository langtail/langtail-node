interface ChatState {
    type: "chat";
    template: PlaygroundMessage[];
    functions?: Functions[];
    tools?: Tools[];
    args: ModelParameter;
}
type ModelParameter = {
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    stop?: string[];
    presence_penalty: number;
    frequency_penalty: number;
    stream?: boolean;
    jsonmode?: boolean;
    seed?: number | null;
};
interface Functions {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    id?: string;
}
interface Tools {
    type: "function";
    function: Functions;
}
interface ContentItemText {
    type: "text";
    text: string;
}
interface ContentItemImage {
    type: "image_url";
    image_url: {
        url: string;
        detail?: "auto" | "low" | "high";
    };
}
type ContentArray = Array<ContentItemText | ContentItemImage>;
interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
interface Message {
    role: "assistant" | "user" | "system" | "function" | "tool";
    name?: string;
    content: string | ContentArray | null;
    function_call?: {
        name: string;
        arguments: string;
    };
    tool_calls?: ToolCall[];
    tool_choice?: {
        type: "function";
        function: {
            name: string;
        };
    } | "auto" | "none";
    tool_call_id?: string;
    hash?: string;
}
interface PlaygroundMessage extends Message {
    pending?: boolean;
    error?: unknown;
}
interface PlaygroundState {
    state: ChatState;
    chatInput: Record<string, string>;
}

export type { ContentArray as C, PlaygroundState as P, ContentItemImage as a };
