import "dotenv-flow/config"
import { describe, expect, it, vi } from "vitest"

import { LangtailThreads } from "./LangtailThreads"

describe("LangtailThreads", () => {
  it("should list thread messages with correct URL and parameters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        object: 'list',
        data: [],
        first_id: 'thread_1',
        last_id: 'thread_2',
        has_more: false
      }),
    })
    const ltWithMock = new LangtailThreads({
      fetch: mockFetch,
    })

    await ltWithMock.list()

    expect(mockFetch).toHaveBeenCalledWith(
      "/v2/threads",
    )
  })
})
