import "dotenv-flow/config"
import { describe, expect, it, vi } from "vitest"

import { LangtailThreads } from "./LangtailThreads"
import { createFetcher, ErrorResponse } from "./Langtail"

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

  it("should retrieve a thread with nullable metadata field", async () => {
    const mockThreadId = "thread_123";
    const mockResponse = {
      id: mockThreadId,
      createdAt: "2023-05-01T12:00:00Z",
      projectId: "project_456",
      createLog: {},
      metadata: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const ltWithMock = new LangtailThreads({
      fetch: mockFetch,
    });

    const result = await ltWithMock.retrieve(mockThreadId);

    expect(mockFetch).toHaveBeenCalledWith(`/v2/threads/${mockThreadId}`);
    expect(result).toEqual(mockResponse);
    expect(result.metadata).toBeNull();
  });

  it("should handle a 404 response on retrieve() method and parse the error body", async () => {
    const mockThreadId = "non_existent_thread";
    const mockErrorResponse = {
      error: {
        message: "Thread not found",
        type: "not_found",
        param: null,
        code: null
      }
    };

    const mockFetch = vi.fn().mockRejectedValue(new ErrorResponse(
      "Thread not found",
      404,
      {
        statusText: "Not Found",
        body: mockErrorResponse,
      }
    ));

    const ltWithMock = new LangtailThreads({
      fetch: mockFetch,
    });

    try {
      await ltWithMock.retrieve(mockThreadId);
      // If the promise resolves, fail the test
      expect(true).toBe(false);
    } catch (error: unknown) {
      if (!(error instanceof ErrorResponse)) {
        throw new Error("Test error: This should not be reached");
      }

      expect(error).toBeInstanceOf(ErrorResponse);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Thread not found");
      expect(error.extra_data).toEqual({
        statusText: "Not Found",
        body: mockErrorResponse,
      });
    }

    expect(mockFetch).toHaveBeenCalledWith(`/v2/threads/${mockThreadId}`);
  });


  describe("update", () => {
    it("should update a thread with correct URL and parameters", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "thread_123",
          createdAt: "2023-05-01T12:00:00Z",
          projectId: "project_456",
          createLog: {},
          metadata: {}
        }),
      });

      const ltWithMock = new LangtailThreads({
        fetch: mockFetch,
      });

      const result = await ltWithMock.update("thread_123", { customField: "testValue" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/v2/threads/thread_123",
        {
          method: 'POST',
          body: JSON.stringify({ metadata: { customField: "testValue" } })
        }
      );
    });
  });

  describe("create", () => {
    it("should create a thread with correct URL and parameters", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "thread_123",
          createdAt: "2023-05-01T12:00:00Z",
          projectId: "project_456",
          createLog: {},
          metadata: {}
        }),
      });

      const ltWithMock = new LangtailThreads({
        fetch: mockFetch,
      });

      await ltWithMock.create()

      expect(mockFetch).toHaveBeenCalledWith(
        "/v2/threads",
        {
          method: 'POST',
          body: JSON.stringify({ createLog: {}, metadata: {} })
        }
      );
    });


    it("should create a thread with metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "thread_789",
          createdAt: "2023-05-02T14:30:00Z",
          projectId: "project_101",
          createLog: {},
          metadata: { customField: "testValue" }
        }),
      });

      const ltWithMock = new LangtailThreads({
        fetch: mockFetch,
      });

      await ltWithMock.create({
        metadata: { customField: "testValue" }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/v2/threads",
        {
          method: 'POST',
          body: JSON.stringify({ createLog: {}, metadata: { customField: "testValue" } })
        }
      );
    });

    it("should create a thread with createLog", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "thread_789",
          createdAt: "2023-05-02T14:30:00Z",
          projectId: "project_101",
          createLog: { customField: "testValue" },
          metadata: {}
        }),
      });

      const ltWithMock = new LangtailThreads({
        fetch: mockFetch,
      });

      await ltWithMock.create({
        createLog: { user: "test-user-id" }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/v2/threads",
        {
          method: 'POST',
          body: JSON.stringify({ createLog: { user: "test-user-id" }, metadata: {} })
        }
      );
    });
  });

  describe("createFetcher", () => {
    it("should reject with ErrorResponse when createFetcher receives an error", async () => {
      const mockBaseUrl = "https://api.example.com";
      const mockApiKey = "test_api_key";
      const mockErrorResponse = {
        error: {
          message: "Invalid API key",
          type: "authentication_error",
          param: null,
          code: null
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve(mockErrorResponse)
      });

      const fetcher = createFetcher(mockBaseUrl, mockApiKey);

      try {
        await fetcher.fetch("/test-endpoint");
        // If the promise resolves, fail the test
        expect(true).toBe(false);
      } catch (error) {
        if (!(error instanceof ErrorResponse)) {
          throw new Error("Test error: This should not be reached");
        }
        expect(error).toBeInstanceOf(ErrorResponse);
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe("Invalid API key");
        expect(error.extra_data).toEqual({
          statusText: "Unauthorized",
          body: mockErrorResponse,
        });
      }

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/test-endpoint`,
        expect.objectContaining({
          headers: {
            "Authorization": `Bearer ${mockApiKey}`,
            "Content-Type": "application/json",
          },
        })
      );
    });
  });
})
