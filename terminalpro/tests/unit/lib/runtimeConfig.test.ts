vi.unmock("~/lib/runtimeConfig");

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getConfig,
  _resetConfig,
  parseBool,
  parseStringArray,
} from "~/lib/runtimeConfig";

let savedAppConfig: unknown;
let savedLockedConfig: unknown;

beforeEach(() => {
  savedAppConfig = window.__APP_CONFIG__;
  savedLockedConfig = globalThis.__LOCKED_CONFIG__;
  delete window.__APP_CONFIG__;
  _resetConfig();
  vi.unstubAllEnvs();
});

afterEach(() => {
  if (savedAppConfig !== undefined) {
    window.__APP_CONFIG__ = savedAppConfig;
  } else {
    delete window.__APP_CONFIG__;
  }
  (globalThis as Record<string, unknown>).__LOCKED_CONFIG__ = savedLockedConfig;
  vi.unstubAllEnvs();
});

describe("parseBool", () => {
  it("returns boolean values as-is", () => {
    expect(parseBool(true, false)).toBe(true);
    expect(parseBool(false, true)).toBe(false);
  });

  it('parses "true" and "false" strings', () => {
    expect(parseBool("true", false)).toBe(true);
    expect(parseBool("false", true)).toBe(false);
  });

  it("returns fallback for undefined/null", () => {
    expect(parseBool(undefined, true)).toBe(true);
    expect(parseBool(null, false)).toBe(false);
  });

  it("returns fallback for garbage values", () => {
    expect(parseBool("yes", false)).toBe(false);
    expect(parseBool(42, true)).toBe(true);
    expect(parseBool({}, false)).toBe(false);
  });
});

describe("parseStringArray", () => {
  it("returns array values mapped to strings", () => {
    expect(parseStringArray(["a", "b"])).toEqual(["a", "b"]);
    expect(parseStringArray([1, 2])).toEqual(["1", "2"]);
  });

  it("parses comma-separated string", () => {
    expect(parseStringArray("foo, Bar, BAZ")).toEqual(["foo", "bar", "baz"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseStringArray("")).toEqual([]);
    expect(parseStringArray("  ")).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parseStringArray(undefined)).toEqual([]);
  });

  it("returns empty array for non-string/non-array values", () => {
    expect(parseStringArray(42)).toEqual([]);
    expect(parseStringArray(null)).toEqual([]);
  });
});

