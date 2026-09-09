import { beforeEach, describe, expect, it } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";

describe("getMsalConfig", () => {
  let getMsalConfig: typeof import("~/lib/microsoft-auth-config").getMsalConfig;

  beforeEach(async () => {
    // Reset modules to bust the _msalConfig cache
    vi.resetModules();
    vi.doMock("~/lib/runtimeConfig", () => ({
      getConfig: () => mockConfig,
      _resetConfig: vi.fn(),
    }));
    const mod = await import("~/lib/microsoft-auth-config");
    getMsalConfig = mod.getMsalConfig;
  });

  it("returns a valid MSAL configuration object", () => {
    mockConfig.authProviders.azureClientId = "test-client-id";
    mockConfig.authProviders.azureTenantId = "test-tenant-id";

    const config = getMsalConfig();

    expect(config.auth).toBeDefined();
    expect(config.auth?.clientId).toBe("test-client-id");
    expect(config.auth?.authority).toBe(
      "https://login.microsoftonline.com/test-tenant-id",
    );
    expect(config.auth?.redirectUri).toBe(window.location.origin);
  });

  it("sets cache configuration correctly", () => {
    const config = getMsalConfig();

    expect(config.cache?.cacheLocation).toBe("localStorage");
    expect(config.cache?.storeAuthStateInCookie).toBe(false);
  });

  it("caches the config on subsequent calls", () => {
    const first = getMsalConfig();
    const second = getMsalConfig();
    expect(first).toBe(second);
  });

  it("falls back to empty strings when auth providers are not configured", () => {
    mockConfig.authProviders.azureClientId = "";
    mockConfig.authProviders.azureTenantId = "";

    const config = getMsalConfig();

    expect(config.auth?.clientId).toBe("");
    expect(config.auth?.authority).toBe("https://login.microsoftonline.com/");
  });
});
