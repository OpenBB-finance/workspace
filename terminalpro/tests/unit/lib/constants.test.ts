import { describe, it, expect, beforeEach } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";

// getDefaultCopilot uses a module-level cache, so we need a fresh import per test.
// We use dynamic import + vi.resetModules to bust the cache.

describe("getDefaultCopilot", () => {
  let getDefaultCopilot: typeof import("~/lib/constants").getDefaultCopilot;

  beforeEach(async () => {
    vi.resetModules();
    // Re-apply the runtime config mock after module reset
    vi.doMock("~/lib/runtimeConfig", () => ({
      getConfig: () => mockConfig,
      _resetConfig: vi.fn(),
    }));
    // Ensure inSnowflakeNativeApp evaluates to false on re-import
    const origVal = import.meta.env.VITE_SNOWFLAKE_NATIVE_APP;
    import.meta.env.VITE_SNOWFLAKE_NATIVE_APP = "false";
    const mod = await import("~/lib/constants");
    import.meta.env.VITE_SNOWFLAKE_NATIVE_APP = origVal;
    getDefaultCopilot = mod.getDefaultCopilot;
  });

  it("returns a copilot with the correct id and name", () => {
    const copilot = getDefaultCopilot();
    expect(copilot.id).toBe("openbb-copilot");
    expect(copilot.name).toBe("OpenBB Copilot");
  });

  it("builds the query endpoint from runtime AI URL", () => {
    const copilot = getDefaultCopilot();
    expect(copilot.endpoints.query).toBe(`${mockConfig.urls.ai}/v1/query`);
  });

  it("caches the copilot on subsequent calls", () => {
    const first = getDefaultCopilot();
    const second = getDefaultCopilot();
    expect(first).toBe(second);
  });

  it("includes expected feature flags", () => {
    const copilot = getDefaultCopilot();
    expect(copilot.features.streaming).toBe(true);
    expect(copilot.features["file-upload"]).toBe(true);
    expect(copilot.features["widget-dashboard-select"]).toBe(true);
    expect(copilot.features["widget-global-search"]).toBe(true);
    expect(copilot.features["generative-ui"]).toBe(true);
    expect(copilot.features["mcp-tools"]).toBe(true);
    expect(copilot.features["agent-orchestration"]).toBe(true);
  });

  it("includes workspace-web-search when not in Snowflake native app", () => {
    // The mock sets inSnowflakeNativeApp = false (via constants mock)
    const copilot = getDefaultCopilot();
    expect(copilot.features["workspace-web-search"]).toBeDefined();
    expect(copilot.features["workspace-web-search"]).toEqual(
      expect.objectContaining({ label: "Web Search" }),
    );
  });
});

describe("getApiUrl / getAiApiUrl / getPaymentsApiUrl / getDataPlatformUrl", () => {
  let constants: typeof import("~/lib/constants");

  beforeEach(async () => {
    mockConfig.urls.backend = "https://backend.test";
    mockConfig.urls.ai = "https://ai.test";
    mockConfig.urls.platform = "https://platform.test";
    vi.resetModules();
    vi.doMock("~/lib/runtimeConfig", () => ({
      getConfig: () => mockConfig,
      _resetConfig: vi.fn(),
    }));
    constants = await import("~/lib/constants");
  });

  it("getApiUrl returns urls.backend from runtime config", () => {
    expect(constants.getApiUrl()).toBe("https://backend.test");
  });

  it("getPaymentsApiUrl returns urls.backend from runtime config", () => {
    expect(constants.getPaymentsApiUrl()).toBe("https://backend.test");
  });

  it("getAiApiUrl returns urls.ai from runtime config", () => {
    expect(constants.getAiApiUrl()).toBe("https://ai.test");
  });

  it("getDataPlatformUrl returns urls.platform from runtime config", () => {
    expect(constants.getDataPlatformUrl()).toBe("https://platform.test");
  });
});
