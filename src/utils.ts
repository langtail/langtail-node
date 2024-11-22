export const paginationParamsToQuery = (paginationOptions: { after?: string, limit?: number }): string => {
  if (Object.values(paginationOptions ?? {}).every(value => value === undefined)) {
    return '';
  }

  return `?${Object.entries(paginationOptions).reduce((params: URLSearchParams, [key, value]) => {
    params.set(key, String(value))
    return params
  }, new URLSearchParams()).toString()}`
}