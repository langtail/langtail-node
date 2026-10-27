/**
 * End an SSE response at the protocol's [DONE] event, even if the HTTP
 * connection stays open. Only SSE framing is inspected; payloads are neither
 * parsed as JSON nor retained. Cancellation must not delay downstream EOF.
 */
export function closeOnSseDone(
  source: ReadableStream<Uint8Array | string>,
): ReadableStream<Uint8Array> {
  const reader = source.getReader()
  const encoder = new TextEncoder()
  let line = ""
  let longLine = false
  let data: string | undefined
  let afterCr = false
  let finished = false

  function endLine() {
    if (!line && !longLine) {
      const done = data === "[DONE]"
      data = undefined
      return done
    }
    if (line === "data" || line.startsWith("data:")) {
      // Multiple data fields are joined with newlines in SSE, so they cannot
      // masquerade as the single-line terminal event.
      const value = line.slice(5).replace(/^ /, "")
      data = data === undefined && !longLine ? value : "not-done"
    }
    line = ""
    longLine = false
    return false
  }

  function terminalOffset(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!
      if (afterCr && byte === 10) {
        afterCr = false
        continue
      }
      afterCr = byte === 13
      if (byte === 10 || byte === 13) {
        if (endLine()) return i + 1
      } else if (line.length < 12) {
        line += String.fromCharCode(byte)
      } else {
        longLine = true
      }
    }
    return undefined
  }

  function cancelUpstream(reason?: unknown) {
    // Some sources do not settle their cancellation promise promptly. Closing
    // the consumer must not wait for them, but always observe cancellation errors.
    void reader
      .cancel(reason)
      .catch(() => {})
      .finally(() => reader.releaseLock())
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return
      try {
        const result = await reader.read()
        if (finished) return
        if (result.done) {
          finished = true
          reader.releaseLock()
          controller.close()
          return
        }
        const bytes =
          typeof result.value === "string"
            ? encoder.encode(result.value)
            : result.value
        const end = terminalOffset(bytes)
        controller.enqueue(end === undefined ? bytes : bytes.slice(0, end))
        if (end !== undefined) {
          finished = true
          controller.close()
          cancelUpstream()
        }
      } catch (error) {
        if (!finished) {
          finished = true
          reader.releaseLock()
          controller.error(error)
        }
      }
    },
    cancel(reason) {
      finished = true
      cancelUpstream(reason)
    },
  })
}
