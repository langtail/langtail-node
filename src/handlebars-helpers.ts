import type handlebars from "@langtail/handlebars-evalless"
import { format, parseISO } from "date-fns"
import { Message } from "./schemas"

const isObject = function (val: any) {
  return typeof val === "object"
}

const isOptions = function (val: any) {
  return isObject(val) && isObject(val.hash)
}
export const defaultDateFormat = "MMMM dd, yyyy"

const formatDateSafe = function (date: Date, pattern: string) {
  try {
    return format(date, pattern)
  } catch (e) {
    return ""
  }
}

export function handlebarsDateHelper(
  str: string | number | Date | null,
  pattern: any,
  options: any
) {
  if (isOptions(pattern)) {
    options = pattern
    pattern = null
  }

  if (isOptions(str)) {
    options = str
    pattern = null
    str = null
  }

  // if no args are passed, return a formatted date
  if (str == null && pattern == null) {
    return formatDateSafe(new Date(), defaultDateFormat)
  }

  const date = str instanceof Date ? str : new Date(str as string | number)

  // if both args are strings, this could apply to either lib.
  if (typeof str === "string" && typeof pattern === "string") {
    return formatDateSafe(parseISO(str), pattern)
  }

  // if only a string is passed, assume it's a date pattern ('YYYY')
  if (typeof str === "string" && !pattern) {
    return formatDateSafe(new Date(), str)
  }

  return formatDateSafe(date, pattern)
}

export const operatorHelpers: handlebars.HelperDeclareSpec = {
  eq: (v1, v2) => v1 == v2,
  ne: (v1, v2) => v1 != v2,
  lt: (v1, v2) => v1 < v2,
  gt: (v1, v2) => v1 > v2,
  lte: (v1, v2) => v1 <= v2,
  gte: (v1, v2) => v1 >= v2,
  and() {
    return Array.prototype.every.call(arguments, Boolean)
  },
  or() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean)
  },
}

const formatMessage = (message: Message, includeToolCalls: boolean): string => {
  if (!message) return '';

  let result = `[${message.role}] `;

  if (message.content) {
    result += message.content;
  }

  if (includeToolCalls && message.tool_calls?.length) {
    result += '\nTool Calls:';
    for (const tool of message.tool_calls) {
      result += `\n  - ${tool.function.name}(${tool.function.arguments})`;
    }
  }

  return result;
};

const formatMessages = (messages: Message[], includeToolCalls: boolean): string => {
  if (!Array.isArray(messages)) return '';
  return messages.map((m) => formatMessage(m, includeToolCalls)).join('\n\n');
};

export const variableHelpers: handlebars.HelperDeclareSpec = {
  toJSON: function (context) {
    return JSON.stringify(context, null, 2);
  },
  last: function (array) {
    if (Array.isArray(array) && array.length > 0) {
      return array[array.length - 1];
    }
    return null;
  },
  formatMessage: (message: Message) => formatMessage(message, false),
  formatMessages: (messages: Message[]) => formatMessages(messages, false),
  formatMessageWithToolCalls: (message: Message) => formatMessage(message, true),
  formatMessagesWithToolCalls: (messages: Message[]) => formatMessages(messages, true),
}
