import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";

// Mock OktaAuth constructor since we don't want to actually initialize the SDK
vi.mock("@okta/okta-auth-js", () => ({
  OktaAuth: vi.fn().mockImplementation((config) => ({
    _config: config,
  })),
}));

describe("getOktaAuth", () => {
  let getOktaAuth: typeof import("~/lib/okta-auth-config").getOktaAuth;

  beforeEach(async () => {
    // Reset modules to bust the _oktaAuth / _initialized cache
    vi.resetModules();
    vi.doMock("~/lib/runtimeConfig", () => ({
      getConfig: () => mockConfig,
      _resetConfig: vi.fn(),
    }));
    vi.doMock("@okta/okta-auth-js", () => ({
      OktaAuth: vi.fn().mockImplementation(function (this: Record<string, unknown>, config: unknown) {
        this._config = config;
      }),
    }));
    const mod = await import("~/lib/okta-auth-config");
    getOktaAuth = mod.getOktaAuth;
  });

  it("returns null when oktaDomain is not configured", () => {
    mockConfig.authProviders.oktaDomain = "";
    mockConfig.authProviders.oktaClientId = "";

    const result = getOktaAuth();
    expect(result).toBeNull();
  });

  it("returns an OktaAuth instance when oktaDomain is configured", () => {
    mockConfig.authProviders.oktaDomain = "https://dev-123.okta.com/oauth2/default";
    mockConfig.authProviders.oktaClientId = "okta-client-id";

    const result = getOktaAuth();
    expect(result).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any)?._config).toEqual(
      expect.objectContaining({
        clientId: "okta-client-id",
        issuer: "https://dev-123.okta.com/oauth2/default",
        redirectUri: window.location.origin,
        scopes: ["openid", "profile", "email"],
        pkce: true,
      }),
    );
  });

  it("caches the result on subsequent calls", () => {
    mockConfig.authProviders.oktaDomain = "https://dev-123.okta.com/oauth2/default";
    mockConfig.authProviders.oktaClientId = "okta-client-id";

    const first = getOktaAuth();
    const second = getOktaAuth();
    expect(first).toBe(second);
  });

  it("caches null when domain is empty (does not retry)", () => {
    mockConfig.authProviders.oktaDomain = "";

    const first = getOktaAuth();
    expect(first).toBeNull();

    // Even if we change the config, the cached null persists
    mockConfig.authProviders.oktaDomain = "https://dev-123.okta.com/oauth2/default";
    const second = getOktaAuth();
    expect(second).toBeNull();
  });
});
