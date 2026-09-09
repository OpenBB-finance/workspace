import { describe, expect, it, vi } from "vitest";
import type { Chat, ToolMessage } from "~/lib/state/copilot";
import {
  AVAILABLE_FUNCTIONS,
  addGenerativeWidgetInputArguments,
  assignTasksToAgentInputArguments,
  functionCallSchema,
  GET_WIDGET_DATA_FUNCTIONS,
  getParamOptionsInputArguments,
  getWidgetDataInputArguments,
  handleStreamingResponse,
  isWidgetDataFunctionCall,
  mergeDuplicateChats,
  migrateFuncCallArgs,
  paramOptionQueryResult,
  paramOptionSchema,
} from "~/lib/utils/ai";

describe("ai.ts utility functions", () => {
  describe("paramOptionSchema", () => {
    it("should accept valid string label and value", () => {
      const result = paramOptionSchema.safeParse({
        label: "Apple Inc.",
        value: "AAPL",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid label with numeric value", () => {
      const result = paramOptionSchema.safeParse({
        label: "Limit",
        value: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid label with boolean value", () => {
      const result = paramOptionSchema.safeParse({
        label: "Active",
        value: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing label", () => {
      const result = paramOptionSchema.safeParse({
        value: "AAPL",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing value", () => {
      const result = paramOptionSchema.safeParse({
        label: "Apple Inc.",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid value types", () => {
      const result = paramOptionSchema.safeParse({
        label: "Test",
        value: { nested: "object" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("paramOptionQueryResult", () => {
    it("should accept valid param options result", () => {
      const result = paramOptionQueryResult.safeParse({
        param_options: [
          {
            param: "symbol",
            options: [
              { label: "Apple", value: "AAPL" },
              { label: "Microsoft", value: "MSFT" },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty param_options array", () => {
      const result = paramOptionQueryResult.safeParse({
        param_options: [],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing param_options", () => {
      const result = paramOptionQueryResult.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid options structure", () => {
      const result = paramOptionQueryResult.safeParse({
        param_options: [
          {
            param: "symbol",
            options: ["invalid", "structure"],
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getWidgetDataInputArguments", () => {
    it("should accept valid data sources array", () => {
      const result = getWidgetDataInputArguments.safeParse({
        data_sources: [
          {
            widget_uuid: "abc-123",
            origin: "platform",
            id: "key_metrics",
            input_args: { symbol: "AAPL" },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept data sources with null widget_uuid", () => {
      const result = getWidgetDataInputArguments.safeParse({
        data_sources: [
          {
            widget_uuid: null,
            origin: "platform",
            id: "company_news",
            input_args: {},
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept data sources with ssm_request", () => {
      const result = getWidgetDataInputArguments.safeParse({
        data_sources: [
          {
            widget_uuid: "widget-1",
            origin: "backend",
            id: "ag_grid_table",
            input_args: { limit: 50 },
            ssm_request: { filter: "active" },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      const result = getWidgetDataInputArguments.safeParse({
        data_sources: [
          {
            origin: "platform",
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty data_sources array", () => {
      const result = getWidgetDataInputArguments.safeParse({
        data_sources: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getParamOptionsInputArguments", () => {
    it("should accept valid param options queries", () => {
      const result = getParamOptionsInputArguments.safeParse({
        param_options_queries: [
          {
            origin: "platform",
            id: "key_metrics",
            options_endpoint_input_args: { symbol: "AAPL" },
            param: "period",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty param_options_queries array", () => {
      const result = getParamOptionsInputArguments.safeParse({
        param_options_queries: [],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      const result = getParamOptionsInputArguments.safeParse({
        param_options_queries: [
          {
            origin: "platform",
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("assignTasksToAgentInputArguments", () => {
    it("should accept valid task requests", () => {
      const result = assignTasksToAgentInputArguments.safeParse({
        task_requests: [
          {
            id: "task-1",
            description: "Analyze stock data",
            assigned_holder_url: "https://example.com/holder",
            assigned_agent_id: "agent-123",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty task_requests array", () => {
      const result = assignTasksToAgentInputArguments.safeParse({
        task_requests: [],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      const result = assignTasksToAgentInputArguments.safeParse({
        task_requests: [
          {
            id: "task-1",
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("addGenerativeWidgetInputArguments", () => {
    it("should accept a note with string data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "note",
        data: "<p>Hello</p>",
        name: "My Note",
      });
      expect(result.success).toBe(true);
    });

    it("should reject a note with array data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "note",
        data: [{ content: "<p>Hello</p>" }],
        name: "My Note",
      });
      expect(result.success).toBe(false);
    });

    it("should reject html with array data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "html",
        data: [],
        name: "My Html",
      });
      expect(result.success).toBe(false);
    });

    it("should accept a table with array-of-objects data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "table",
        data: [{ symbol: "AAPL", price: 100 }],
        name: "My Table",
      });
      expect(result.success).toBe(true);
    });

    it("should reject a table with string data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "table",
        data: "symbol,price",
        name: "My Table",
      });
      expect(result.success).toBe(false);
    });

    it("should accept a chart with array data and full chart_params", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "chart",
        data: [{ date: "2024-01-01", value: 1 }],
        name: "My Chart",
        chart_params: { chartType: "line", xKey: "date", yKey: ["value"] },
      });
      expect(result.success).toBe(true);
    });

    it("should reject a chart without chart_params", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "chart",
        data: [{ date: "2024-01-01", value: 1 }],
        name: "My Chart",
      });
      expect(result.success).toBe(false);
    });

    it("should reject a chart with an empty yKey", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "chart",
        data: [{ date: "2024-01-01", value: 1 }],
        name: "My Chart",
        chart_params: { chartType: "line", xKey: "date", yKey: [] },
      });
      expect(result.success).toBe(false);
    });

    it("should reject a chart with string data", () => {
      const result = addGenerativeWidgetInputArguments.safeParse({
        widget_type: "chart",
        data: "invalid",
        name: "My Chart",
        chart_params: { chartType: "line", xKey: "date", yKey: ["value"] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("functionCallSchema", () => {
    describe("get_widget_data function", () => {
      it("should accept valid get_widget_data call", () => {
        const result = functionCallSchema.safeParse({
          function: "get_widget_data",
          input_arguments: {
            data_sources: [
              {
                widget_uuid: "widget-1",
                origin: "platform",
                id: "key_metrics",
                input_args: { symbol: "AAPL" },
              },
            ],
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });

      it("should reject get_widget_data with invalid input_arguments", () => {
        const result = functionCallSchema.safeParse({
          function: "get_widget_data",
          input_arguments: {
            invalid_field: true,
          },
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });
    });

    describe("get_extra_widget_data function", () => {
      it("should accept valid get_extra_widget_data call", () => {
        const result = functionCallSchema.safeParse({
          function: "get_extra_widget_data",
          input_arguments: {
            data_sources: [
              {
                widget_uuid: null,
                origin: "backend",
                id: "company_news",
                input_args: {},
              },
            ],
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("get_params_options function", () => {
      it("should accept valid get_params_options call", () => {
        const result = functionCallSchema.safeParse({
          function: "get_params_options",
          input_arguments: {
            param_options_queries: [
              {
                origin: "platform",
                id: "income_statement",
                options_endpoint_input_args: { symbol: "MSFT" },
                param: "period",
              },
            ],
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("add_widget_to_dashboard function", () => {
      it("should accept add_widget_to_dashboard call", () => {
        const result = functionCallSchema.safeParse({
          function: "add_widget_to_dashboard",
          input_arguments: {
            widget_id: "clock",
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("update_widget_in_dashboard function", () => {
      it("should accept update_widget_in_dashboard call", () => {
        const result = functionCallSchema.safeParse({
          function: "update_widget_in_dashboard",
          input_arguments: {
            widget_uuid: "widget-123",
            params: { symbol: "GOOG" },
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("add_generative_widget function", () => {
      it("should accept a valid add_generative_widget note call (in-app path)", () => {
        const result = functionCallSchema.safeParse({
          function: "add_generative_widget",
          input_arguments: {
            widget_type: "note",
            data: "<p>Summary</p>",
            name: "Summary Note",
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });

      it("should reject add_generative_widget chart calls without chart_params", () => {
        const result = functionCallSchema.safeParse({
          function: "add_generative_widget",
          input_arguments: {
            widget_type: "chart",
            data: [{ date: "2024-01-01", value: 1 }],
            name: "Chart",
          },
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });
    });

    describe("assign_tasks_to_agents function", () => {
      it("should accept valid assign_tasks_to_agents call", () => {
        const result = functionCallSchema.safeParse({
          function: "assign_tasks_to_agents",
          input_arguments: {
            task_requests: [
              {
                id: "task-1",
                description: "Research market trends",
                assigned_holder_url: "https://api.example.com",
                assigned_agent_id: "research-agent",
              },
            ],
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("execute_agent_tool function", () => {
      it("should accept valid execute_agent_tool call", () => {
        const result = functionCallSchema.safeParse({
          function: "execute_agent_tool",
          input_arguments: {
            server_id: "mcp-server-1",
            tool_name: "fetch_data",
            parameters: { query: "AAPL" },
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });

      it("should reject execute_agent_tool without server_id", () => {
        const result = functionCallSchema.safeParse({
          function: "execute_agent_tool",
          input_arguments: {
            tool_name: "fetch_data",
            parameters: {},
          },
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });

      it("should reject execute_agent_tool without tool_name", () => {
        const result = functionCallSchema.safeParse({
          function: "execute_agent_tool",
          input_arguments: {
            server_id: "mcp-server-1",
            parameters: {},
          },
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });

      it("should reject execute_agent_tool without parameters", () => {
        const result = functionCallSchema.safeParse({
          function: "execute_agent_tool",
          input_arguments: {
            server_id: "mcp-server-1",
            tool_name: "fetch_data",
          },
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });
    });

    describe("save_skill function", () => {
      it("should accept save_skill with name and instructions", () => {
        const result = functionCallSchema.safeParse({
          function: "save_skill",
          input_arguments: {
            name: "Quarterly analysis",
            instructions: "Summarize the workflow from this conversation",
          },
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });

      it("should accept save_skill with empty input_arguments", () => {
        const result = functionCallSchema.safeParse({
          function: "save_skill",
          input_arguments: {},
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });

      it("should accept save_skill without input_arguments", () => {
        const result = functionCallSchema.safeParse({
          function: "save_skill",
          extra_state: {},
        });
        expect(result.success).toBe(true);
      });
    });

    describe("invalid function names", () => {
      it("should reject unknown function names", () => {
        const result = functionCallSchema.safeParse({
          function: "unknown_function",
          input_arguments: {},
          extra_state: {},
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("isWidgetDataFunctionCall", () => {
    it("should return true for get_widget_data function", () => {
      const message = {
        function: "get_widget_data",
        input_arguments: { data_sources: [] },
      } as unknown as ToolMessage;
      expect(isWidgetDataFunctionCall(message)).toBe(true);
    });

    it("should return true for get_extra_widget_data function", () => {
      const message = {
        function: "get_extra_widget_data",
        input_arguments: { data_sources: [] },
      } as unknown as ToolMessage;
      expect(isWidgetDataFunctionCall(message)).toBe(true);
    });

    it("should return false for get_params_options function", () => {
      const message = {
        function: "get_params_options",
        input_arguments: { param_options_queries: [] },
      } as unknown as ToolMessage;
      expect(isWidgetDataFunctionCall(message)).toBe(false);
    });

    it("should return false for add_widget_to_dashboard function", () => {
      const message = {
        function: "add_widget_to_dashboard",
        input_arguments: {},
      } as unknown as ToolMessage;
      expect(isWidgetDataFunctionCall(message)).toBe(false);
    });

    it("should return false for execute_agent_tool function", () => {
      const message = {
        function: "execute_agent_tool",
        input_arguments: {},
      } as unknown as ToolMessage;
      expect(isWidgetDataFunctionCall(message)).toBe(false);
    });
  });

  describe("GET_WIDGET_DATA_FUNCTIONS constant", () => {
    it("should contain get_widget_data", () => {
      expect(GET_WIDGET_DATA_FUNCTIONS).toContain("get_widget_data");
    });

    it("should contain get_extra_widget_data", () => {
      expect(GET_WIDGET_DATA_FUNCTIONS).toContain("get_extra_widget_data");
    });

    it("should have exactly 2 functions", () => {
      expect(GET_WIDGET_DATA_FUNCTIONS).toHaveLength(2);
    });
  });

  describe("AVAILABLE_FUNCTIONS constant", () => {
    it("should contain all widget data functions", () => {
      for (const func of GET_WIDGET_DATA_FUNCTIONS) {
        expect(AVAILABLE_FUNCTIONS).toContain(func);
      }
    });

    it("should contain get_params_options", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("get_params_options");
    });

    it("should contain add_widget_to_dashboard", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("add_widget_to_dashboard");
    });

    it("should contain update_widget_in_dashboard", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("update_widget_in_dashboard");
    });

    it("should contain assign_tasks_to_agents", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("assign_tasks_to_agents");
    });

    it("should contain execute_agent_tool", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("execute_agent_tool");
    });

    it("should contain save_skill", () => {
      expect(AVAILABLE_FUNCTIONS).toContain("save_skill");
    });
  });

  describe("handleStreamingResponse", () => {
    function createMockReader(
      chunks: string[],
    ): ReadableStreamDefaultReader<Uint8Array> {
      let index = 0;
      const encoder = new TextEncoder();
      return {
        read: vi.fn().mockImplementation(() => {
          if (index < chunks.length) {
            const chunk = chunks[index];
            index++;
            return Promise.resolve({
              done: false,
              value: encoder.encode(chunk),
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: vi.fn(),
        cancel: vi.fn(),
        closed: Promise.resolve(undefined),
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    }

    it("should process all chunks and call updateData for each", async () => {
      const chunks = ["Hello", " ", "World"];
      const reader = createMockReader(chunks);
      const updateData = vi.fn();

      await handleStreamingResponse(reader, updateData);

      expect(updateData).toHaveBeenNthCalledWith(1, "Hello");
      expect(updateData).toHaveBeenNthCalledWith(2, " ");
      expect(updateData).toHaveBeenNthCalledWith(3, "World");
    });

    it("should call onDone with accumulated content when complete", async () => {
      const chunks = ["First", "Second"];
      const reader = createMockReader(chunks);
      const updateData = vi.fn();
      const onDone = vi.fn();

      await handleStreamingResponse(reader, updateData, onDone);

      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledWith("FirstSecond");
    });

    it("should handle empty stream", async () => {
      const reader = createMockReader([]);
      const updateData = vi.fn();
      const onDone = vi.fn();

      await handleStreamingResponse(reader, updateData, onDone);

      expect(onDone).toHaveBeenCalledWith("");
    });

    it("should respect abort signal and exit early", async () => {
      const chunks = ["Chunk1", "Chunk2", "Chunk3"];
      const reader = createMockReader(chunks);
      const updateData = vi.fn();
      const onDone = vi.fn();
      const abortController = new AbortController();
      abortController.abort();

      await handleStreamingResponse(reader, updateData, onDone, abortController.signal);

      expect(updateData).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith("");
    });

    it("should handle single chunk stream", async () => {
      const chunks = ["SingleChunk"];
      const reader = createMockReader(chunks);
      const updateData = vi.fn();
      const onDone = vi.fn();

      await handleStreamingResponse(reader, updateData, onDone);

      expect(updateData).toHaveBeenCalledWith("SingleChunk");
      expect(onDone).toHaveBeenCalledWith("SingleChunk");
    });

    it("should work without onDone callback", async () => {
      const chunks = ["Data"];
      const reader = createMockReader(chunks);
      const updateData = vi.fn();

      await handleStreamingResponse(reader, updateData);

      expect(updateData).toHaveBeenCalledWith("Data");
    });
  });

  describe("migrateFuncCallArgs", () => {
    describe("get_widget_data migration", () => {
      it("should migrate widget_uuid to widget_uuids array", () => {
        const message = {
          function: "get_widget_data",
          input_arguments: {
            widget_uuid: "uuid-123",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).toHaveProperty("widget_uuids", ["uuid-123"]);
        expect(result.input_arguments.widget_uuid).toBeUndefined();
      });

      it("should migrate id to widget_uuids array when widget_uuid is missing", () => {
        const message = {
          function: "get_widget_data",
          input_arguments: {
            id: "id-456",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).toHaveProperty("widget_uuids", ["id-456"]);
      });

      it("should prefer widget_uuid over id when both exist", () => {
        const message = {
          function: "get_widget_data",
          input_arguments: {
            widget_uuid: "uuid-123",
            id: "id-456",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).toHaveProperty("widget_uuids", ["uuid-123"]);
      });

      it("should migrate copilot_function_call_arguments widget_uuid", () => {
        const message = {
          function: "get_widget_data",
          input_arguments: {},
          copilot_function_call_arguments: {
            widget_uuid: "copilot-uuid",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result.copilot_function_call_arguments).toHaveProperty("widget_uuids", [
          "copilot-uuid",
        ]);
        expect(result.copilot_function_call_arguments?.widget_uuid).toBeUndefined();
      });

      it("should not modify message without widget_uuid or id", () => {
        const message = {
          function: "get_widget_data",
          input_arguments: {
            other_field: "value",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).not.toHaveProperty("widget_uuids");
      });
    });

    describe("get_direct_retrieval_data migration", () => {
      it("should migrate single data source to data_sources array", () => {
        const message = {
          function: "get_direct_retrieval_data",
          input_arguments: {
            id: "widget-id",
            origin: "platform",
            input_args: { symbol: "AAPL" },
          },
        };

        // @ts-expect-error - ignored for now
        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).toHaveProperty("data_sources");
        expect(Array.isArray(result.input_arguments.data_sources)).toBe(true);
      });

      it("should migrate copilot_function_call_arguments search queries", () => {
        const message = {
          function: "get_direct_retrieval_data",
          input_arguments: {},
          copilot_function_call_arguments: {
            data_source_description: "Stock metrics",
            query: "Get AAPL data",
          },
        };

        // @ts-expect-error - ignored for now
        const result = migrateFuncCallArgs(message);

        expect(result.copilot_function_call_arguments).toHaveProperty(
          "data_source_search_queries",
        );
      });

      it("should not migrate if input_args is missing", () => {
        const message = {
          function: "get_direct_retrieval_data",
          input_arguments: {
            id: "widget-id",
            origin: "platform",
          },
        };

        // @ts-expect-error - ignored for now
        const result = migrateFuncCallArgs(message);

        expect(result.input_arguments).not.toHaveProperty("data_sources");
      });
    });

    describe("edge cases", () => {
      it("should return message unchanged for non-migrateable functions", () => {
        const message = {
          function: "add_widget_to_dashboard",
          input_arguments: {
            widget_id: "clock",
          },
        } as const;

        const result = migrateFuncCallArgs(message);

        expect(result).toEqual(message);
      });

      it("should handle undefined message by returning it (errors are caught internally)", () => {
        const result = migrateFuncCallArgs(undefined as any);
        expect(result).toBeUndefined();
      });

      it("should handle null message by returning it (errors are caught internally)", () => {
        const result = migrateFuncCallArgs(null as any);
        expect(result).toBeNull();
      });

      it("should handle empty object", () => {
        const result = migrateFuncCallArgs({});
        expect(result).toEqual({});
      });

      it("should not throw on malformed input", () => {
        const malformedMessage = {
          function: "get_widget_data",
          input_arguments: null,
        };

        expect(() => migrateFuncCallArgs(malformedMessage as any)).not.toThrow();
      });
    });
  });

  describe("mergeDuplicateChats", () => {
    function createChat(overrides: Partial<Chat> = {}): Chat {
      return {
        uuid: "chat-1",
        createdAt: Date.now(),
        label: "Test Chat",
        messages: [],
        artifacts: [],
        ...overrides,
      };
    }

    it("should merge messages from multiple chats", () => {
      const chat1 = createChat({
        uuid: "chat-1",
        messages: [
          { role: "human", content: "Hello", timestamp: 1000, copilotId: "copilot-1" },
        ],
      });
      const chat2 = createChat({
        uuid: "chat-1",
        messages: [
          { role: "ai", content: "Hi there", timestamp: 2000, copilotId: "copilot-1" },
        ],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result).toHaveLength(1);
      expect(result[0].messages).toHaveLength(2);
    });

    it("should sort messages by timestamp", () => {
      const chat1 = createChat({
        messages: [
          { role: "ai", content: "Response", timestamp: 2000, copilotId: "copilot-1" },
        ],
      });
      const chat2 = createChat({
        messages: [
          {
            role: "human",
            content: "Question",
            timestamp: 1000,
            copilotId: "copilot-1",
          },
        ],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].messages[0].timestamp).toBe(1000);
      expect(result[0].messages[1].timestamp).toBe(2000);
    });

    it("should remove duplicate messages with same timestamp", () => {
      const chat1 = createChat({
        messages: [
          { role: "human", content: "Hello", timestamp: 1000, copilotId: "copilot-1" },
        ],
      });
      const chat2 = createChat({
        messages: [
          { role: "human", content: "Hello", timestamp: 1000, copilotId: "copilot-1" },
        ],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].messages).toHaveLength(1);
    });

    it("should merge artifacts from multiple chats", () => {
      const chat1 = createChat({
        artifacts: [{ uuid: "artifact-1", type: "text", content: "Content 1" }],
      });
      const chat2 = createChat({
        artifacts: [{ uuid: "artifact-2", type: "text", content: "Content 2" }],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].artifacts).toHaveLength(2);
    });

    it("should remove duplicate artifacts by uuid", () => {
      const chat1 = createChat({
        artifacts: [{ uuid: "artifact-1", type: "text", content: "Content" }],
      });
      const chat2 = createChat({
        artifacts: [{ uuid: "artifact-1", type: "text", content: "Content" }],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].artifacts).toHaveLength(1);
    });

    it("should preserve first chat properties", () => {
      const chat1 = createChat({
        uuid: "chat-1",
        label: "First Label",
        createdAt: 1000,
      });
      const chat2 = createChat({
        uuid: "chat-2",
        label: "Second Label",
        createdAt: 2000,
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].uuid).toBe("chat-1");
      expect(result[0].label).toBe("First Label");
      expect(result[0].createdAt).toBe(1000);
    });

    it("should handle single chat", () => {
      const chat = createChat({
        messages: [
          { role: "human", content: "Hello", timestamp: 1000, copilotId: "copilot-1" },
        ],
      });

      const result = mergeDuplicateChats([chat]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(chat);
    });

    it("should handle chats with undefined artifacts", () => {
      const chat1 = createChat({
        artifacts: undefined,
      });
      const chat2 = createChat({
        artifacts: [{ uuid: "artifact-1", type: "text", content: "Content" }],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].artifacts).toHaveLength(1);
    });

    it("should handle chats with empty messages", () => {
      const chat1 = createChat({ messages: [] });
      const chat2 = createChat({
        messages: [
          { role: "human", content: "Hello", timestamp: 1000, copilotId: "copilot-1" },
        ],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].messages).toHaveLength(1);
    });

    it("should handle multiple chats with various message types", () => {
      const chat1 = createChat({
        messages: [
          {
            role: "human",
            content: "Question",
            timestamp: 1000,
            copilotId: "copilot-1",
          },
        ],
      });
      const chat2 = createChat({
        messages: [
          { role: "ai", content: "Answer", timestamp: 2000, copilotId: "copilot-1" },
          {
            role: "system",
            content: { eventType: "INFO", message: "System info" },
            timestamp: 3000,
            copilotId: "copilot-1",
          },
        ],
      });

      const result = mergeDuplicateChats([chat1, chat2]);

      expect(result[0].messages).toHaveLength(3);
    });
  });
});
