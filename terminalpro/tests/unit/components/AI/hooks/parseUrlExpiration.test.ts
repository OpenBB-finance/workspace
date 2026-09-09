import { describe, expect, it } from "vitest";
import { parseUrlExpiration } from "~/components/AI/hooks/useFunctionCall";

describe("parseUrlExpiration", () => {
  const DEFAULT_TTL = 3600; // seconds

  it("parses expiration from URL with trailing parameters (the bug case)", () => {
    // This was the actual bug: X-Amz-Expires followed by other params
    // Number("3600&X-Amz-SignedHeaders=...") returns NaN
    // parseInt("3600&X-Amz-SignedHeaders=...") correctly returns 3600
    const url =
      "https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260225T035434Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=abc123";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(3600 * 1000); // 3600 seconds in milliseconds
  });

  it("parses expiration when X-Amz-Expires is the last parameter", () => {
    const url =
      "https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=7200";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(7200 * 1000);
  });

  it("returns default TTL when Expires parameter is missing", () => {
    const url =
      "https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(DEFAULT_TTL * 1000);
  });

  it("returns default TTL when URL is empty", () => {
    const result = parseUrlExpiration("", DEFAULT_TTL);

    expect(result).toBe(DEFAULT_TTL * 1000);
  });

  it("handles different expiration values", () => {
    const url = "https://example.com?Expires=1800&other=param";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(1800 * 1000);
  });

  it("handles URL with only Expires parameter", () => {
    const url = "https://example.com?Expires=900";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(900 * 1000);
  });

  it("returns default TTL for malformed expiration value", () => {
    const url = "https://example.com?Expires=notanumber";

    const result = parseUrlExpiration(url, DEFAULT_TTL);

    expect(result).toBe(DEFAULT_TTL * 1000);
  });
});
