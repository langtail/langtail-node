import { describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useChatStream } from "./useChatStream"

describe("useAIStream", () => {
  describe("public API", () => {
    it("should pass paramters of send() to the createReadableStream()", async () => {
      const mockedStream = new ReadableStream()

      const createReadableStream = vi.fn((parameter: string) => {
        expect(parameter).toEqual(expectedParameter)
        return Promise.resolve(mockedStream)
      })

      const expectedParameter = "hello"
      const { result } = renderHook(() => useChatStream({ fetcher: createReadableStream }))

      act(() => {
        result.current.send(expectedParameter)
      })

      await vi.waitFor(() => {
        expect(createReadableStream).toHaveBeenCalledTimes(1)
      })
    })

    it("should call createReadableStream() as many times as send() is called", async () => {
      const createReadableStream = vi.fn(() => {
        return Promise.resolve(new ReadableStream())
      })

      const { result } = renderHook(() => useChatStream({ fetcher: createReadableStream }))

      act(() => {
        result.current.send('')
        result.current.send('')
        result.current.send('')
      })

      await vi.waitFor(() => {
        expect(createReadableStream).toHaveBeenCalledTimes(3)
      })
    })

    it.only("should call trigger that stream was aborted when abort() is called", async () => {
      const abortAgent = vi.fn()
      const createReadableStream = vi.fn(() => {
        return Promise.resolve(new ReadableStream())
      })

      const { result } = renderHook(() =>
        useChatStream({
          fetcher: createReadableStream,
          onAbort: abortAgent,
        }),
      )

      act(() => {
        result.current.send('')
      })

      await vi.waitFor(() => {
        expect(createReadableStream).toHaveBeenCalledTimes(1)
        result.current.abort()
        expect(abortAgent).toHaveBeenCalledTimes(1)
      })
    })
  })
})
