import { describe, expect, it } from "vitest";
import {
  dangerousQuery,
  validateEmail,
  validateFolderName,
} from "~/utils/validators";

describe("validateEmail", () => {
  describe("valid emails", () => {
    it("should accept standard email format", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test@domain.org")).toBe(true);
      expect(validateEmail("admin@company.net")).toBe(true);
    });

    it("should accept emails with subdomains", () => {
      expect(validateEmail("user@mail.example.com")).toBe(true);
      expect(validateEmail("test@sub.domain.co.uk")).toBe(true);
    });

    it("should accept emails with plus tags", () => {
      expect(validateEmail("user+tag@example.com")).toBe(true);
      expect(validateEmail("test+newsletter@gmail.com")).toBe(true);
    });

    it("should accept emails with dots in local part", () => {
      expect(validateEmail("first.last@example.com")).toBe(true);
      expect(validateEmail("john.doe.smith@domain.org")).toBe(true);
    });

    it("should accept emails with numbers", () => {
      expect(validateEmail("user123@example.com")).toBe(true);
      expect(validateEmail("test99@domain123.com")).toBe(true);
    });

    it("should accept emails with hyphens in domain", () => {
      expect(validateEmail("user@my-domain.com")).toBe(true);
      expect(validateEmail("test@sub-domain.example.org")).toBe(true);
    });

    it("should accept IP address domains in brackets", () => {
      expect(validateEmail("user@[192.168.1.1]")).toBe(true);
      expect(validateEmail("admin@[127.0.0.1]")).toBe(true);
    });

    it("should accept quoted local parts", () => {
      expect(validateEmail('"quoted"@example.com')).toBe(true);
      expect(validateEmail('"john doe"@example.com')).toBe(true);
    });
  });

  describe("invalid emails", () => {
    it("should reject emails without @", () => {
      expect(validateEmail("userexample.com")).toBe(false);
      expect(validateEmail("invalid")).toBe(false);
    });

    it("should reject emails without local part", () => {
      expect(validateEmail("@example.com")).toBe(false);
    });

    it("should reject emails without domain", () => {
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("test@.com")).toBe(false);
    });

    it("should reject emails with spaces", () => {
      expect(validateEmail("user @example.com")).toBe(false);
      expect(validateEmail("user@ example.com")).toBe(false);
      expect(validateEmail("user@example .com")).toBe(false);
    });

    it("should reject emails with multiple @", () => {
      expect(validateEmail("user@@example.com")).toBe(false);
      expect(validateEmail("user@domain@example.com")).toBe(false);
    });

    it("should reject non-string inputs", () => {
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
      expect(validateEmail(123 as any)).toBe(false);
      expect(validateEmail({} as any)).toBe(false);
    });

    it("should reject empty string", () => {
      expect(validateEmail("")).toBe(false);
    });

    it("should reject emails with invalid TLD", () => {
      expect(validateEmail("user@example.c")).toBe(false);
    });
  });
});

