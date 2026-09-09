import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import {
  getDatabaseDetails,
  handleWidgetMetadata,
  initiateDataConnector,
  updateVersion,
} from "~/utils/dataConnectorsHelpers";

// Mock API calls
vi.mock("~/api/dataConnectors", () => ({
  getDatabases: vi.fn().mockResolvedValue([]),
  getMetadata: vi.fn().mockResolvedValue({ version: "1.0.0" }),
}));

// Mock stores
const mockGetDataBaseDetails = vi.fn();
const mockSetDataConnectorVersion = vi.fn();
const mockSetDataConnectorUrl = vi.fn();
const mockSetDatabases = vi.fn();
const mockGetSingleWidgetById = vi.fn();
const mockGetStoredFileById = vi.fn();
const mockGetWidgetMetadataById = vi.fn();

vi.mock("~/lib/state/dataConnector", () => ({
  useDataConnectorStore: {
    getState: () => ({
      getDataBaseDetails: mockGetDataBaseDetails,
      setDataConnectorVersion: mockSetDataConnectorVersion,
      setDataConnectorUrl: mockSetDataConnectorUrl,
      setDatabases: mockSetDatabases,
    }),
  },
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useBackendConnectorStore: {
    getState: () => ({
      getSingleWidgetById: mockGetSingleWidgetById,
      getStoredFileById: mockGetStoredFileById,
      getWidgetMetadataById: mockGetWidgetMetadataById,
    }),
  },
}));

vi.mock("~/lib/utils", () => ({
  processWidgetId: vi.fn((widgetId: string, connectionType: string) => ({
    uuid: widgetId.split("-")[0] || "default-uuid",
    connectionType,
  })),
}));

describe("dataConnectorsHelpers - Additional Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDatabaseDetails", () => {
    it("returns undefined for non-database widget types", () => {
      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "widget-123",
        connectionType: "file",
      } as WidgetT;

      const result = getDatabaseDetails(widget);
      expect(result).toBeUndefined();
    });

    it("returns undefined for undefined widget", () => {
      const result = getDatabaseDetails(undefined as any);
      expect(result).toBeUndefined();
    });

    it("returns database details for database type widget", () => {
      const mockDbData = {
        id: 1,
        name: "Test DB",
        database_type: "postgres",
      };
      mockGetDataBaseDetails.mockReturnValue(mockDbData);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "db-123",
        connectionType: "database",
      } as WidgetT;

      const result = getDatabaseDetails(widget);

      expect(result).toBeDefined();
      expect(result?.database_type).toBe("postgres");
    });

    it("returns database details for snowflake type widget", () => {
      const mockDbData = {
        id: 1,
        name: "Test Snowflake",
        database_schema: "PUBLIC",
      };
      mockGetDataBaseDetails.mockReturnValue(mockDbData);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "sf-456",
        connectionType: "snowflake",
      } as WidgetT;

      const result = getDatabaseDetails(widget);

      expect(result).toBeDefined();
      // @ts-expect-error - ignored for now
      expect(result?.schema).toBe("PUBLIC");
    });

    it("defaults database_type to connectionType if not present", () => {
      mockGetDataBaseDetails.mockReturnValue({ id: 1, name: "Test" });

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "db-789",
        connectionType: "database",
      } as WidgetT;

      const result = getDatabaseDetails(widget);

      expect(result?.database_type).toBe("database");
    });
  });

  describe("updateVersion", () => {
    it("does nothing when url is undefined", async () => {
      await updateVersion(undefined);
      expect(mockSetDataConnectorVersion).not.toHaveBeenCalled();
    });

    it("calls setDataConnectorVersion with version from metadata", async () => {
      const { getMetadata } = await import("~/api/dataConnectors");
      (getMetadata as any).mockResolvedValueOnce({ version: "2.0.0" });

      await updateVersion("http://localhost:8000");

      // Wait for the promise chain
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSetDataConnectorVersion).toHaveBeenCalledWith("2.0.0");
    });
  });

  describe("initiateDataConnector", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("sets url to undefined for invalid URL", async () => {
      await initiateDataConnector("not-a-valid-url");

      expect(mockSetDataConnectorUrl).toHaveBeenCalledWith(undefined);
    });

    it("sets url to undefined when fetch fails", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await initiateDataConnector("http://localhost:8000");

      expect(mockSetDataConnectorUrl).toHaveBeenCalledWith(undefined);
    });

    it("sets url when fetch succeeds", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      await initiateDataConnector("http://localhost:8000");

      expect(mockSetDataConnectorUrl).toHaveBeenCalled();
      const callArg = mockSetDataConnectorUrl.mock.calls[0][0];
      expect(callArg?.toString()).toBe("http://localhost:8000/");
    });

    it("does not fetch databases when offline", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      await initiateDataConnector("http://localhost:8000");

      expect(mockSetDatabases).not.toHaveBeenCalled();
    });
  });

  describe("handleWidgetMetadata", () => {
    it("returns single widget by id for single connection type", () => {
      const mockWidget = { id: "single-1", name: "Single Widget" };
      mockGetSingleWidgetById.mockReturnValue(mockWidget);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "uuid-123",
        connectionType: "single",
      } as WidgetT;

      const result = handleWidgetMetadata(widget);

      expect(mockGetSingleWidgetById).toHaveBeenCalled();
      expect(result).toEqual(mockWidget);
    });

    it("returns stored file by id for file connection type", () => {
      const mockFile = { id: "file-1", name: "File" };
      mockGetStoredFileById.mockReturnValue(mockFile);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "uuid-456",
        connectionType: "file",
      } as WidgetT;

      const result = handleWidgetMetadata(widget);

      expect(mockGetStoredFileById).toHaveBeenCalled();
      expect(result).toEqual(mockFile);
    });

    it("returns database details for database connection type", () => {
      const mockDbDetails = { id: 1, database_type: "postgres" };
      mockGetDataBaseDetails.mockReturnValue(mockDbDetails);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "db-789",
        connectionType: "database",
      } as WidgetT;

      const result = handleWidgetMetadata(widget);

      expect(result).toBeDefined();
    });

    it("returns widget metadata for platform connection type", () => {
      const mockMetadata = { id: "meta-1", source: "platform" };
      mockGetWidgetMetadataById.mockReturnValue(mockMetadata);

      // @ts-expect-error - ignored for now
      const widget = {
        widgetId: "platform-123",
        connectionType: "platform",
      } as WidgetT;

      const result = handleWidgetMetadata(widget);

      expect(mockGetWidgetMetadataById).toHaveBeenCalled();
      expect(result).toEqual(mockMetadata);
    });
  });
});
