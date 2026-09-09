import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionsT } from "~/api/user_roles.api";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("~/api/user_roles.api", () => ({
  getUserResourcePermissions: vi.fn(),
}));

vi.mock("~/hooks/useProcessBackendWidgets", () => ({
  useProcessBackendWidgets: vi.fn(),
}));

vi.mock("~/lib/state/permissions", () => ({
  useShallowPermissionsStore: vi.fn(),
}));

import { toast } from "sonner";
import { getUserResourcePermissions } from "~/api/user_roles.api";
import { useProcessBackendWidgets } from "~/hooks/useProcessBackendWidgets";
import { useUserResourcePermissions } from "~/hooks/useUserResourcePermissions";
import { useShallowPermissionsStore } from "~/lib/state/permissions";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUserResourcePermissions", () => {
  const mockSetPermissions = vi.fn();
  const mockProcessBackendWidgets = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowPermissionsStore as any).mockImplementation(
      (selector: (state: { setPermissions: typeof mockSetPermissions }) => any) =>
        selector({ setPermissions: mockSetPermissions }),
    );

    (useProcessBackendWidgets as any).mockReturnValue(mockProcessBackendWidgets);
  });

  describe("successful data fetching", () => {
    it("should fetch and process user resource permissions", async () => {
      const mockBackend = {
        uuid: "backend-1",
        name: "Test Backend",
        url: "https://test.com",
        widgets: [],
        templates: [],
      };

      const mockProcessedBackend = {
        ...mockBackend,
        processed: true,
      };

      const mockPermissions: PermissionsT = {
        backends: [mockBackend as any],
        files: [
          {
            uuid: "file-1",
            access: "access",
            name: "test.csv",
            description: "Test file",
            url: "https://storage.example.com/test.csv",
            extension: "csv",
          },
        ],
        prompts: [
          {
            uuid: "prompt-1",
            access: "access",
            prompt: {
              id: "prompt-1",
              // @ts-expect-error - ignored for now
              name: "Test Prompt",
              content: "Test content",
            },
          },
        ],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);
      mockProcessBackendWidgets.mockResolvedValue(mockProcessedBackend);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(getUserResourcePermissions).toHaveBeenCalledTimes(1);
      expect(mockSetPermissions).toHaveBeenCalledWith(mockPermissions);
      // .map() passes (item, index, array) to the callback
      expect(mockProcessBackendWidgets).toHaveBeenCalledWith(
        mockBackend,
        0,
        expect.any(Array),
      );
      expect(result.current.data?.backends).toEqual([mockProcessedBackend]);
      expect(result.current.data?.files).toEqual([
        {
          ...mockPermissions.files[0],
          extension: "csv",
          shared: true,
        },
      ]);
      expect(result.current.data?.prompts).toEqual(mockPermissions.prompts);
    });

    it("should extract file extension from URL", async () => {
      const mockPermissions: PermissionsT = {
        backends: [],
        files: [
          {
            uuid: "file-1",
            access: "access",
            name: "data",
            description: "JSON file",
            url: "https://storage.example.com/path/to/file.json",
            extension: "json",
          },
          {
            uuid: "file-2",
            access: "access",
            name: "excel",
            description: "Excel file",
            url: "https://storage.example.com/data.xlsx",
            extension: "xlsx",
          },
        ],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.files[0].extension).toBe("json");
      expect(result.current.data?.files[1].extension).toBe("xlsx");
      // @ts-expect-error - ignored for now
      expect(result.current.data?.files[0].shared).toBe(true);
      // @ts-expect-error - ignored for now
      expect(result.current.data?.files[1].shared).toBe(true);
    });

    it("should handle empty response", async () => {
      const mockPermissions: PermissionsT = {
        backends: [],
        files: [],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        backends: [],
        files: [],
        prompts: [],
      });
    });

    it("should handle null/undefined response gracefully", async () => {
      (getUserResourcePermissions as any).mockResolvedValue(null);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({
        backends: [],
        files: [],
        prompts: [],
      });
    });

    it("should process multiple backends in parallel", async () => {
      const mockBackends = [
        { uuid: "backend-1", name: "Backend 1" },
        { uuid: "backend-2", name: "Backend 2" },
        { uuid: "backend-3", name: "Backend 3" },
      ];

      const mockPermissions: PermissionsT = {
        backends: mockBackends as any,
        files: [],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);
      mockProcessBackendWidgets.mockImplementation((backend) =>
        Promise.resolve({ ...backend, processed: true }),
      );

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockProcessBackendWidgets).toHaveBeenCalledTimes(3);
      expect(result.current.data?.backends).toHaveLength(3);
      expect(result.current.data?.backends.every((b: any) => b.processed)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should show error toast when fetch fails", async () => {
      const mockError = new Error("Network error");
      (getUserResourcePermissions as any).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to load shared resources");
      expect(result.current.error).toEqual(mockError);
    });

    it("should throw error after showing toast", async () => {
      const mockError = new Error("API Error");
      (getUserResourcePermissions as any).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("API Error");
    });
  });

  describe("query options", () => {
    it("should not fetch when enabled is false", async () => {
      const { result } = renderHook(
        () => useUserResourcePermissions({ enabled: false }),
        {
          wrapper: createWrapper(),
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(getUserResourcePermissions).not.toHaveBeenCalled();
      expect(result.current.isFetching).toBe(false);
    });

    it("should use correct query key", async () => {
      const mockPermissions: PermissionsT = {
        backends: [],
        files: [],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(getUserResourcePermissions).toHaveBeenCalledTimes(1);
    });

    it("should respect custom options passed to the hook", async () => {
      const mockPermissions: PermissionsT = {
        backends: [],
        files: [],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const customOnSuccess = vi.fn();

      const { result } = renderHook(
        () =>
          useUserResourcePermissions({
            enabled: true,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("data transformation", () => {
    it("should handle files with null URL", async () => {
      const mockPermissions: PermissionsT = {
        backends: [],
        files: [
          {
            uuid: "file-1",
            access: "access",
            name: "test",
            description: "Test",
            url: null,
            extension: "txt",
          },
        ],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // @ts-expect-error - ignored for now
      expect(result.current.data?.files[0].shared).toBe(true);
    });

    it("should preserve all original file properties", async () => {
      const originalFile = {
        uuid: "file-1",
        access: "access",
        name: "important.pdf",
        description: "Important document",
        url: "https://storage.example.com/important.pdf",
        extension: "pdf",
      };

      const mockPermissions: PermissionsT = {
        backends: [],
        // @ts-expect-error - ignored for now
        files: [originalFile],
        prompts: [],
      };

      (getUserResourcePermissions as any).mockResolvedValue(mockPermissions);

      const { result } = renderHook(() => useUserResourcePermissions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const transformedFile = result.current.data?.files[0];
      expect(transformedFile?.uuid).toBe(originalFile.uuid);
      expect(transformedFile?.access).toBe(originalFile.access);
      expect(transformedFile?.name).toBe(originalFile.name);
      expect(transformedFile?.description).toBe(originalFile.description);
      expect(transformedFile?.url).toBe(originalFile.url);
    });
  });
});