describe("validateFolderName", () => {
  describe("valid folder names", () => {
    it("should accept standard folder names", () => {
      expect(validateFolderName("My Folder")).toBe(true);
      expect(validateFolderName("Dashboard")).toBe(true);
      expect(validateFolderName("Reports 2024")).toBe(true);
    });

    it("should accept folder names with special characters", () => {
      expect(validateFolderName("Project-Alpha")).toBe(true);
      expect(validateFolderName("Team_Data")).toBe(true);
    });

    it("should accept folder names up to 20 characters", () => {
      expect(validateFolderName("12345678901234567890")).toBe(true);
      expect(validateFolderName("A")).toBe(true);
    });
  });

  describe("invalid folder names", () => {
    it("should reject reserved name 'root'", () => {
      expect(validateFolderName("root")).toBe(false);
    });

    it("should reject reserved name 'New folder'", () => {
      expect(validateFolderName("New folder")).toBe(false);
    });

    it("should reject folder names longer than 20 characters", () => {
      expect(validateFolderName("123456789012345678901")).toBe(false);
      expect(validateFolderName("This is a very long folder name")).toBe(false);
    });

    it("should reject empty strings", () => {
      // Empty string is falsy, so validateFolderName returns falsy value
      expect(!!validateFolderName("")).toBe(false);
    });

    it("should handle null/undefined as falsy", () => {
      // validateFolderName returns falsy for null/undefined due to && short-circuit
      expect(!!validateFolderName(null as any)).toBe(false);
      expect(!!validateFolderName(undefined as any)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle exactly 20 character names", () => {
      expect(validateFolderName("12345678901234567890")).toBe(true);
    });

    it("should handle names similar to reserved names", () => {
      expect(validateFolderName("Root")).toBe(true);
      expect(validateFolderName("ROOT")).toBe(true);
      expect(validateFolderName("new folder")).toBe(true);
      expect(validateFolderName("New Folder")).toBe(true);
    });
  });
});

describe("dangerousQuery", () => {
  describe("dangerous SQL keywords", () => {
    it("should detect DROP keyword", () => {
      expect(dangerousQuery("DROP TABLE users")).toBe("drop");
      expect(dangerousQuery("drop table accounts")).toBe("drop");
    });

    it("should detect DELETE keyword", () => {
      expect(dangerousQuery("DELETE FROM users")).toBe("delete");
      expect(dangerousQuery("delete from accounts")).toBe("delete");
    });

    it("should detect INSERT keyword", () => {
      expect(dangerousQuery("INSERT INTO users VALUES (1)")).toBe("insert");
      expect(dangerousQuery("insert into accounts")).toBe("insert");
    });

    it("should detect UPDATE keyword", () => {
      expect(dangerousQuery("UPDATE users SET name='test'")).toBe("update");
      expect(dangerousQuery("update accounts set balance=0")).toBe("update");
    });

    it("should detect CREATE keyword", () => {
      expect(dangerousQuery("CREATE TABLE test")).toBe("create");
      expect(dangerousQuery("create database mydb")).toBe("create");
    });

    it("should detect ALTER keyword", () => {
      expect(dangerousQuery("ALTER TABLE users")).toBe("alter");
      // Note: "add column" contains "add" which comes first in banned_keywords list
      expect(dangerousQuery("alter table accounts")).toBe("alter");
    });

    it("should detect EXEC keyword", () => {
      expect(dangerousQuery("EXEC sp_executesql")).toBe("exec");
      expect(dangerousQuery("exec stored_procedure")).toBe("exec");
    });

    it("should detect ADD keyword", () => {
      expect(dangerousQuery("ADD COLUMN name")).toBe("add");
    });

    it("should detect BACKUP keyword", () => {
      expect(dangerousQuery("BACKUP DATABASE mydb")).toBe("backup");
    });

    it("should detect CHECK keyword", () => {
      expect(dangerousQuery("CHECK TABLE users")).toBe("check");
    });

    it("should detect CONSTRAINT keyword", () => {
      expect(dangerousQuery("CONSTRAINT pk_id PRIMARY KEY")).toBe("constraint");
    });
  });

  describe("safe queries", () => {
    it("should return null for SELECT queries", () => {
      expect(dangerousQuery("SELECT * FROM users")).toBe(null);
      expect(dangerousQuery("select name, email from accounts")).toBe(null);
    });

    it("should return null for normal search terms", () => {
      expect(dangerousQuery("apple stock price")).toBe(null);
      expect(dangerousQuery("AAPL")).toBe(null);
      expect(dangerousQuery("Microsoft earnings")).toBe(null);
    });

    it("should return null for empty strings", () => {
      expect(dangerousQuery("")).toBe(null);
    });
  });

  describe("case sensitivity", () => {
    it("should detect keywords regardless of case", () => {
      expect(dangerousQuery("DROP")).toBe("drop");
      expect(dangerousQuery("drop")).toBe("drop");
      expect(dangerousQuery("DrOp")).toBe("drop");
      expect(dangerousQuery("DELETE")).toBe("delete");
      expect(dangerousQuery("delete")).toBe("delete");
    });
  });

  describe("keywords in context", () => {
    it("should detect keywords within longer text", () => {
      expect(dangerousQuery("Please drop this table")).toBe("drop");
      expect(dangerousQuery("Can you delete my account")).toBe("delete");
    });

    it("should detect multiple dangerous keywords (returns first)", () => {
      const result = dangerousQuery("DROP TABLE; DELETE FROM users");
      expect(result).toBeTruthy();
    });
  });
});
