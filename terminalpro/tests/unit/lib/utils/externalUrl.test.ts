import { afterEach, describe, expect, it, vi } from "vitest";
import { openExternalUrl, safeExternalUrl } from "~/lib/utils/externalUrl";

describe("safeExternalUrl", () => {
  it.each([
    "https://acme.com",
    "http://acme.com/path?q=1",
    "HTTPS://ACME.COM",
    "https://acme.com:8443/a/b",
  ])("allows %s", (url) => {
    expect(safeExternalUrl(url)).toBe(url);
  });

  it.each([
    // eslint-disable-next-line no-script-url -- the point of the test
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("rejects %s", (url) => {
    expect(safeExternalUrl(url)).toBeNull();
  });

  it("rejects unparseable and empty values", () => {
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl("/relative/path")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("openExternalUrl", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens an http(s) URL in a noopener tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openExternalUrl("https://acme.com");
    expect(open).toHaveBeenCalledWith(
      "https://acme.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does not open a javascript: URL", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openExternalUrl("javascript:alert(1)");
    expect(open).not.toHaveBeenCalled();
  });
});
