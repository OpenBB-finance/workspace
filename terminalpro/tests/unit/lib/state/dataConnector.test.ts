/**
 * Tests for dataConnector Zustand store
 *
 * Tests the data connector state management including:
 * - Database management (set, get)
 * - Snowflake database support
 * - Data connector URL and version management
 * - Version validation
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataConnectorStore } from "~/lib/state/dataConnector";

// Mock semver
vi.mock("semver", () => ({
  default: {
    gte: vi.fn((version: string, minVersion: string) => {
      // Simple version comparison for testing
      const parseVersion = (v: string) =>
        v.split(".").map((n) => parseInt(n, 10));
      const [major1, minor1 = 0, patch1 = 0] = parseVersion(version);
      const [major2, minor2 = 0, patch2 = 0] = parseVersion(minVersion);

      if (major1 !== major2) return major1 >= major2;
      if (minor1 !== minor2) return minor1 >= minor2;
      return patch1 >= patch2;
    }),
  },
}));

// Mock import.meta.env
vi.stubEnv("VITE_DATA_CONNECTOR_MIN_VERSION", "1.0.0");

describe("useDataConnectorStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useDataConnectorStore.setState({
        databases: [],
        snowflakes: [],
        dataConnectorUrl: undefined,
        dataConnectorVersion: undefined,
      });
    });
  });

  describe("initial state", () => {
    it("should have empty databases initially", () => {
      const state = useDataConnectorStore.getState();
      expect(state.databases).toEqual([]);
    });

    it("should have empty snowflakes initially", () => {
      const state = useDataConnectorStore.getState();
      expect(state.snowflakes).toEqual([]);
    });

    it("should have undefined dataConnectorUrl initially", () => {
      const state = useDataConnectorStore.getState();
      expect(state.dataConnectorUrl).toBeUndefined();
    });

    it("should have undefined dataConnectorVersion initially", () => {
      const state = useDataConnectorStore.getState();
      expect(state.dataConnectorVersion).toBeUndefined();
    });
  });

  describe("setDatabases", () => {
    it("should set databases", () => {
      const mockDatabases = [
        {
          id: 1,
          name: "Test DB",
          query: "SELECT * FROM table",
          connection: 1,
          database: "test",
          databaseType: "postgres",
          category: "Development",
          subCategory: "Testing",
          description: "Test database",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("database", mockDatabases);
      });

      const databases = useDataConnectorStore.getState().databases;
      expect(databases).toHaveLength(1);
      expect(databases[0].name).toBe("Test DB");
    });

    it("should convert camelCase keys to snake_case", () => {
      const mockDatabases = [
        {
          id: 1,
          name: "Test",
          query: "",
          connection: 1,
          database: "test",
          databaseType: "mysql", // should become database_type
          category: "Dev",
          subCategory: "Test", // should remain as subCategory
          description: "",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("database", mockDatabases);
      });

      const databases = useDataConnectorStore.getState().databases;
      expect(databases[0]).toHaveProperty("database_type");
      expect(databases[0]).toHaveProperty("subCategory"); // preserved
    });

    it("should handle empty array", () => {
      act(() => {
        useDataConnectorStore.getState().setDatabases("database", []);
      });

      expect(useDataConnectorStore.getState().databases).toEqual([]);
    });

    it("should replace existing databases", () => {
      act(() => {
        useDataConnectorStore.getState().setDatabases("database", [
          {
            id: 1,
            name: "First",
            query: "",
            connection: 1,
            database: "first",
            // @ts-expect-error - ignored for now
            databaseType: "postgres",
            category: "A",
            subCategory: "B",
            description: "",
          },
        ]);
      });

      act(() => {
        useDataConnectorStore.getState().setDatabases("database", [
          {
            id: 2,
            name: "Second",
            query: "",
            connection: 2,
            database: "second",
            // @ts-expect-error - ignored for now
            databaseType: "mysql",
            category: "C",
            subCategory: "D",
            description: "",
          },
        ]);
      });

      const databases = useDataConnectorStore.getState().databases;
      expect(databases).toHaveLength(1);
      expect(databases[0].name).toBe("Second");
    });
  });

  describe("setDatabases for snowflake", () => {
    it("should set snowflake databases", () => {
      const mockSnowflakes = [
        {
          id: 1,
          name: "Snowflake DB",
          query: "SELECT * FROM table",
          connection: 1,
          database: "snow",
          databaseType: "snowflake",
          category: "Analytics",
          subCategory: "Reporting",
          description: "Snowflake connection",
          role: "ANALYST",
          warehouse: "COMPUTE_WH",
          databaseSchema: "PUBLIC",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("snowflake", mockSnowflakes);
      });

      const snowflakes = useDataConnectorStore.getState().snowflakes;
      expect(snowflakes).toHaveLength(1);
      expect(snowflakes[0].name).toBe("Snowflake DB");
    });
  });

  describe("getDatabases", () => {
    it("should return databases for database type", () => {
      const mockDatabases = [
        {
          id: 1,
          name: "Test",
          query: "",
          connection: 1,
          database: "test",
          databaseType: "postgres",
          category: "",
          subCategory: "",
          description: "",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("database", mockDatabases);
      });

      const result = useDataConnectorStore.getState().getDatabases("database");
      expect(result).toHaveLength(1);
    });

    it("should return snowflakes for snowflake type", () => {
      const mockSnowflakes = [
        {
          id: 1,
          name: "Snow",
          query: "",
          connection: 1,
          database: "snow",
          databaseType: "snowflake",
          category: "",
          subCategory: "",
          description: "",
          role: "",
          warehouse: "",
          databaseSchema: "",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("snowflake", mockSnowflakes);
      });

      const result = useDataConnectorStore.getState().getDatabases("snowflake");
      expect(result).toHaveLength(1);
    });
  });

  describe("getDataBaseDetails", () => {
    it("should return database by id", () => {
      const mockDatabases = [
        {
          id: 1,
          name: "First",
          query: "",
          connection: 1,
          database: "",
          databaseType: "",
          category: "",
          subCategory: "",
          description: "",
        },
        {
          id: 2,
          name: "Second",
          query: "",
          connection: 2,
          database: "",
          databaseType: "",
          category: "",
          subCategory: "",
          description: "",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("database", mockDatabases);
      });

      const result = useDataConnectorStore.getState().getDataBaseDetails("database", 2);
      expect(result?.name).toBe("Second");
    });

    it("should return undefined for non-existent id", () => {
      const mockDatabases = [
        {
          id: 1,
          name: "Only",
          query: "",
          connection: 1,
          database: "",
          databaseType: "",
          category: "",
          subCategory: "",
          description: "",
        },
      ];

      act(() => {
        // @ts-expect-error - ignored for now
        useDataConnectorStore.getState().setDatabases("database", mockDatabases);
      });

      const result = useDataConnectorStore.getState().getDataBaseDetails("database", 999);
      expect(result).toBeUndefined();
    });
  });

  describe("dataConnectorUrl", () => {
    it("should set data connector URL", () => {
      const url = new URL("http://localhost:8080");

      act(() => {
        useDataConnectorStore.getState().setDataConnectorUrl(url);
      });

      expect(useDataConnectorStore.getState().dataConnectorUrl).toEqual(url);
    });

    it("should clear data connector URL", () => {
      const url = new URL("http://localhost:8080");

      act(() => {
        useDataConnectorStore.getState().setDataConnectorUrl(url);
      });

      act(() => {
        useDataConnectorStore.getState().setDataConnectorUrl(undefined);
      });

      expect(useDataConnectorStore.getState().dataConnectorUrl).toBeUndefined();
    });
  });

  describe("dataConnectorVersion", () => {
    it("should set data connector version", () => {
      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion("1.2.3");
      });

      expect(useDataConnectorStore.getState().dataConnectorVersion).toBe("1.2.3");
    });

    it("should clear data connector version", () => {
      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion("1.2.3");
      });

      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion(undefined);
      });

      expect(useDataConnectorStore.getState().dataConnectorVersion).toBeUndefined();
    });
  });

  describe("validVersion", () => {
    it("should return true when version is undefined", () => {
      expect(useDataConnectorStore.getState().validVersion()).toBe(true);
    });

    it("should return true when version is greater than minimum", () => {
      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion("2.0.0");
      });

      expect(useDataConnectorStore.getState().validVersion()).toBe(true);
    });

    it("should return true when version equals minimum", () => {
      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion("1.0.0");
      });

      expect(useDataConnectorStore.getState().validVersion()).toBe(true);
    });

    it("should return false when version is less than minimum", () => {
      act(() => {
        useDataConnectorStore.getState().setDataConnectorVersion("0.9.0");
      });

      expect(useDataConnectorStore.getState().validVersion()).toBe(false);
    });
  });
});
