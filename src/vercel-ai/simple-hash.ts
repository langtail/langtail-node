export function simpleHash(str: string) {
  let hash = 0;
  // Only process every nth character for very long strings
  const stride = str.length > 10000 ? Math.floor(str.length / 5000) : 1;

  for (let i = 0; i < str.length; i += stride) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash >>> 0; // Convert to unsigned
}