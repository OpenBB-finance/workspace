import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentChat = vi.fn();
const mockRemoveMessages = vi.fn();
const mockGetDashboardWidgetData = vi.fn();
const mockGetCopilotWidgets = vi.fn();
const mockGetWidgetData = vi.fn();
const mockProcessMentions = vi.fn((content: string) => ({
  result: content,
  mentions: [],
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: (state: any) => any) =>
    selector({
      getCurrentChat: mockGetCurrentChat,
      removeMessages: mockRemoveMessages,
    }),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: (state: any) => any) =>
    selector({
      getDashboardWidgetData: mockGetDashboardWidgetData,
      getCopilotWidgets: mockGetCopilotWidgets,
    }),
}));

vi.mock("~/lib/utils", () => ({
  AVAILABLE_FUNCTIONS: ["get_widget_data"],
  isWidgetDataFunctionCall: (message: { function?: string }) =>
    message.function === "get_widget_data",
}));

vi.mock("~/components/AI/hooks/useFunctionCall", () => ({
  useFunctionCall: () => ({
    getWidgetData: mockGetWidgetData,
  }),
}));

vi.mock("~/components/AI/hooks/useMentions", () => ({
  useMentions: () => ({
    processMentions: mockProcessMentions,
  }),
}));

vi.mock("~/components/AI/hooks/useWidgetsInCurrentDashboard", () => ({
  useWidgetsInCurrentDashboard: () => vi.fn(),
}));

vi.mock("~/components/AI/hooks/useGetCopilotWidgets", () => ({
  createCopilotWidget: vi.fn(),
}));

import { useGetFinalMessagesAndWidgets } from "~/components/AI/hooks/useGetFinalMessagesAndWidgets";

describe("useGetFinalMessagesAndWidgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCopilotWidgets.mockReturnValue({
      allDashboardWidgets: [{ uuid: "widget-1" }],
    });
    mockGetCurrentChat.mockReturnValue({
      messages: [
        {
          role: "tool",
          function: "get_widget_data",
          timestamp: 123,
          input_arguments: {
            data_sources: [
              {
                origin: "OpenBB Hub",
                id: "file-widget-1",
                widget_uuid: "widget-1",
                input_args: {},
              },
            ],
          },
          data: [
            {
              error_type: "not_found",
              content: "File with id file-widget-1 not found",
            },
          ],
          extra_state: {
            copilot_function_call_arguments: {
              widget_queries: [{ widget_uuid: "widget-1", query: "what's this about?" }],
            },
          },
        },
      ],
    });
  });

  it("skips OpenBB Hub renewal for stale tool messages with error payloads", async () => {
    const { result } = renderHook(() => useGetFinalMessagesAndWidgets());

    await expect(result.current()).resolves.toEqual({
      finalMessages: [
        {
          role: "tool",
          function: "get_widget_data",
          input_arguments: {
            data_sources: [
              {
                origin: "OpenBB Hub",
                id: "file-widget-1",
                widget_uuid: "widget-1",
                input_args: {},
              },
            ],
          },
          data: [
            {
              error_type: "not_found",
              content: "File with id file-widget-1 not found",
            },
          ],
          extra_state: {
            copilot_function_call_arguments: {
              widget_queries: [{ widget_uuid: "widget-1", query: "what's this about?" }],
            },
          },
        },
      ],
      finalDashboardWidgets: [{ uuid: "widget-1" }],
      mentionWidgets: [],
    });

    expect(mockGetWidgetData).not.toHaveBeenCalled();
    expect(mockRemoveMessages).toHaveBeenCalledWith([]);
  });

  it("strips attached files from human messages sent to the backend", async () => {
    mockGetCurrentChat.mockReturnValue({
      messages: [
        {
          role: "human",
          content: "summarize this",
          copilotId: "openbb-copilot",
          timestamp: 123,
          files: [
            {
              name: "dailyreport.pdf",
              description: "a report",
              status: "uploaded",
              stored_file_uuid: "uuid-1",
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useGetFinalMessagesAndWidgets());
    const { finalMessages } = await result.current();

    expect(finalMessages).toEqual([{ role: "human", content: "summarize this" }]);
  });
});
