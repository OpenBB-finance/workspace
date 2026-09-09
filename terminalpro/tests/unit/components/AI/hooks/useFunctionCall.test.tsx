import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CopilotCommandResultT } from "~/lib/state/copilot";
import type { AddGenerativeWidgetInputArgumentsT } from "~/lib/utils/ai";

// Mock external dependencies
vi.mock("react-router-dom", () => ({
  useParams: vi.fn(() => ({ id: "test-dashboard-id" })),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

const mockAddWidget = vi.fn().mockResolvedValue("mock-widget-uuid");
const mockAddWidgets = vi.fn().mockResolvedValue(undefined);
const mockUpdateInnerTabs = vi.fn();
const mockRemoveWidget = vi.fn();
const mockGetDashboardWidgetData = vi.fn();
const mockCheckWidgetSignature = vi.fn();
const mockGetAppWidget = vi.fn();
const mockGetSharedDashWidget = vi.fn();
let mockItems: Record<
  string,
  {
    data?: {
      widgets?: Partial<{
        id: string;
        widgetId: string;
        storage: Record<string, unknown>;
      }>[];
    };
  }
> = {};

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      addWidget: mockAddWidget,
      addWidgets: mockAddWidgets,
      updateInnerTabs: mockUpdateInnerTabs,
      removeWidget: mockRemoveWidget,
      items: mockItems,
    }),
  },
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useSharedAppStore: {
    getState: () => ({
      getWidgetById: mockGetSharedDashWidget,
    }),
  },
}));

const mockAddArtifactToCurrentChat = vi.fn();

vi.mock("~/lib/state/copilot", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useShallowCopilotStore: vi.fn(() => ({
      selectedCopilot: null,
      copilots: [],
    })),
    useCopilotStore: {
      getState: () => ({
        addArtifactToCurrentChat: mockAddArtifactToCurrentChat,
      }),
    },
  };
});

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: vi.fn((selector) =>
    selector({
      getDashboardWidgetData: mockGetDashboardWidgetData,
      checkWidgetSignature: mockCheckWidgetSignature,
    }),
  ),
}));

vi.mock("~/lib/contexts/CachedTickers", () => ({
  useTickersContext: vi.fn(() => ({
    queryTickers: vi.fn(),
  })),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useShallowAppWidgetsStore: vi.fn((selector) =>
    selector({
      getAppWidget: mockGetAppWidget,
    }),
  ),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(() => ({})),
}));

const mockGetPreSignedUrl = vi.fn();

vi.mock("~/api/auth.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/auth.api")>()),
  getPreSignedUrl: (...args: unknown[]) => mockGetPreSignedUrl(...args),
}));

const mockSdkPost = vi.fn().mockResolvedValue({ data: {} });

vi.mock("~/lib/api/sdkFetcher", () => ({
  sdkClient: {
    post: (...args: unknown[]) => mockSdkPost(...args),
    get: vi.fn(),
  },
}));

const mockCreateWidget = vi.fn().mockResolvedValue("mock-widget-uuid");
const mockReadWidget = vi.fn();

vi.mock("~/api/workspace.api", () => ({
  createWidget: (...args: unknown[]) => mockCreateWidget(...args),
  readWidget: (...args: unknown[]) => mockReadWidget(...args),
}));

const mockGetChartWidgetData = vi.fn();

vi.mock("~/components/Widgets/Chart", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getChartWidgetData: (...args: unknown[]) => mockGetChartWidgetData(...args),
  };
});

const mockGetJsonWidget = vi.fn();
const mockTriggerCustomEvent = vi.fn();

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getJsonWidget: (...args: unknown[]) => mockGetJsonWidget(...args),
    triggerCustomEvent: (...args: unknown[]) => mockTriggerCustomEvent(...args),
  };
});

// Import after mocking
import {
  convertToCopilotData,
  extractUuidFromWidgetId,
  useFunctionCall,
} from "~/components/AI/hooks/useFunctionCall";
import { useManageNavigationBar } from "~/components/AI/hooks/useManageNavigationBar";

