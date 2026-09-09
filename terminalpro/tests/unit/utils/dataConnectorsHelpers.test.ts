import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isDatabaseType,
  formatUrl,
  getActiveItem,
} from "~/utils/dataConnectorsHelpers";
import type { DBType, DatabaseT } from "~/api/dataConnectors";
import type { Database, SnowflakeDatabase } from "~/lib/state/dataConnector";

describe("dataConnectorsHelpers", () => {
  describe("isDatabaseType", () => {
    it("should return true for 'database' type", () => {
      expect(isDatabaseType("database")).toBe(true);
    });

    it("should return true for 'snowflake' type", () => {
      expect(isDatabaseType("snowflake")).toBe(true);
    });

    it("should return false for 'file' type", () => {
      expect(isDatabaseType("file")).toBe(false);
    });

    it("should return false for 'single' type", () => {
      expect(isDatabaseType("single")).toBe(false);
    });

    it("should return false for 'platform' type", () => {
      expect(isDatabaseType("platform")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isDatabaseType("")).toBe(false);
    });

    it("should return false for random string", () => {
      expect(isDatabaseType("random")).toBe(false);
    });

    it("should return false for 'Database' (case sensitive)", () => {
      expect(isDatabaseType("Database")).toBe(false);
    });

    it("should return false for 'SNOWFLAKE' (case sensitive)", () => {
      expect(isDatabaseType("SNOWFLAKE")).toBe(false);
    });

    it("should return false for 'database-parent' (similar but different)", () => {
      expect(isDatabaseType("database-parent")).toBe(false);
    });

    it("should return false for 'snowflake-parent' (similar but different)", () => {
      expect(isDatabaseType("snowflake-parent")).toBe(false);
    });
  });

  describe("formatUrl", () => {
    describe("snowflake URL extraction", () => {
      it("should extract account identifier from snowflake URL", () => {
        const url = "https://xy12345.us-east-1.snowflakecomputing.com";
        expect(formatUrl(url)).toBe("xy12345.us-east-1");
      });

      it("should extract simple account identifier", () => {
        const url = "https://myaccount.snowflakecomputing.com";
        expect(formatUrl(url)).toBe("myaccount");
      });

      it("should extract account with region and cloud provider", () => {
        const url = "https://abc123.eu-west-1.aws.snowflakecomputing.com";
        expect(formatUrl(url)).toBe("abc123.eu-west-1.aws");
      });

      it("should extract account with multiple subdomains", () => {
        const url = "https://orgname-accountname.region.cloud.snowflakecomputing.com";
        expect(formatUrl(url)).toBe("orgname-accountname.region.cloud");
      });
    });

    describe("non-snowflake URLs", () => {
      it("should return original URL if not a snowflake URL", () => {
        const url = "https://example.com";
        expect(formatUrl(url)).toBe(url);
      });

      it("should return original URL for http protocol", () => {
        const url = "http://localhost:8080";
        expect(formatUrl(url)).toBe(url);
      });

      it("should return original URL for partial snowflake domain", () => {
        const url = "https://snowflakecomputing.com";
        expect(formatUrl(url)).toBe(url);
      });

      it("should return original URL for snowflake in subdomain only", () => {
        const url = "https://snowflake.example.com";
        expect(formatUrl(url)).toBe(url);
      });
    });

    describe("edge cases", () => {
      it("should return empty string unchanged", () => {
        expect(formatUrl("")).toBe("");
      });

      it("should return plain text unchanged", () => {
        expect(formatUrl("not-a-url")).toBe("not-a-url");
      });

      it("should return URL with path unchanged (doesn't match pattern)", () => {
        const url = "https://myaccount.snowflakecomputing.com/path";
        expect(formatUrl(url)).toBe(url);
      });

      it("should return URL with query params unchanged", () => {
        const url = "https://myaccount.snowflakecomputing.com?param=value";
        expect(formatUrl(url)).toBe(url);
      });

      it("should return URL with port unchanged", () => {
        const url = "https://myaccount.snowflakecomputing.com:443";
        expect(formatUrl(url)).toBe(url);
      });

      it("should handle URL with trailing slash (doesn't match pattern)", () => {
        const url = "https://myaccount.snowflakecomputing.com/";
        expect(formatUrl(url)).toBe(url);
      });
    });
  });

  describe("getActiveItem", () => {
    function createDatabase(overrides: Partial<Database> = {}): Database {
      return {
        id: 1,
        connection: 100,
        name: "Test Database",
        database: "test_db",
        database_type: "postgres",
        query: "SELECT * FROM test",
        category: "Finance",
        subCategory: "Analytics",
        description: "Test database description",
        ...overrides,
      };
    }

    function createSnowflakeDatabase(
      overrides: Partial<SnowflakeDatabase> = {},
    ): SnowflakeDatabase {
      return {
        id: 1,
        connection: 100,
        name: "Test Snowflake",
        database: "test_db",
        database_type: "snowflake",
        query: "SELECT * FROM test",
        category: "Finance",
        subCategory: "Analytics",
        description: "Test snowflake description",
        role: "ACCOUNTADMIN",
        warehouse: "COMPUTE_WH",
        database_schema: "PUBLIC",
        ...overrides,
      };
    }

    describe("when previousData is false", () => {
      it("should return undefined for database type", () => {
        const items = [createDatabase({ id: 1 })];
        const result = getActiveItem(items, "database", 1, false);
        expect(result).toBeUndefined();
      });

      it("should return undefined for snowflake type", () => {
        const items = [createSnowflakeDatabase({ id: 1 })];
        const result = getActiveItem(items as DatabaseT<"snowflake">[], "snowflake", 1, false);
        expect(result).toBeUndefined();
      });
    });

    describe("database type matching", () => {
      it("should find item by id for database type", () => {
        const items = [
          createDatabase({ id: 1, name: "First" }),
          createDatabase({ id: 2, name: "Second" }),
          createDatabase({ id: 3, name: "Third" }),
        ];

        const result = getActiveItem(items, "database", 2, true);

        expect(result).toBeDefined();
        expect(result?.name).toBe("Second");
      });

      it("should return undefined when id not found for database type", () => {
        const items = [createDatabase({ id: 1 }), createDatabase({ id: 2 })];

        const result = getActiveItem(items, "database", 999, true);

        expect(result).toBeUndefined();
      });

      it("should find item by id for snowflake type", () => {
        const items = [
          createSnowflakeDatabase({ id: 1, name: "First" }),
          createSnowflakeDatabase({ id: 2, name: "Second" }),
        ];

        const result = getActiveItem(items as DatabaseT<"snowflake">[], "snowflake", 2, true);

        expect(result).toBeDefined();
        expect(result?.name).toBe("Second");
      });
    });

    describe("parent type matching", () => {
      it("should find item by connection for database-parent type", () => {
        const items = [
          createDatabase({ id: 1, connection: 100 }),
          createDatabase({ id: 2, connection: 200 }),
          createDatabase({ id: 3, connection: 300 }),
        ];

        const result = getActiveItem(items, "database-parent" as DBType, 200, true);

        expect(result).toBeDefined();
        expect(result?.id).toBe(2);
      });

      it("should find item by connection for snowflake-parent type", () => {
        const items = [
          createSnowflakeDatabase({ id: 1, connection: 100 }),
          createSnowflakeDatabase({ id: 2, connection: 200 }),
        ];

        const result = getActiveItem(
          items as DatabaseT<"snowflake">[],
          "snowflake-parent" as DBType,
          200,
          true,
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe(2);
      });

      it("should return undefined when connection not found for parent type", () => {
        const items = [
          createDatabase({ id: 1, connection: 100 }),
          createDatabase({ id: 2, connection: 200 }),
        ];

        const result = getActiveItem(items, "database-parent" as DBType, 999, true);

        expect(result).toBeUndefined();
      });
    });

    describe("unknown type handling", () => {
      it("should return undefined for unknown types", () => {
        const items = [createDatabase({ id: 1 })];

        const result = getActiveItem(items, "unknown-type" as DBType, 1, true);

        expect(result).toBeUndefined();
      });

      it("should return undefined for file type", () => {
        const items = [createDatabase({ id: 1 })];

        const result = getActiveItem(items, "file" as DBType, 1, true);

        expect(result).toBeUndefined();
      });

      it("should return undefined for platform type", () => {
        const items = [createDatabase({ id: 1 })];

        const result = getActiveItem(items, "platform" as DBType, 1, true);

        expect(result).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("should handle empty items array", () => {
        const result = getActiveItem([], "database", 1, true);
        expect(result).toBeUndefined();
      });

      it("should handle id of 0", () => {
        const items = [createDatabase({ id: 0 })];

        const result = getActiveItem(items, "database", 0, true);

        expect(result).toBeDefined();
      });

      it("should handle negative id", () => {
        const items = [createDatabase({ id: -1 })];

        const result = getActiveItem(items, "database", -1, true);

        expect(result).toBeDefined();
      });

      it("should return first match when multiple items have same id", () => {
        const items = [
          createDatabase({ id: 1, name: "First" }),
          createDatabase({ id: 1, name: "Second" }),
        ];

        const result = getActiveItem(items, "database", 1, true);

        expect(result?.name).toBe("First");
      });

      it("should return first match when multiple items have same connection", () => {
        const items = [
          createDatabase({ connection: 100, name: "First" }),
          createDatabase({ connection: 100, name: "Second" }),
        ];

        const result = getActiveItem(items, "database-parent" as DBType, 100, true);

        expect(result?.name).toBe("First");
      });
    });
  });
});
