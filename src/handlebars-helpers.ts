import type handlebars from "@langtail/handlebars-evalless"
import { format, parseISO } from "date-fns"

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
