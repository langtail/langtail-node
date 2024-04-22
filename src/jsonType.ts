export declare type PrimitiveJSONValue =
  | string
  | number
  | boolean
  | undefined
  | null
export declare type JSONValue = PrimitiveJSONValue | JSONArray | JSONObject
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
  [key: string]: JSONValue
}
