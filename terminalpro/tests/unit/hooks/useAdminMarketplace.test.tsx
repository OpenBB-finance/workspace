import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransition,
  mockReject,
  mockAddWhitelist,
  mockDeleteWhitelist,
  mockShowNotification,
} = vi.hoisted(() => ({
  mockTransition: vi.fn(),
  mockReject: vi.fn(),
  mockAddWhitelist: vi.fn(),
  mockDeleteWhitelist: vi.fn(),
  mockShowNotification: vi.fn(),
}));

vi.mock("~/api/adminMarketplace.api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/api/adminMarketplace.api")>();
  return {
    ...actual,
    transitionAdminApp: mockTransition,
    rejectAdminApp: mockReject,
    addWhitelist: mockAddWhitelist,
    deleteWhitelist: mockDeleteWhitelist,
  };
});

vi.mock("~/lib/utils/toast", () => ({
  showNotification: mockShowNotification,
}));

import {
  ADMIN_MARKETPLACE_APPS_KEY,
  ADMIN_MARKETPLACE_WHITELIST_KEY,
} from "~/api/adminMarketplace.api";
import {
  useAddWhitelist,
  useDeleteWhitelist,
  useRejectApp,
  useTransitionApp,
} from "~/hooks/useAdminMarketplace";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidateSpy };
}

describe("useTransitionApp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates the apps key on success", async () => {
    mockTransition.mockResolvedValue({});
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useTransitionApp(), { wrapper });

    result.current.mutate({ id: "app-1", action: "publish" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTransition).toHaveBeenCalledWith("app-1", "publish");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ADMIN_MARKETPLACE_APPS_KEY,
    });
  });
});

describe("useRejectApp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the reject endpoint with the reason and invalidates apps", async () => {
    mockReject.mockResolvedValue({});
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useRejectApp(), { wrapper });

    result.current.mutate({ id: "app-2", reason: "Fix the manifest" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockReject).toHaveBeenCalledWith("app-2", "Fix the manifest");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ADMIN_MARKETPLACE_APPS_KEY,
    });
  });
});

describe("useAddWhitelist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates the whitelist key on success", async () => {
    mockAddWhitelist.mockResolvedValue({});
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useAddWhitelist(), { wrapper });

    result.current.mutate("dev@example.com");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ADMIN_MARKETPLACE_WHITELIST_KEY,
    });
  });

  it("surfaces the account-not-found message on a 404", async () => {
    const error = new AxiosError("Not found");
    error.response = { status: 404 } as AxiosError["response"];
    mockAddWhitelist.mockRejectedValue(error);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAddWhitelist(), { wrapper });

    result.current.mutate("missing@example.com");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        toastType: "error",
        description: expect.stringContaining("create an OpenBB account"),
      }),
    );
  });
});

describe("useDeleteWhitelist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates the whitelist key on success", async () => {
    mockDeleteWhitelist.mockResolvedValue(undefined);
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useDeleteWhitelist(), { wrapper });

    result.current.mutate("user-uuid");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ADMIN_MARKETPLACE_WHITELIST_KEY,
    });
  });
});
