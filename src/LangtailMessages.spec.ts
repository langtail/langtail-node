import "dotenv-flow/config"
import { describe, expect, it, vi } from "vitest"

import { LangtailMessages } from "./LangtailMessages"
import { ErrorResponse } from "./Langtail"

describe("LangtailMessages", () => {
  it("should list thread messages with correct URL and parameters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        object: 'list',
        data: [],
        first_id: 'message_1',
        last_id: 'message_2',
        has_more: false
      }),
    })
    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    })

    const mockThreadId = "thread_123"
    await lmWithMock.list(mockThreadId)

    expect(mockFetch).toHaveBeenCalledWith(
      `/v2/threads/${mockThreadId}/messages`,
    )
  })

  it("should list thread messages with correct data when there are multiple messages", async () => {
    const mockThreadId = "thread_123";
    const mockResponse = {
      object: 'list',
      data: [
        {
          id: 'message_1',
          threadId: mockThreadId,
          createdAt: "2023-05-01T12:00:00Z",
          content: { role: "user", content: "Hello" },
          requestLogId: "log_1",
          metadata: null,
        },
        {
          id: 'message_2',
          threadId: mockThreadId,
          createdAt: "2023-05-01T12:01:00Z",
          content: { role: "assistant", content: "Hi there! How can I help you?" },
          requestLogId: "log_2",
          metadata: null,
        }
      ],
      first_id: 'message_1',
      last_id: 'message_2',
      has_more: false
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.list(mockThreadId);

    expect(mockFetch).toHaveBeenCalledWith(`/v2/threads/${mockThreadId}/messages`);
    expect(result).toEqual(mockResponse);
    expect(result.data.length).toBe(2);
    expect(result.data[0].id).toBe('message_1');
    expect(result.data[1].id).toBe('message_2');
    expect(result.first_id).toBe('message_1');
    expect(result.last_id).toBe('message_2');
    expect(result.has_more).toBe(false);
  });

  it("should retrieve a message with nullable metadata field", async () => {
    const mockThreadId = "thread_123";
    const mockMessageId = "message_456";
    const mockResponse = {
      id: mockMessageId,
      threadId: mockThreadId,
      createdAt: "2023-05-01T12:00:00Z",
      content: { role: "assistant", content: "Hello, how can I help you?" },
      requestLogId: "log_789",
      metadata: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.retrieve(mockThreadId, mockMessageId);

    expect(mockFetch).toHaveBeenCalledWith(`/v2/threads/${mockThreadId}/messages/${mockMessageId}`);
    expect(result).toEqual(mockResponse);
    expect(result.metadata).toBeNull();
  });

  it("should handle a 404 response on retrieve() method and parse the error body", async () => {
    const mockThreadId = "thread_123";
    const mockMessageId = "non_existent_message";
    const mockErrorResponse = {
      error: {
        message: "Message not found",
        type: "not_found",
        param: null,
        code: null
      }
    };

    const mockFetch = vi.fn().mockRejectedValue(new ErrorResponse(
      "Message not found",
      404,
      {
        statusText: "Not Found",
        body: mockErrorResponse,
      }
    ));

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    try {
      await lmWithMock.retrieve(mockThreadId, mockMessageId);
      // If the promise resolves, fail the test
      expect(true).toBe(false);
    } catch (error: unknown) {
      if (!(error instanceof ErrorResponse)) {
        throw new Error("Test error: This should not be reached");
      }

      expect(error).toBeInstanceOf(ErrorResponse);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Message not found");
      expect(error.extra_data).toEqual({
        statusText: "Not Found",
        body: mockErrorResponse,
      });
    }

    expect(mockFetch).toHaveBeenCalledWith(`/v2/threads/${mockThreadId}/messages/${mockMessageId}`);
  });

  it("should delete a message", async () => {
    const mockThreadId = "thread_123";
    const mockMessageId = "message_456";
    const mockResponse = {
      id: mockMessageId,
      object: "message",
      deleted: true,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.del(mockThreadId, mockMessageId);

    expect(mockFetch).toHaveBeenCalledWith(
      `/v2/threads/${mockThreadId}/messages/${mockMessageId}`,
      { method: 'DELETE' }
    );
    expect(result).toEqual(mockResponse);
  });

  it("should update a message's metadata", async () => {
    const mockThreadId = "thread_123";
    const mockMessageId = "message_456";
    const mockMetadata = { key: "value" };
    const mockResponse = {
      id: mockMessageId,
      threadId: mockThreadId,
      createdAt: "2023-05-01T12:00:00Z",
      content: { role: "assistant", content: "Hello, how can I help you?" },
      requestLogId: "log_789",
      metadata: mockMetadata,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.update(mockThreadId, mockMessageId, mockMetadata);

    expect(mockFetch).toHaveBeenCalledWith(
      `/v2/threads/${mockThreadId}/messages/${mockMessageId}`,
      {
        method: 'POST',
        body: JSON.stringify({ metadata: mockMetadata })
      }
    );
    expect(result).toEqual(mockResponse);
    expect(result.metadata).toEqual(mockMetadata);
  });

  it("should retrieve a message with null metadata", async () => {
    const mockThreadId = "thread_123";
    const mockMessageId = "message_456";
    const mockResponse = {
      id: mockMessageId,
      threadId: mockThreadId,
      createdAt: "2023-05-01T12:00:00Z",
      content: { role: "assistant", content: "Hello, how can I help you?" },
      requestLogId: "log_789",
      metadata: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.retrieve(mockThreadId, mockMessageId);

    expect(mockFetch).toHaveBeenCalledWith(
      `/v2/threads/${mockThreadId}/messages/${mockMessageId}`
    );
    expect(result).toEqual(mockResponse);
    expect(result.metadata).toBeNull();
  });

  it("should retrieve a message with null metadata and null requestLogId", async () => {
    const mockThreadId = "thread_789";
    const mockMessageId = "message_012";
    const mockResponse = {
      id: mockMessageId,
      threadId: mockThreadId,
      createdAt: "2023-06-15T10:30:00Z",
      content: { role: "user", content: "What's the weather like today?" },
      requestLogId: null,
      metadata: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const lmWithMock = new LangtailMessages({
      fetch: mockFetch,
    });

    const result = await lmWithMock.retrieve(mockThreadId, mockMessageId);

    expect(mockFetch).toHaveBeenCalledWith(
      `/v2/threads/${mockThreadId}/messages/${mockMessageId}`
    );
    expect(result).toEqual(mockResponse);
    expect(result.metadata).toBeNull();
    expect(result.requestLogId).toBeNull();
  });
})