describe("useFunctionCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddArtifactToCurrentChat.mockClear();
    mockCreateWidget.mockClear();
    mockReadWidget.mockReset();
    mockGetDashboardWidgetData.mockReset();
    mockCheckWidgetSignature.mockReset();
    mockGetAppWidget.mockReset();
    mockCheckWidgetSignature.mockReturnValue(false);
    mockGetSharedDashWidget.mockReset();
    mockItems = {};
    vi.stubGlobal("fetch", vi.fn());
  });

  const renderUseFunctionCall = () => {
    return renderHook(() => useFunctionCall());
  };

  describe("getWidgetData", () => {
    it("uses cached non-empty HTML string data", async () => {
      mockCheckWidgetSignature.mockReturnValue(true);
      mockReadWidget.mockReturnValue({
        data: "<section>Cached HTML</section>",
      });

      const { result } = renderUseFunctionCall();

      let response: Awaited<ReturnType<typeof result.current.getWidgetData>>;
      await act(async () => {
        response = await result.current.getWidgetData([
          {
            origin: "Reference Backend",
            id: "html_widget",
            widget_uuid: "html-widget-uuid",
            input_args: {},
          },
        ]);
      });

      expect(response![0]).toEqual({
        items: [
          {
            content: "<section>Cached HTML</section>",
            data_format: {
              data_type: "object",
              parse_as: "text",
            },
          },
        ],
        extra_citations: [],
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("reads custom HTML widget responses as text", async () => {
      mockGetAppWidget.mockReturnValue({
        widgetId: "html_widget",
        name: "HTML Widget",
        type: "html",
        endpoint: "https://reference-backend.test/html",
        endpointHeaders: [],
      });
      vi.mocked(fetch).mockResolvedValue(
        new Response("<main>Endpoint HTML</main>", {
          headers: { "content-type": "text/html" },
        }),
      );

      const { result } = renderUseFunctionCall();

      let response: Awaited<ReturnType<typeof result.current.getWidgetData>>;
      await act(async () => {
        response = await result.current.getWidgetData([
          {
            origin: "Reference Backend",
            id: "html_widget",
            input_args: {},
          },
        ]);
      });

      expect(response![0]).toEqual({
        items: [
          {
            content: "<main>Endpoint HTML</main>",
            data_format: {
              data_type: "object",
              parse_as: "html",
            },
          },
        ],
        extra_citations: [],
      });
    });

    it("resolves dropped-file widgets from the widget id, not the composer store", async () => {
      const fileUuid = "11111111-2222-3333-4444-555555555555";
      mockGetPreSignedUrl.mockResolvedValue({
        pre_signed_url: `https://files.test/${fileUuid}.pdf?Expires=1800`,
        original_file_name: "dailyreport.pdf",
      });

      const { result } = renderUseFunctionCall();

      let response: Awaited<ReturnType<typeof result.current.getWidgetData>>;
      await act(async () => {
        response = await result.current.getWidgetData([
          {
            origin: "OpenBB Hub",
            id: `file-${fileUuid}`,
            input_args: {},
          },
        ]);
      });

      expect(mockGetPreSignedUrl).toHaveBeenCalledWith(fileUuid, 3600);
      expect(response![0]).toMatchObject({
        items: [
          {
            url: `https://files.test/${fileUuid}.pdf?Expires=1800`,
            data_format: { data_type: "pdf", filename: "dailyreport.pdf" },
          },
        ],
      });
    });
  });

  describe("getCustomWidgetsData", () => {
    it("falls back to already-loaded dashboard data when the widget is not in the registry", async () => {
      const rows = [{ date: "1980-01-02", value: 1 }];
      const jsonString = JSON.stringify(rows);
      const dataSource = {
        origin: "Widget Studio",
        id: "widget_studio-f90cedd9-d890-4b68-9e0d-87e120af92ac",
        widget_uuid: "dashboard-widget-uuid",
        input_args: {},
      } as any;

      mockGetDashboardWidgetData.mockReturnValue({ data: rows });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(jsonString, {
          headers: { "Content-Type": "application/json" },
        }),
      );
      const { result } = renderUseFunctionCall();
      const getWidgetData = result.current.getWidgetData;

      await act(async () => {
        await expect(getWidgetData([dataSource])).resolves.toContainEqual({
          items: [{ content: jsonString }],
        });
      });
    });

    it("falls back to shared dashboard widget when the widget is not in the registry", async () => {
      const rows = [{ date: "1980-01-02", value: 1 }];
      const jsonString = JSON.stringify(rows);
      const dataSource = {
        origin: "Widget Studio",
        id: "widget_studio-f90cedd9-d890-4b68-9e0d-87e120af92ac",
        widget_uuid: "dashboard-widget-uuid",
        input_args: {},
      } as any;

      mockGetSharedDashWidget.mockReturnValue({
        endpoint: "http://example.com",
        type: "table",
      });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(jsonString, {
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { result } = renderUseFunctionCall();
      const getWidgetData = result.current.getWidgetData;

      await act(async () => {
        await expect(getWidgetData([dataSource])).resolves.toContainEqual({
          items: [{ content: jsonString }],
        });
      });
      expect(mockGetSharedDashWidget).toHaveBeenCalledWith("dashboard-widget-uuid");
    });

    it("throws NOT_FOUND when the widget is missing and no dashboard data exists", async () => {
      const dataSource = {
        origin: "Widget Studio",
        id: "widget_studio-missing",
        widget_uuid: "dashboard-widget-uuid",
        input_args: {},
      } as any;

      const { result } = renderUseFunctionCall();
      const getWidgetData = result.current.getWidgetData;

      await act(async () => {
        await expect(getWidgetData([dataSource])).resolves.toContainEqual({
          content: "Widget with id widget_studio-missing not found",
          error_type: "not_found",
        });
      });
    });

    it("throws NOT_FOUND when the widget is missing and has no widget_uuid", async () => {
      const dataSource = {
        origin: "Widget Studio",
        id: "widget_studio-missing",
        input_args: {},
      } as any;

      const { result } = renderUseFunctionCall();
      const getWidgetData = result.current.getWidgetData;
      await act(async () => {
        await expect(getWidgetData([dataSource])).resolves.toContainEqual({
          content: "Widget with id widget_studio-missing not found",
          error_type: "not_found",
        });
      });
    });

    describe("raw=true skips the chart export transform", () => {
      const rows = [{ date: "1980-01-02", value: 1 }];
      const jsonString = JSON.stringify(rows);

      const chartDataSource = (inputArgs: Record<string, unknown>) =>
        ({
          origin: "Custom Backend",
          id: "chart-widget",
          widget_uuid: "dashboard-widget-uuid",
          input_args: inputArgs,
        }) as any;

      beforeEach(() => {
        mockGetSharedDashWidget.mockReturnValue({
          endpoint: "http://example.com",
          type: "chart",
        });
        vi.mocked(fetch).mockResolvedValue(
          new Response(jsonString, {
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      it("runs the chart export transform when raw is not set", async () => {
        const exportData = [{ x: "1980-01-02", y: 1 }];
        mockGetChartWidgetData.mockResolvedValue({ exportData });

        const { result } = renderUseFunctionCall();

        await act(async () => {
          await expect(
            result.current.getWidgetData([chartDataSource({})]),
          ).resolves.toContainEqual({
            items: [{ content: JSON.stringify(exportData) }],
          });
        });
        expect(mockGetChartWidgetData).toHaveBeenCalled();
      });

      it("returns the backend rows untransformed when raw is true", async () => {
        const { result } = renderUseFunctionCall();

        await act(async () => {
          await expect(
            result.current.getWidgetData([chartDataSource({ raw: true })]),
          ).resolves.toContainEqual({
            items: [{ content: jsonString }],
          });
        });
        expect(mockGetChartWidgetData).not.toHaveBeenCalled();
      });

      it('also honors the string form raw: "true" sent by external MCP callers', async () => {
        const { result } = renderUseFunctionCall();

        await act(async () => {
          await expect(
            result.current.getWidgetData([chartDataSource({ raw: "true" })]),
          ).resolves.toContainEqual({
            items: [{ content: jsonString }],
          });
        });
        expect(mockGetChartWidgetData).not.toHaveBeenCalled();
      });
    });
  });

  describe("getWidgetsParamOptions", () => {
    it("should throw error when widget is not found", async () => {
      const paramOptionsQuery = {
        origin: "OpenBB Sandbox",
        id: "non-existent-widget",
        param: "test-param",
        options_endpoint_input_args: {},
      };

      const { result } = renderUseFunctionCall();
      const getParamOptions = result.current.getParamOptions;

      await act(async () => {
        await expect(getParamOptions([paramOptionsQuery])).resolves.toContainEqual({
          content: "Widget with id non-existent-widget not found",
          error_type: "not_found",
        });
      });
    });

    it("should throw error when param is not found on widget", async () => {
      mockGetAppWidget.mockReturnValue({
        params: [{ paramName: "other-param", type: "text" }],
        endpointHeaders: {},
      });
      const paramOptionsQuery = {
        origin: "OpenBB Sandbox",
        id: "test-widget",
        param: "missing-param",
        options_endpoint_input_args: {},
      };

      const { result } = renderUseFunctionCall();
      const getParamOptions = result.current.getParamOptions;

      await act(async () => {
        await expect(getParamOptions([paramOptionsQuery])).resolves.toContainEqual({
          content: "Param missing-param not found",
          error_type: "unexpected_error",
        });
      });
    });

    it("should throw error when endpoint param has no optionsEndpoint", async () => {
      mockGetAppWidget.mockReturnValue({
        params: [{ paramName: "test-param", type: "endpoint" }],
        endpointHeaders: {},
      });

      const paramOptionsQuery = {
        origin: "OpenBB Sandbox",
        id: "test-widget",
        param: "test-param",
        options_endpoint_input_args: {},
      };

      const { result } = renderUseFunctionCall();
      const getParamOptions = result.current.getParamOptions;

      await act(async () => {
        await expect(getParamOptions([paramOptionsQuery])).resolves.toContainEqual({
          content: "Endpoint not found for param test-param",
          error_type: "unexpected_error",
        });
      });
    });
  });

  describe("addGenerativeWidget", () => {
    beforeEach(() => {
      setupDashboard();
    });

    describe("note widget creation", () => {
      it("should create a note widget with string data", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: "<p>Hello World</p>",
          name: "Test Note",
          description: "A test note widget",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Test Note");

        expect(mockAddWidget).toHaveBeenCalledWith("test-dashboard-id", {
          id: "mock-uuid-1234",
          name: "Test Note",
          description: "A test note widget",
          type: "custom",
          widgetId: "rich_note-mock-uuid-1234",
          gridData: { x: 0, y: 0, w: 40, h: 12, i: "mock-uuid-1234" },
          storage: { html: "<p>Hello World</p>" },
        });
      });

      it("should create a markdown widget when note citations are provided", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const citations = [
          {
            id: "cite-1",
            signature: "web|example",
            source_info: { type: "web", name: "https://example.com" },
          },
        ];
        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: "Market update <|start_citation_id|>cite-1<|end_citation_id|>",
          name: "Cited Note",
          citations,
        };

        await act(async () => {
          await addGenerativeWidget(config);
        });

        expect(mockAddWidget).toHaveBeenCalledWith("test-dashboard-id", {
          id: "mock-uuid-1234",
          name: "Cited Note",
          description: undefined,
          type: "custom",
          widgetId: "markdown",
          gridData: { x: 0, y: 0, w: 40, h: 12, i: "mock-uuid-1234" },
          storage: {
            text: "Market update <|start_citation_id|>cite-1<|end_citation_id|>",
            citations,
            artifacts: [],
          },
        });
      });

      it("should create a markdown widget when note artifacts are provided", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const artifact = {
          uuid: "table-artifact-uuid",
          name: "table_artifact_6725b",
          description: "Country exposure table",
          type: "table",
          content: [{ country: "United States", weight: 67.61 }],
        };
        const artifacts = [
          {
            content: JSON.stringify(artifact.content),
            source_info: {
              uuid: artifact.uuid,
              name: artifact.name,
              description: "Country exposure table",
            },
            data_format: { parse_as: "table" },
          },
        ];
        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: "See table <|start_artifact_id|>table_artifact_6725b<|end_artifact_id|>",
          name: "Artifact Note",
          artifacts,
        };

        await act(async () => {
          await addGenerativeWidget(config);
        });

        expect(mockAddWidget).toHaveBeenCalledWith("test-dashboard-id", {
          id: "mock-uuid-1234",
          name: "Artifact Note",
          description: undefined,
          type: "custom",
          widgetId: "markdown",
          gridData: { x: 0, y: 0, w: 40, h: 12, i: "mock-uuid-1234" },
          storage: {
            text: "See table <|start_artifact_id|>table_artifact_6725b<|end_artifact_id|>",
            citations: [],
            artifacts: [artifact],
          },
        });
      });

      it("should error when non-string data is passed to a note (no empty note)", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        // Note widgets only accept string data - array data must be rejected
        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: [{ content: "<p>Extracted content</p>" }],
          name: "Array Data Note",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("string data");
        expect(mockAddWidget).not.toHaveBeenCalled();
      });

      it("should error when data is an empty array for a note", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: [],
          name: "Empty Note",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(mockAddWidget).not.toHaveBeenCalled();
      });

      it("should error when non-string data is passed to an html widget", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "html",
          data: [{ content: "<p>Markup</p>" }],
          name: "Array Data Html",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("string data");
        expect(mockAddWidget).not.toHaveBeenCalled();
      });
    });

    describe("chart widget creation", () => {
      it("should create a chart widget with data and chart_params", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const chartData = [
          { date: "2024-01-01", value: 100 },
          { date: "2024-01-02", value: 150 },
        ];

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "chart",
          data: chartData,
          name: "Test Chart",
          description: "A test chart widget",
          chart_params: {
            chartType: "line",
            xKey: "date",
            yKey: ["value"],
          },
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("success");

        expect(mockAddWidget).toHaveBeenCalledWith("test-dashboard-id", {
          id: "mock-uuid-1234",
          name: "Test Chart",
          description: "A test chart widget",
          type: "custom",
          widgetId: "copilot_table-mock-uuid-1234",
          gridData: { x: 0, y: 0, w: 40, h: 12, i: "mock-uuid-1234" },
          data: {
            table: {
              showAll: true,
              enableCharts: true,
              chartView: {
                enabled: true,
                chartType: "line",
              },
            },
          },
          storage: {
            rowsData: chartData,
            chartSettingsOpen: false,
            columnDefs: [
              {
                field: "date",
                headerName: "Date",
                cellDataType: "text",
                chartDataType: "category",
              },
              {
                field: "value",
                headerName: "Value",
                cellDataType: "number",
                chartDataType: "series",
              },
            ],
            chartView: {
              enabled: true,
              chartType: "line",
            },
          },
        });
      });

      it("should error when chart_params is missing (no silent table fallback)", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const chartData = [{ x: 1, y: 10 }];

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "chart",
          data: chartData,
          name: "Simple Chart",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("chart_params");
        expect(mockAddWidget).not.toHaveBeenCalled();
      });

      it("should error when chart_params has an empty yKey", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "chart",
          data: [{ x: 1, y: 10 }],
          name: "Broken Chart",
          chart_params: { chartType: "line", xKey: "x", yKey: [] },
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("chart_params");
        expect(mockAddWidget).not.toHaveBeenCalled();
      });
    });

    describe("table widget creation", () => {
      it("should create a table widget with auto-generated column definitions", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const tableData = [
          { company_name: "Apple", market_cap: 3000000000000 },
          { company_name: "Microsoft", market_cap: 2800000000000 },
        ];

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "table",
          data: tableData,
          name: "Test Table",
          description: "A test table widget",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("success");

        expect(mockAddWidget).toHaveBeenCalledWith("test-dashboard-id", {
          id: "mock-uuid-1234",
          name: "Test Table",
          description: "A test table widget",
          type: "custom",
          widgetId: "copilot_table-mock-uuid-1234",
          gridData: { x: 0, y: 0, w: 40, h: 12, i: "mock-uuid-1234" },
          data: {
            table: {
              showAll: true,
              enableCharts: true,
              chartView: { chartType: "line" },
            },
          },
          storage: {
            rowsData: tableData,
            columns: ["company_name", "market_cap"],
          },
        });
      });

      it("should create a table widget with empty data", async () => {
        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "table",
          data: [],
          name: "Empty Table",
        };

        await act(async () => {
          await addGenerativeWidget(config);
        });

        expect(mockAddWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.objectContaining({
            type: "custom",
            widgetId: "copilot_table-mock-uuid-1234",
            storage: expect.objectContaining({
              rowsData: [],
              columns: [],
            }),
          }),
        );
      });
    });

    describe("error handling", () => {
      it("should return error result when addWidget fails", async () => {
        mockAddWidget.mockRejectedValueOnce(new Error("Failed to add widget"));

        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: "Test content",
          name: "Error Test",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toBe("Failed to add widget");
      });

      it("should handle unknown errors gracefully", async () => {
        mockAddWidget.mockRejectedValueOnce("Unknown error string");

        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "note",
          data: "Test content",
          name: "Unknown Error Test",
        };

        let response: Awaited<ReturnType<typeof addGenerativeWidget>>;
        await act(async () => {
          response = await addGenerativeWidget(config);
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toBe("Unknown error creating widget");
      });
    });

    describe("widget_info fetch", () => {
      it("should use AI-generated title/description from widget_info endpoint", async () => {
        mockSdkPost.mockResolvedValueOnce({
          data: { title: "AI Title", description: "AI Desc" },
        });

        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "table",
          data: [{ col: 1 }],
          name: "Original Name",
          description: "Original Desc",
        };

        await act(async () => {
          await addGenerativeWidget(config);
        });

        expect(mockSdkPost).toHaveBeenCalledWith(
          expect.stringContaining("/v1/generate/widget_info"),
          expect.objectContaining({
            widget_generation_request: expect.objectContaining({
              name: "Original Name",
              description: "Original Desc",
            }),
          }),
        );

        expect(mockAddWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.objectContaining({
            name: "AI Title",
            description: "AI Desc",
          }),
        );
      });

      it("should fall back to original name/description when widget_info fails", async () => {
        mockSdkPost.mockRejectedValueOnce(new Error("Network error"));

        const { result } = renderUseFunctionCall();
        const { addGenerativeWidget } = result.current;

        const config: AddGenerativeWidgetInputArgumentsT = {
          widget_type: "table",
          data: [{ col: 1 }],
          name: "Fallback Name",
          description: "Fallback Desc",
        };

        await act(async () => {
          await addGenerativeWidget(config);
        });

        expect(mockAddWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.objectContaining({
            name: "Fallback Name",
            description: "Fallback Desc",
          }),
        );
      });
    });
  }); // end addGenerativeWidget

  describe("addWidgetToDashboard - inner_tab", () => {
    it("should resolve inner_tab to uiArgs.innerTab and pass dataArgs through", async () => {
      setupDashboard({
        navBarTabs: [
          { id: "overview", name: "Overview" },
          { id: "charts", name: "Charts" },
        ],
      });

      const { result } = renderUseFunctionCall();
      const { addWidgetToDashboard } = result.current;

      await act(async () => {
        await addWidgetToDashboard([
          {
            origin: "OpenBB Sandbox",
            id: "some_widget",
            input_args: {
              inner_tab: "Overview",
              ticker: "AAPL",
            },
          },
        ]);
      });

      const callArgs = mockCreateWidget.mock.calls[0][3];
      // inner_tab stays in dataArgs (updateWidgetState whitelists by paramDef)
      expect(callArgs.dataArgs).toEqual({
        inner_tab: "Overview",
        ticker: "AAPL",
      });
      expect(callArgs.uiArgs).toEqual(
        expect.objectContaining({ innerTab: "overview" }),
      );
    });

    it("should create widget without innerTab when no nav bar exists", async () => {
      setupDashboard(); // no nav bar

      const { result } = renderUseFunctionCall();
      const { addWidgetToDashboard } = result.current;

      await act(async () => {
        await addWidgetToDashboard([
          {
            origin: "OpenBB Sandbox",
            id: "some_widget",
            input_args: {
              inner_tab: "Overview",
              ticker: "AAPL",
            },
          },
        ]);
      });

      const callArgs = mockCreateWidget.mock.calls[0][3];
      // inner_tab stays in dataArgs (updateWidgetState whitelists by paramDef)
      expect(callArgs.dataArgs).toEqual({
        inner_tab: "Overview",
        ticker: "AAPL",
      });
      // uiArgs should be undefined or not contain innerTab
      expect(callArgs.uiArgs?.innerTab).toBeUndefined();
    });

    it("should enable chart view when copilot chart intent is provided", async () => {
      const { result } = renderUseFunctionCall();
      const { addWidgetToDashboard } = result.current;

      await act(async () => {
        await addWidgetToDashboard(
          [
            {
              origin: "OpenBB Sandbox",
              id: "some_widget",
              input_args: {
                query: "SELECT * FROM metrics",
              },
            },
          ],
          {
            widget_type: "chart",
            chart_params: {
              chartType: "bar",
              xKey: "date",
              yKey: ["value"],
            },
          },
        );
      });

      const callArgs = mockCreateWidget.mock.calls[0][3];
      expect(callArgs.uiArgs).toEqual(
        expect.objectContaining({
          chartSettingsOpen: false,
          chartView: {
            enabled: true,
            chartType: "column",
          },
        }),
      );
    });

    it("should enable chart view when chart params are provided without widget type", async () => {
      const { result } = renderUseFunctionCall();
      const { addWidgetToDashboard } = result.current;

      await act(async () => {
        await addWidgetToDashboard(
          [
            {
              origin: "OpenBB Sandbox",
              id: "some_widget",
              input_args: {
                query: "SELECT * FROM metrics",
              },
            },
          ],
          {
            chart_params: {
              chartType: "line",
              xKey: "date",
              yKey: ["value"],
            },
          },
        );
      });

      const callArgs = mockCreateWidget.mock.calls[0][3];
      expect(callArgs.uiArgs).toEqual(
        expect.objectContaining({
          chartSettingsOpen: false,
          chartView: {
            enabled: true,
            chartType: "line",
          },
        }),
      );
    });
  });

  describe("addGenerativeWidget - inner_tab", () => {
    it("should assign innerTab when inner_tab matches a nav bar tab", async () => {
      setupDashboard({
        navBarTabs: [
          { id: "overview", name: "Overview" },
          { id: "charts", name: "Charts" },
        ],
      });

      const { result } = renderUseFunctionCall();
      const { addGenerativeWidget } = result.current;

      const config: AddGenerativeWidgetInputArgumentsT = {
        widget_type: "note",
        data: "Some content",
        name: "Test Note",
        inner_tab: "Charts",
      };

      await act(async () => {
        await addGenerativeWidget(config);
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        "test-dashboard-id",
        expect.objectContaining({ innerTab: "charts" }),
      );
    });

    it("should not set innerTab when no nav bar exists", async () => {
      setupDashboard(); // no nav bar

      const { result } = renderUseFunctionCall();
      const { addGenerativeWidget } = result.current;

      const config: AddGenerativeWidgetInputArgumentsT = {
        widget_type: "note",
        data: "Some content",
        name: "Test Note",
        inner_tab: "Charts",
      };

      await act(async () => {
        await addGenerativeWidget(config);
      });

      const widgetArg = mockAddWidget.mock.calls[0][1];
      expect(widgetArg.innerTab).toBeUndefined();
    });

    describe("?tab= URL fallback", () => {
      const navBarTabs = [
        { id: "overview", name: "Overview" },
        { id: "charts", name: "Charts" },
      ];

      afterEach(() => {
        window.history.pushState({}, "", "/");
      });

      it("falls back to the URL tab when inner_tab is omitted on the current dashboard", async () => {
        setupDashboard({ navBarTabs });
        window.history.pushState({}, "", "/?tab=charts");

        const { result } = renderUseFunctionCall();

        await act(async () => {
          await result.current.addGenerativeWidget({
            widget_type: "note",
            data: "Some content",
            name: "Test Note",
          });
        });

        // A navigate_workspace → add_generative_widget sequence writes the tab
        // to the URL; the widget must land on that tab, not the store's
        // lagging currentTab.
        expect(mockAddWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.objectContaining({ innerTab: "charts" }),
        );
      });

      it("prefers an explicit inner_tab over the URL tab", async () => {
        setupDashboard({ navBarTabs });
        window.history.pushState({}, "", "/?tab=overview");

        const { result } = renderUseFunctionCall();

        await act(async () => {
          await result.current.addGenerativeWidget({
            widget_type: "note",
            data: "Some content",
            name: "Test Note",
            inner_tab: "Charts",
          });
        });

        expect(mockAddWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.objectContaining({ innerTab: "charts" }),
        );
      });

      it("ignores the URL tab when targeting a different dashboard", async () => {
        // The other dashboard has a matching tab, so only the dashboard-id
        // guard prevents the URL fallback from applying.
        mockItems["other-dashboard-id"] = {
          data: {
            widgets: [
              {
                id: "nav-bar-widget-id",
                widgetId: "navigation_bar",
                storage: { tabs: navBarTabs },
              },
            ],
          },
        };
        window.history.pushState({}, "", "/?tab=charts");

        const { result } = renderUseFunctionCall();

        await act(async () => {
          await result.current.addGenerativeWidget(
            {
              widget_type: "note",
              data: "Some content",
              name: "Test Note",
            },
            { dashboardId: "other-dashboard-id" },
          );
        });

        const widgetArg = mockAddWidget.mock.calls[0][1];
        expect(widgetArg.innerTab).toBeUndefined();
      });
    });
  });

  // Helper to set up mock dashboard with optional navigation bar
  function setupDashboard(
    opts: { navBarTabs?: { id: string; name: string }[]; navBarId?: string } = {},
  ) {
    const widgets: Partial<{
      id: string;
      widgetId: string;
      storage: Record<string, unknown>;
    }>[] = [];
    if (opts.navBarTabs) {
      widgets.push({
        id: opts.navBarId || "nav-bar-widget-id",
        widgetId: "navigation_bar",
        storage: { tabs: opts.navBarTabs },
      });
    }
    mockItems["test-dashboard-id"] = {
      data: { widgets },
    };
  }

  describe("manageNavigationBar", () => {
    describe("create", () => {
      it("should create a navigation bar with tabs when none exists", async () => {
        setupDashboard();
        mockGetJsonWidget.mockReturnValue({
          widgetId: "navigation_bar",
          storage: {},
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "create",
            tabs: [{ name: "Overview" }, { name: "Analysis" }],
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Overview");
        expect(response![0].message).toContain("Analysis");
        expect(mockAddWidgets).toHaveBeenCalledWith(
          "test-dashboard-id",
          expect.arrayContaining([
            expect.objectContaining({
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "overview", name: "Overview" },
                  { id: "analysis", name: "Analysis" },
                ],
              },
            }),
          ]),
        );
      });

      it("should return error when navigation bar already exists", async () => {
        setupDashboard({
          navBarTabs: [{ id: "tab-1", name: "Tab 1" }],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "create",
            tabs: [{ name: "New Tab" }],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("already exists");
      });

      it("should return error when no tabs provided", async () => {
        setupDashboard();

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "create",
            tabs: [],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("At least one tab");
      });

      it("should return error on duplicate slugified tab names", async () => {
        setupDashboard();
        mockGetJsonWidget.mockReturnValue({
          widgetId: "navigation_bar",
          storage: {},
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "create",
            tabs: [{ name: "Tab A" }, { name: "tab-a" }],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("Duplicate tab name");
      });
    });

    describe("add_tabs", () => {
      it("should add new tabs to existing navigation bar", async () => {
        setupDashboard({
          navBarTabs: [{ id: "overview", name: "Overview" }],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "add_tabs",
            tabs: [{ name: "Charts" }],
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Charts");
        expect(mockUpdateInnerTabs).toHaveBeenCalled();
        expect(mockTriggerCustomEvent).toHaveBeenCalled();
      });

      it("should return error when no navigation bar exists", async () => {
        setupDashboard();

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "add_tabs",
            tabs: [{ name: "Charts" }],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("No navigation bar found");
      });

      it("should return error when tab already exists by slug", async () => {
        setupDashboard({
          navBarTabs: [{ id: "overview", name: "Overview" }],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "add_tabs",
            tabs: [{ name: "Overview" }],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("already exists");
      });
    });

    describe("remove_tabs", () => {
      it("should remove specified tabs", async () => {
        setupDashboard({
          navBarTabs: [
            { id: "overview", name: "Overview" },
            { id: "charts", name: "Charts" },
            { id: "analysis", name: "Analysis" },
          ],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "remove_tabs",
            tabs: [{ name: "Charts" }],
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Removed tabs: Charts");
        expect(mockUpdateInnerTabs).toHaveBeenCalled();
      });

      it("should remove entire navbar when all tabs removed", async () => {
        setupDashboard({
          navBarTabs: [{ id: "overview", name: "Overview" }],
          navBarId: "nav-widget-1",
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "remove_tabs",
            tabs: [{ name: "Overview" }],
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Navigation bar has been deleted");
        expect(mockRemoveWidget).toHaveBeenCalledWith(
          "test-dashboard-id",
          "nav-widget-1",
        );
      });

      it("should report which tabs were not found", async () => {
        setupDashboard({
          navBarTabs: [
            { id: "overview", name: "Overview" },
            { id: "charts", name: "Charts" },
          ],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "remove_tabs",
            tabs: [{ name: "Overview" }, { name: "Nonexistent" }],
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain("Removed tabs: Overview");
        expect(response![0].message).toContain("not found (skipped): Nonexistent");
      });

      it("should return error when no navigation bar exists", async () => {
        setupDashboard();

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "remove_tabs",
            tabs: [{ name: "Tab" }],
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("No navigation bar found");
      });
    });

    describe("rename_tabs", () => {
      it("should rename tabs via rename_map", async () => {
        setupDashboard({
          navBarTabs: [
            { id: "overview", name: "Overview" },
            { id: "charts", name: "Charts" },
          ],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "rename_tabs",
            rename_map: { Overview: "Dashboard" },
          });
        });

        expect(response![0].status).toBe("success");
        expect(response![0].message).toContain('"Overview" → "Dashboard"');
        expect(mockUpdateInnerTabs).toHaveBeenCalled();
      });

      it("should return error when a rename would duplicate an existing tab name", async () => {
        setupDashboard({
          navBarTabs: [
            { id: "tab-a", name: "Tab A" },
            { id: "tab-b", name: "Tab B" },
          ],
        });

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "rename_tabs",
            rename_map: { "Tab B": "Tab A" },
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("duplicate tab name");
      });

      it("should return error when no navigation bar exists", async () => {
        setupDashboard();

        const { result } = renderHook(() => useManageNavigationBar());
        const manageNavigationBar = result.current;

        let response: CopilotCommandResultT[] | undefined;
        await act(async () => {
          response = await manageNavigationBar({
            operation: "rename_tabs",
            rename_map: { Overview: "Dashboard" },
          });
        });

        expect(response![0].status).toBe("error");
        expect(response![0].message).toContain("No navigation bar found");
      });
    });
  });

  describe("resolveInnerTabId", () => {
    // resolveInnerTabId is internal to the hook, but we can test it indirectly
    // through addWidgetToDashboard which uses it for inner_tab resolution.
    // For direct testing, we verify the matching logic via manageNavigationBar's
    // remove_tabs which uses the same findTabMatch helper.

    it("should match tab by slug", async () => {
      setupDashboard({
        navBarTabs: [
          { id: "my-overview", name: "My Overview" },
          { id: "charts", name: "Charts" },
        ],
      });

      const { result } = renderHook(() => useManageNavigationBar());
      const manageNavigationBar = result.current;

      // remove_tabs uses findTabMatch (same as resolveInnerTabId)
      // Passing the slug "my-overview" should match the tab
      let response: CopilotCommandResultT[] | undefined;
      await act(async () => {
        response = await manageNavigationBar({
          operation: "remove_tabs",
          tabs: [{ name: "my-overview" }],
        });
      });

      expect(response![0].status).toBe("success");
      expect(response![0].message).toContain("My Overview");
    });

    it("should match tab by case-insensitive name", async () => {
      setupDashboard({
        navBarTabs: [
          { id: "overview", name: "Overview" },
          { id: "charts", name: "Charts" },
        ],
      });

      const { result } = renderHook(() => useManageNavigationBar());
      const manageNavigationBar = result.current;

      let response: CopilotCommandResultT[] | undefined;
      await act(async () => {
        response = await manageNavigationBar({
          operation: "remove_tabs",
          tabs: [{ name: "OVERVIEW" }],
        });
      });

      expect(response![0].status).toBe("success");
      expect(response![0].message).toContain("Overview");
    });

    it("should not match when no match found", async () => {
      setupDashboard({
        navBarTabs: [{ id: "overview", name: "Overview" }],
      });

      const { result } = renderHook(() => useManageNavigationBar());
      const manageNavigationBar = result.current;

      let response: CopilotCommandResultT[] | undefined;
      await act(async () => {
        response = await manageNavigationBar({
          operation: "remove_tabs",
          tabs: [{ name: "Nonexistent Tab" }],
        });
      });

      expect(response![0].status).toBe("success");
      expect(response![0].message).toContain("not found (skipped): Nonexistent Tab");
      // updateInnerTabs should NOT be called since nothing was actually removed
      expect(mockUpdateInnerTabs).not.toHaveBeenCalled();
    });
  });
});

describe("convertToCopilotData pattern", () => {
  it("should convert array data", () => {
    const data = [{ value: 1 }, { value: 2 }];
    const jsonString = JSON.stringify(data);
    const result = convertToCopilotData(data);

    expect(result.items).toContainEqual({ content: jsonString });
    expect(result.extra_citations).toBe(undefined);
  });

  it("should convert object data", () => {
    const data = { value: 1, name: "test" };
    const jsonString = JSON.stringify(data);
    const result = convertToCopilotData(data);

    expect(result.items).toEqual([{ content: jsonString }]);
    expect(result.extra_citations).toBe(undefined);
  });

  it("should extract extra_citations from object", () => {
    const data = {
      value: 1,
      extra_citations: [{ id: "cite-1", source: "test" }],
    };
    const jsonString = JSON.stringify(data);
    const result = convertToCopilotData(data);

    expect(result.items).toEqual([{ content: jsonString }]);
    expect(result.extra_citations).toBe(undefined);
  });

  it("should handle null data", () => {
    const result = convertToCopilotData(null);

    expect(result.items).toEqual([{ content: "null" }]);
    expect(result.extra_citations).toBe(undefined);
  });

  it("should handle undefined data", () => {
    const result = convertToCopilotData(undefined);

    expect(result.items).toEqual([{}]);
    expect(result.extra_citations).toBe(undefined);
  });
});

describe("extractUuidFromWidgetId pattern", () => {
  it("should extract UUID from widget id with prefix", () => {
    const widgetId = "file_123e4567-e89b-12d3-a456-426614174000";
    const result = extractUuidFromWidgetId(widgetId);
    expect(result).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should extract UUID from widget id with suffix", () => {
    const widgetId = "123e4567-e89b-12d3-a456-426614174000_widget";
    const result = extractUuidFromWidgetId(widgetId);
    expect(result).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should return null for widget id without UUID", () => {
    const widgetId = "simple_widget_id";
    const result = extractUuidFromWidgetId(widgetId);
    expect(result).toBeNull();
  });

  it("should handle standalone UUID", () => {
    const widgetId = "123e4567-e89b-12d3-a456-426614174000";
    const result = extractUuidFromWidgetId(widgetId);
    expect(result).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should handle uppercase UUIDs", () => {
    const widgetId = "file_123E4567-E89B-12D3-A456-426614174000";
    const result = extractUuidFromWidgetId(widgetId);
    expect(result).toBe("123E4567-E89B-12D3-A456-426614174000");
  });
});
