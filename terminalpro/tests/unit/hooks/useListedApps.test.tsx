import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import { getMarketplaceBaseUrl, useListedApps } from "~/hooks/useListedApps";
import { mockConfig } from "../../mocks/runtimeConfig";

describe("getMarketplaceBaseUrl", () => {
  const orig = {
    isLite: mockConfig.ui.isLite,
    backend: mockConfig.urls.backend,
    ai: mockConfig.urls.ai,
  };

  afterEach(() => {
    mockConfig.ui.isLite = orig.isLite;
    mockConfig.urls.backend = orig.backend;
    mockConfig.urls.ai = orig.ai;
  });

  it("returns undefined when not in lite (falls back to configured backend)", () => {
    mockConfig.ui.isLite = false;
    expect(getMarketplaceBaseUrl()).toBeUndefined();
  });

  it("uses the OpenBB marketplace host in lite (regardless of configured URLs)", () => {
    mockConfig.ui.isLite = true;
    mockConfig.urls.backend = "https://some-onprem-host.example.com";
    mockConfig.urls.ai = "https://ai.openbb.co";
    expect(getMarketplaceBaseUrl()).toBe("https://backend.openbb.co");
  });
});

describe("useListedApps marketplace request", () => {
  const origIsLite = mockConfig.ui.isLite;

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    mockConfig.ui.isLite = origIsLite;
    vi.mocked(apiClient.get).mockReset();
  });

  it("requests the marketplace cross-origin without auth in lite", async () => {
    mockConfig.ui.isLite = true;

    const { result } = renderHook(() => useListedApps(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
    expect(apiClient.get).toHaveBeenCalledWith("/marketplace/apps", {
      baseURL: "https://backend.openbb.co",
      headers: { authorization: "" },
    });
  });

  it("requests the configured backend with default (authed) config when not in lite", async () => {
    mockConfig.ui.isLite = false;

    const { result } = renderHook(() => useListedApps(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });
    expect(apiClient.get).toHaveBeenCalledWith("/marketplace/apps", undefined);
  });
});
