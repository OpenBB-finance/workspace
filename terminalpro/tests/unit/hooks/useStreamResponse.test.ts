import { describe, expect, it, vi } from "vitest";

// Test the helper functions that are used in useStreamResponse

describe("useStreamResponse helper functions", () => {
  describe("createFunctionCallMessages", () => {
    const createFunctionCallMessages = (
      dataOrResults: any[],
      functionCallSpec: { function: string; input_arguments: any; extra_state?: any },
    ) => {
      const aiMessage = {
        role: "ai",
        content: JSON.stringify({
          function: functionCallSpec.function,
          input_arguments: functionCallSpec?.input_arguments,
        }),
      };
      const toolMessage = {
        role: "tool",
        function: functionCallSpec.function,
        input_arguments: functionCallSpec?.input_arguments,
        data: dataOrResults,
        extra_state: functionCallSpec?.extra_state,
      };
      return { aiMessage, toolMessage };
    };

    it("should create AI and tool messages for function call", () => {
      const data = [{ result: "test" }];
      const functionCallSpec = {
        function: "get_widget_data",
        input_arguments: { data_sources: ["widget-1"] },
      };

      const result = createFunctionCallMessages(data, functionCallSpec);

      expect(result.aiMessage.role).toBe("ai");
      expect(JSON.parse(result.aiMessage.content)).toEqual({
        function: "get_widget_data",
        input_arguments: { data_sources: ["widget-1"] },
      });

      expect(result.toolMessage.role).toBe("tool");
      expect(result.toolMessage.function).toBe("get_widget_data");
      expect(result.toolMessage.data).toEqual(data);
    });

    it("should include extra_state in tool message", () => {
      const data = [{ result: "test" }];
      const functionCallSpec = {
        function: "assign_tasks_to_agents",
        input_arguments: { task_requests: [] },
        extra_state: { expect_direct_response: true },
      };

      const result = createFunctionCallMessages(data, functionCallSpec);

      expect(result.toolMessage.extra_state).toEqual({ expect_direct_response: true });
    });
  });

  describe("isReadableStream", () => {
    const isReadableStream = <T>(obj: any): obj is ReadableStreamDefaultReader<T> => {
      return !!(obj && typeof obj.read === "function");
    };

    it("should return true for objects with read function", () => {
      const mockReader = { read: vi.fn() };
      expect(isReadableStream(mockReader)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isReadableStream(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isReadableStream(undefined)).toBe(false);
    });

    it("should return false for objects without read function", () => {
      expect(isReadableStream({ write: vi.fn() })).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(isReadableStream("string")).toBe(false);
      expect(isReadableStream(123)).toBe(false);
      expect(isReadableStream(true)).toBe(false);
    });
  });

  describe("getLatestAiToolPairTimestamps", () => {
    const getLatestAiToolPairTimestamps = (messages: any[]): number[] | null => {
      const lastToolIndex = messages.findLastIndex((message) => message.role === "tool");
      if (lastToolIndex === -1) return null;

      const toolMessage = messages[lastToolIndex];
      const previousMessage = messages[lastToolIndex - 1];

      if (previousMessage?.role === "ai") {
        try {
          const content = JSON.parse(previousMessage.content);
          if (content.function) return [previousMessage.timestamp, toolMessage.timestamp];
        } catch (_) {
          return null;
        }
      }
      return null;
    };

    it("should return timestamps for AI-tool pair", () => {
      const messages = [
        { role: "human", content: "test", timestamp: 1000 },
        { role: "ai", content: JSON.stringify({ function: "get_widget_data" }), timestamp: 1001 },
        { role: "tool", function: "get_widget_data", timestamp: 1002 },
      ];

      const result = getLatestAiToolPairTimestamps(messages);

      expect(result).toEqual([1001, 1002]);
    });

    it("should return null when no tool message exists", () => {
      const messages = [
        { role: "human", content: "test", timestamp: 1000 },
        { role: "ai", content: "response", timestamp: 1001 },
      ];

      const result = getLatestAiToolPairTimestamps(messages);

      expect(result).toBeNull();
    });

    it("should return null when AI message before tool is not a function call", () => {
      const messages = [
        { role: "human", content: "test", timestamp: 1000 },
        { role: "ai", content: "regular response", timestamp: 1001 },
        { role: "tool", function: "get_widget_data", timestamp: 1002 },
      ];

      const result = getLatestAiToolPairTimestamps(messages);

      expect(result).toBeNull();
    });

    it("should return null when previous message is not AI", () => {
      const messages = [
        { role: "human", content: "test", timestamp: 1000 },
        { role: "tool", function: "get_widget_data", timestamp: 1001 },
      ];

      const result = getLatestAiToolPairTimestamps(messages);

      expect(result).toBeNull();
    });
  });

  describe("normalizeCitations", () => {
    const normalizeCitations = (citations: any[]): any[] => {
      if (!Array.isArray(citations)) return [];
      return citations.map((c: any) => {
        if (c?.id && c?.signature !== undefined) return c;
        return {
          id: c?.id || "generated-id",
          signature: c?.signature || "",
          source_info: c?.source_info,
          details: c?.details,
          artifacts: c?.artifacts,
          quote_bounding_boxes: c?.quote_bounding_boxes,
        };
      });
    };

    it("should pass through valid citations", () => {
      const citations = [{ id: "cite-1", signature: "sig-1", source_info: "test" }];
      const result = normalizeCitations(citations);

      expect(result).toEqual(citations);
    });

    it("should normalize citations missing id", () => {
      const citations = [{ signature: "sig-1", source_info: "test" }];
      const result = normalizeCitations(citations);

      expect(result[0].id).toBe("generated-id");
      expect(result[0].signature).toBe("sig-1");
    });

    it("should normalize citations missing signature", () => {
      const citations = [{ id: "cite-1", source_info: "test" }];
      const result = normalizeCitations(citations);

      expect(result[0].id).toBe("cite-1");
      expect(result[0].signature).toBe("");
    });

    it("should return empty array for non-array input", () => {
      expect(normalizeCitations(null as any)).toEqual([]);
      expect(normalizeCitations(undefined as any)).toEqual([]);
      expect(normalizeCitations("string" as any)).toEqual([]);
    });

    it("should preserve optional fields", () => {
      const citations = [{
        id: "cite-1",
        signature: "sig-1",
        details: { extra: "data" },
        artifacts: [{ type: "image" }],
      }];
      const result = normalizeCitations(citations);

      expect(result[0].details).toEqual({ extra: "data" });
      expect(result[0].artifacts).toEqual([{ type: "image" }]);
    });
  });

  describe("SSE event parsing", () => {
    const parseSSEEvents = (chunk: string) => {
      const events = chunk.split(/\r\n\r\n|\r\r|\n\n/g);
      const parsedEvents: { event: string; data: any }[] = [];

      for (const eventChunk of events) {
        if (!eventChunk.trim()) continue;

        const lines = eventChunk.split(/\n|\r|\r\n/g);
        let event = "";
        let data = "";

        for (const line of lines) {
          const lineMatch = /(?<field>[^:]+)(?:: ?(?<value>.*))?/.exec(line);
          if (lineMatch) {
            const groups = lineMatch.groups || {};
            const value = groups.value || "";

            switch (groups.field) {
              case "event":
                event = value;
                break;
              case "data":
                data += value;
                data += "\n";
                break;
            }
          }
        }

        if (data) {
          // Remove trailing newline
          if (data[data.length - 1] === "\n") {
            data = data.slice(0, -1);
          }
          try {
            parsedEvents.push({ event, data: JSON.parse(data) });
          } catch {
            parsedEvents.push({ event, data });
          }
        }
      }

      return parsedEvents;
    };

    it("should parse single SSE event", () => {
      const chunk = 'event: copilotMessageChunk\ndata: {"delta": "Hello"}';
      const result = parseSSEEvents(chunk);

      expect(result).toHaveLength(1);
      expect(result[0].event).toBe("copilotMessageChunk");
      expect(result[0].data).toEqual({ delta: "Hello" });
    });

    it("should parse multiple SSE events", () => {
      const chunk = 'event: copilotMessageChunk\ndata: {"delta": "Hello"}\n\nevent: copilotMessageChunk\ndata: {"delta": " World"}';
      const result = parseSSEEvents(chunk);

      expect(result).toHaveLength(2);
      expect(result[0].data.delta).toBe("Hello");
      expect(result[1].data.delta).toBe(" World");
    });

    it("should handle copilotStatusUpdate events", () => {
      const chunk = 'event: copilotStatusUpdate\ndata: {"eventType": "INFO", "message": "Processing"}';
      const result = parseSSEEvents(chunk);

      expect(result[0].event).toBe("copilotStatusUpdate");
      expect(result[0].data.eventType).toBe("INFO");
    });

    it("should handle copilotFunctionCall events", () => {
      const chunk = 'event: copilotFunctionCall\ndata: {"function": "get_widget_data", "input_arguments": {}}';
      const result = parseSSEEvents(chunk);

      expect(result[0].event).toBe("copilotFunctionCall");
      expect(result[0].data.function).toBe("get_widget_data");
    });

    it("should handle done event", () => {
      const chunk = 'event: done\ndata: {}';
      const result = parseSSEEvents(chunk);

      expect(result[0].event).toBe("done");
    });
  });

  describe("streaming status states", () => {
    const StreamingStatus = {
      NOT_STARTED: { streamingStatus: "streaming-not-started" },
      STARTED: { streamingStatus: "streaming-started" },
      READY: { streamingStatus: "streaming-ready" },
      STOPPED: { streamingStatus: "streaming-stopped" },
    };

    const ResetState = {
      limitReached: false,
      loading: false,
    };

    it("should define all streaming states", () => {
      expect(StreamingStatus.NOT_STARTED.streamingStatus).toBe("streaming-not-started");
      expect(StreamingStatus.STARTED.streamingStatus).toBe("streaming-started");
      expect(StreamingStatus.READY.streamingStatus).toBe("streaming-ready");
      expect(StreamingStatus.STOPPED.streamingStatus).toBe("streaming-stopped");
    });

    it("should have reset state with default values", () => {
      expect(ResetState.limitReached).toBe(false);
      expect(ResetState.loading).toBe(false);
    });

    it("should allow combining reset state with streaming status", () => {
      const combined = { ...ResetState, ...StreamingStatus.READY };

      expect(combined.limitReached).toBe(false);
      expect(combined.loading).toBe(false);
      expect(combined.streamingStatus).toBe("streaming-ready");
    });
  });
});
