import { C as ContentArray, a as ContentItemImage } from './schemas-BCLbcYMU.mjs';

declare type PrimitiveJSONValue = string | number | boolean | undefined | null;
declare type JSONValue = PrimitiveJSONValue | JSONArray | JSONObject;
interface JSONArray extends Array<JSONValue> {
}
interface JSONObject {
    [key: string]: JSONValue;
}

declare const compileStringHandlebars: (text: string, input: Record<string, JSONValue>) => {
    text: string;
    error: Error | null;
};
declare const compileLTTemplate: (content: string | ContentArray | null, input: Record<string, string>) => string | (ContentItemImage | {
    text: string;
    type: "text";
})[] | null;
declare function extractVariablesForHandlebars(template: string): string[];

export { compileLTTemplate, compileStringHandlebars, extractVariablesForHandlebars };
