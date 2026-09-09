import { describe, it, expect } from "vitest";
import { formatSSRMError } from "~/components/General/Table/AgGridSSRMAdvanced";

describe("formatSSRMError", () => {
  it("short error without colon returns default title and full error as details", () => {
    const result = formatSSRMError("Something went wrong");
    expect(result.title).toBe("An error occurred");
    expect(result.details).toBe("Something went wrong");
    expect(result.fullError).toBe("Something went wrong");
    expect(result.shortError).toBe("Something went wrong");
  });

  it("short error with colon splits into title and details", () => {
    const result = formatSSRMError("NetworkError: Failed to fetch");
    expect(result.title).toBe("NetworkError");
    expect(result.details).toBe("Failed to fetch");
  });

  it("long error produces truncated shortError with ellipsis while fullError remains intact", () => {
    const long = "A".repeat(50) + ": " + "B".repeat(80);
    const result = formatSSRMError(long);
    expect(result.fullError).toBe(long);
    expect(result.shortError).toHaveLength(103); // 100 chars + "..."
    expect(result.shortError.endsWith("...")).toBe(true);
  });

  it("normalizes tabs, newlines, and multiple spaces into single spaces", () => {
    const result = formatSSRMError("  Error:\t  bad\n\nthings  happened  ");
    expect(result.fullError).toBe("Error: bad things happened");
    expect(result.title).toBe("Error");
    expect(result.details).toBe("bad things happened");
  });

  it("empty string returns default title and empty details", () => {
    const result = formatSSRMError("");
    expect(result.title).toBe("An error occurred");
    expect(result.details).toBe("");
    expect(result.fullError).toBe("");
    expect(result.shortError).toBe("");
  });

  it("colon at position 0 returns default title", () => {
    const result = formatSSRMError(": some message");
    expect(result.title).toBe("An error occurred");
    expect(result.details).toBe(": some message");
  });
});