describe("getConfig", () => {
  it("reads from window.__APP_CONFIG__ when valid", () => {
    window.__APP_CONFIG__ = {
      urls: { backend: "https://test.example.com", ai: "https://ai.example.com", platform: "", database: "" },
      authentication: {},
      authProviders: {},
      copilot: {},
      ui: {},
      services: {},
      data: {},
      mcp: {},
      analytics: {},
      whiteLabel: {},
    };

    const cfg = getConfig();
    expect(cfg.urls.backend).toBe("https://test.example.com");
    expect(cfg.urls.ai).toBe("https://ai.example.com");
    // Inner defaults should be applied by Zod
    expect(cfg.authentication.allowEmailLogin).toBe(true);
    expect(cfg.copilot.enabled).toBe(false);
  });

  it("falls back to env vars without window.__APP_CONFIG__", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://env-backend.test");
    vi.stubEnv("VITE_AI_API_URL", "https://env-ai.test");

    const cfg = getConfig();
    expect(cfg.urls.backend).toBe("https://env-backend.test");
    expect(cfg.urls.ai).toBe("https://env-ai.test");
  });

  it("logs error and falls back on malformed window.__APP_CONFIG__", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Zod won't fail on extra keys, so use a bad type for a required nested object
    window.__APP_CONFIG__ = { urls: "not-an-object" };

    const cfg = getConfig();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed Zod validation"),
    );
    // Should still return a valid config via env fallback
    expect(cfg.urls).toBeDefined();
    expect(typeof cfg.urls.backend).toBe("string");

    errorSpy.mockRestore();
  });

  it("caches the config on repeated calls", () => {
    const cfg1 = getConfig();
    const cfg2 = getConfig();
    expect(cfg1).toBe(cfg2);
  });

  it("returns a fresh config after _resetConfig()", () => {
    const cfg1 = getConfig();
    _resetConfig();
    const cfg2 = getConfig();
    expect(cfg1).not.toBe(cfg2);
  });

  it("falls back to env when window.__APP_CONFIG__ is partial (missing top-level keys)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Missing required top-level objects → Zod validation fails → env fallback
    window.__APP_CONFIG__ = { urls: { backend: "https://partial.test" } };

    const cfg = getConfig();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed Zod validation"),
    );
    // Falls back to env — the partial value is NOT used
    expect(cfg.urls.backend).not.toBe("https://partial.test");

    errorSpy.mockRestore();
  });

  it("applies Zod inner defaults when all top-level keys are present", () => {
    window.__APP_CONFIG__ = {
      urls: {},
      authentication: {},
      authProviders: {},
      copilot: {},
      ui: {},
      services: {},
      data: {},
      mcp: {},
      analytics: {},
      whiteLabel: {},
    };

    const cfg = getConfig();
    expect(cfg.urls.backend).toBe("");
    expect(cfg.authentication.allowEmailLogin).toBe(true);
    expect(cfg.copilot.enabled).toBe(false);
    expect(cfg.ui.defaultTheme).toBe("dark");
    expect(cfg.ui.isLite).toBe(false);
    expect(cfg.ui.showMarketplace).toBe(true);
    expect(cfg.whiteLabel.name).toBe("OpenBB Workspace");
  });

  it("reads boolean env vars via parseBool", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://x.test");
    vi.stubEnv("VITE_AI_API_URL", "https://x.test");
    vi.stubEnv("VITE_AUTHENTICATION_ALLOW_EMAIL_LOGIN", "false");
    vi.stubEnv("VITE_AI_COPILOT_ENABLED", "true");

    const cfg = getConfig();
    expect(cfg.authentication.allowEmailLogin).toBe(false);
    expect(cfg.copilot.enabled).toBe(true);
  });

  it("reads VITE_LITE into ui.isLite", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://x.test");
    vi.stubEnv("VITE_AI_API_URL", "https://x.test");
    vi.stubEnv("VITE_LITE", "true");

    const cfg = getConfig();
    expect(cfg.ui.isLite).toBe(true);
  });

  it("defaults ui.isLite to false when VITE_LITE is empty", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://x.test");
    vi.stubEnv("VITE_LITE", "");

    const cfg = getConfig();
    expect(cfg.ui.isLite).toBe(false);
  });

  it("defaults ui.showMarketplace to true and reads VITE_UI_SHOW_MARKETPLACE", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://x.test");
    vi.stubEnv("VITE_UI_SHOW_MARKETPLACE", "false");

    const cfg = getConfig();
    expect(cfg.ui.showMarketplace).toBe(false);
  });

  it("reads string array env vars via parseStringArray", () => {
    vi.stubEnv("VITE_PAYMENTS_URL", "https://x.test");
    vi.stubEnv("VITE_AI_API_URL", "https://x.test");
    vi.stubEnv("VITE_AUTHENTICATION_IDENTITY_PROVIDERS", "google, microsoft");

    const cfg = getConfig();
    expect(cfg.authentication.identityProviders).toEqual([
      "google",
      "microsoft",
    ]);
  });
});

describe("locked config fields", () => {
  it("overrides window.__APP_CONFIG__ value", () => {
    vi.stubGlobal("__LOCKED_CONFIG__", { data: { allowHtmlJsExecution: false } });
    window.__APP_CONFIG__ = {
      urls: {},
      authentication: {},
      authProviders: {},
      copilot: {},
      ui: {},
      services: {},
      data: { allowHtmlJsExecution: true },
      mcp: {},
      analytics: {},
      whiteLabel: {},
    };

    const cfg = getConfig();
    expect(cfg.data.allowHtmlJsExecution).toBe(false);
  });

  it("overrides env var fallback value", () => {
    vi.stubGlobal("__LOCKED_CONFIG__", { data: { allowHtmlJsExecution: false } });
    vi.stubEnv("VITE_ALLOW_HTML_JS_EXECUTION", "true");

    const cfg = getConfig();
    expect(cfg.data.allowHtmlJsExecution).toBe(false);
  });

  it("does not affect non-locked fields from window.__APP_CONFIG__", () => {
    vi.stubGlobal("__LOCKED_CONFIG__", { data: { allowHtmlJsExecution: false } });
    window.__APP_CONFIG__ = {
      urls: { backend: "https://custom.test" },
      authentication: {},
      authProviders: {},
      copilot: {},
      ui: {},
      services: {},
      data: { allowHtmlJsExecution: true },
      mcp: {},
      analytics: {},
      whiteLabel: {},
    };

    const cfg = getConfig();
    expect(cfg.urls.backend).toBe("https://custom.test");
  });

  it("is a no-op when __LOCKED_CONFIG__ is empty", () => {
    vi.stubGlobal("__LOCKED_CONFIG__", {});
    window.__APP_CONFIG__ = {
      urls: {},
      authentication: {},
      authProviders: {},
      copilot: {},
      ui: {},
      services: {},
      data: { allowHtmlJsExecution: true },
      mcp: {},
      analytics: {},
      whiteLabel: {},
    };

    const cfg = getConfig();
    expect(cfg.data.allowHtmlJsExecution).toBe(true);
  });
});
