import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListSubmissions, mockRunTests, mockSubmitForReview, mockDeleteSubmission } =
  vi.hoisted(() => ({
    mockListSubmissions: vi.fn(),
    mockRunTests: vi.fn(),
    mockSubmitForReview: vi.fn(),
    mockDeleteSubmission: vi.fn(),
  }));

vi.mock("~/api/marketplaceSubmission.api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/api/marketplaceSubmission.api")>();
  return {
    ...actual,
    listSubmissions: mockListSubmissions,
    runTests: mockRunTests,
    submitForReview: mockSubmitForReview,
    deleteSubmission: mockDeleteSubmission,
  };
});

import { MARKETPLACE_SUBMISSIONS_QUERY_KEY } from "~/api/marketplaceSubmission.api";
import {
  useDeleteSubmission,
  useMarketplaceSubmissions,
  useRunSubmissionTests,
  useSubmitForReview,
} from "~/hooks/useMarketplaceSubmissions";
import queryClient from "~/queryClient";
import type { SubmissionTarget } from "~/types/marketplaceSubmission";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return wrapper;
}

const target = { kind: "new", seed: {} } as unknown as SubmissionTarget;
const form = { appName: "Acme" } as never;

beforeEach(() => vi.clearAllMocks());

describe("useMarketplaceSubmissions", () => {
  it("reads the submission list from the service", async () => {
    mockListSubmissions.mockResolvedValue([{ id: "sub-1" }]);
    const wrapper = setup();

    const { result } = renderHook(() => useMarketplaceSubmissions(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([{ id: "sub-1" }]));
  });
});

describe("useRunSubmissionTests", () => {
  it("spreads the tuple into runTests and does not invalidate (no server write)", async () => {
    mockRunTests.mockResolvedValue([{ id: "backend-reachable", status: "passed" }]);
    const wrapper = setup();

    const { result } = renderHook(() => useRunSubmissionTests(), { wrapper });
    await result.current.mutateAsync([target, form]);

    expect(mockRunTests).toHaveBeenCalledWith(target, form);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("useSubmitForReview", () => {
  it("invalidates the submissions key on success so owner cards restatus", async () => {
    mockSubmitForReview.mockResolvedValue({ id: "sub-1" });
    const wrapper = setup();

    const { result } = renderHook(() => useSubmitForReview(), { wrapper });
    await result.current.mutateAsync([target, form]);

    expect(mockSubmitForReview).toHaveBeenCalledWith(target, form);
    await waitFor(() =>
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: MARKETPLACE_SUBMISSIONS_QUERY_KEY,
      }),
    );
  });

  it("does not invalidate when the submission fails", async () => {
    mockSubmitForReview.mockRejectedValue(new Error("checks have not passed"));
    const wrapper = setup();

    const { result } = renderHook(() => useSubmitForReview(), { wrapper });
    await expect(result.current.mutateAsync([target, form])).rejects.toThrow(
      "checks have not passed",
    );

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("useDeleteSubmission", () => {
  it("deletes by id and invalidates the list", async () => {
    mockDeleteSubmission.mockResolvedValue(undefined);
    const wrapper = setup();

    const { result } = renderHook(() => useDeleteSubmission(), { wrapper });
    await result.current.mutateAsync("sub-1");

    // Passed straight through as `mutationFn`, so React Query appends its context.
    expect(mockDeleteSubmission.mock.calls[0][0]).toBe("sub-1");
    await waitFor(() =>
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: MARKETPLACE_SUBMISSIONS_QUERY_KEY,
      }),
    );
  });
});
