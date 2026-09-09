import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDatabase,
  getDatabases,
  getServerDatabases,
  snowflakeTables,
} from "~/api/dataConnectors";
import { useDataConnectorStore } from "~/lib/state/dataConnector";

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ user: { uuid: "test-uuid" } })),
  },
}));

vi.mock("~/lib/state/dataConnector", () => ({
  useDataConnectorStore: {
    getState: vi.fn(() => ({ dataConnectorUrl: "http://test-url/" })),
  },
}));

const fetchMock = vi.fn();

global.fetch = fetchMock;

describe("Database API functions", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  describe("getDatabases function", () => {
    it("should fetch databases correctly", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "test-db" }],
      });

      const databases = await getDatabases("database");
      expect(databases).toEqual([{ name: "test-db" }]);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-url/sql/databases",
        expect.any(Object),
      );
    });

    it("should handle no connector URL error", async () => {
      // @ts-expect-error - mockReturnValueOnce is not a method on the DataConnectorStore type
      useDataConnectorStore.getState.mockReturnValueOnce({ dataConnectorUrl: null });
      const result = await getDatabases("database");
      expect(result).toBeNull();
    });

    it("should handle fetch errors gracefully", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));
      const result = await getDatabases("database");
      expect(result).toBeNull();
    });
  });

  describe("addDatabase function", () => {
    it("should add a new database", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ detail: "success" }),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "new-db" }],
      });

      const result = await addDatabase("database", {
        name: "new-db",
        database_type: "mysql",
        username: "user",
        password: "pass",
        host: "localhost",
        database: "db",
        query: "SELECT * FROM table",
      });

      expect(result).toEqual([{ name: "new-db" }]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("getServerDatabases function", () => {
    it("should fetch server databases correctly", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ["db1", "db2"],
      });

      const databases = await getServerDatabases("database", {
        database_type: "mysql",
        username: "user",
        password: "pass",
        host: "localhost",
      });

      expect(databases).toEqual(["db1", "db2"]);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-url/sql/databases",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should handle no connector URL error for server databases", async () => {
      // @ts-expect-error - mockReturnValueOnce is not a method on the DataConnectorStore type
      useDataConnectorStore.getState.mockReturnValueOnce({ dataConnectorUrl: null });
      const result = await getServerDatabases("database", {
        database_type: "mysql",
        username: "user",
        password: "pass",
        host: "localhost",
      });
      expect(result).toEqual({ detail: "No data connector URL" });
    });
  });

  describe("snowflakeTables function", () => {
    it("should fetch snowflake tables correctly", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ database: "db", schema: "schema", table: "table" }],
      });

      const tables = await snowflakeTables({
        username: "user",
        password: "pass",
        account_identifier: "account",
      });

      expect(tables).toEqual([{ database: "db", schema: "schema", table: "table" }]);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-url/snowflake/database/validate",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should handle fetch errors for snowflake tables", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));
      const result = await snowflakeTables({
        username: "user",
        password: "pass",
        account_identifier: "account",
      });
      expect(result).toEqual({ detail: "Failed to fetch tables" });
    });
  });
});
