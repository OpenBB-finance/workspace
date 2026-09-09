import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useUserResourcePermissions", () => ({
  useUserResourcePermissions: vi.fn(),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  getTemplateWidgetsMetadata: vi.fn(),
}));

import { useSharedTemplates } from "~/hooks/useSharedTemplates";
import { useUserResourcePermissions } from "~/hooks/useUserResourcePermissions";
import { getTemplateWidgetsMetadata } from "~/lib/state/backendConnector";

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

describe("useSharedTemplates", () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (getTemplateWidgetsMetadata as any).mockReturnValue({
      widgets: [],
      totalWidgets: 0,
    });
  });

  describe("basic functionality", () => {
    it("should return undefined when no data available", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
        isLoading: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
    });

    it("should transform backend templates into processed templates", () => {
      const mockBackend = {
        uuid: "backend-1",
        name: "Test Backend",
        url: "https://test.com",
        templates: [
          {
            templateId: "template-1",
            id: "t1",
            name: "Test Template",
            description: "A test template",
            access: "access",
            img: "/img.png",
            img_dark: "/dark.png",
            img_light: "/light.png",
            prompts: [],
            tabs: { overview: {} },
            selected_agent: "agent-1",
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [{ name: "Widget 1" }],
        totalWidgets: 3,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toEqual({
        templateId: "template-1",
        id: "t1",
        name: "Test Template",
        description: "A test template",
        access: "access",
        img: "/img.png",
        img_dark: "/dark.png",
        img_light: "/light.png",
        totalWidgets: 3,
        widgets: [{ name: "Widget 1" }],
        prompts: [],
        tabs: { overview: {} },
        selected_agent: "agent-1",
        source: mockBackend,
      });
    });

    it("should flatten templates from multiple backends", () => {
      const mockBackends = [
        {
          uuid: "backend-1",
          templates: [
            { templateId: "t1", id: "t1", name: "Template 1" },
            { templateId: "t2", id: "t2", name: "Template 2" },
          ],
        },
        {
          uuid: "backend-2",
          templates: [{ templateId: "t3", id: "t3", name: "Template 3" }],
        },
      ];

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: mockBackends,
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data.map((t: any) => t.id)).toEqual(["t1", "t2", "t3"]);
    });
  });

  describe("prompt transformation", () => {
    it("should handle string prompts", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [
          {
            templateId: "t1",
            id: "t1",
            name: "Template",
            prompts: ["Prompt 1", "Prompt 2"],
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].prompts).toEqual(["Prompt 1", "Prompt 2"]);
    });

    it("should extract promptId from object prompts", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [
          {
            templateId: "t1",
            id: "t1",
            name: "Template",
            prompts: [
              { promptId: "prompt-1", access: "access" },
              { promptId: "prompt-2", access: "access" },
            ],
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].prompts).toEqual(["prompt-1", "prompt-2"]);
    });

    it("should handle null/undefined prompts", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [
          {
            templateId: "t1",
            id: "t1",
            name: "Template",
            prompts: null,
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].prompts).toEqual([]);
    });

    it("should handle mixed prompt types", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [
          {
            templateId: "t1",
            id: "t1",
            name: "Template",
            prompts: ["String prompt", { promptId: "object-prompt", access: "access" }],
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].prompts).toEqual([
        "String prompt",
        "object-prompt",
      ]);
    });
  });

  describe("widget metadata", () => {
    it("should call getTemplateWidgetsMetadata for each template", () => {
      const mockBackend = {
        uuid: "backend-1",
        name: "Backend",
        templates: [
          { templateId: "t1", id: "t1", name: "Template 1" },
          { templateId: "t2", id: "t2", name: "Template 2" },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(getTemplateWidgetsMetadata).toHaveBeenCalledTimes(2);
      expect(getTemplateWidgetsMetadata).toHaveBeenCalledWith(
        mockBackend.templates[0],
        mockBackend,
      );
      expect(getTemplateWidgetsMetadata).toHaveBeenCalledWith(
        mockBackend.templates[1],
        mockBackend,
      );
    });

    it("should include widgets and totalWidgets in result", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [{ templateId: "t1", id: "t1", name: "Template" }],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [
          { id: "w1", name: "Widget 1" },
          { id: "w2", name: "Widget 2" },
        ],
        totalWidgets: 10,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].widgets).toEqual([
        { id: "w1", name: "Widget 1" },
        { id: "w2", name: "Widget 2" },
      ]);
      expect(result.current.data[0].totalWidgets).toBe(10);
    });
  });

  describe("source association", () => {
    it("should associate each template with its source backend", () => {
      const mockBackend1 = {
        uuid: "backend-1",
        name: "Backend 1",
        templates: [{ templateId: "t1", id: "t1", name: "Template 1" }],
      };

      const mockBackend2 = {
        uuid: "backend-2",
        name: "Backend 2",
        templates: [{ templateId: "t2", id: "t2", name: "Template 2" }],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend1, mockBackend2],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].source).toBe(mockBackend1);
      expect(result.current.data[1].source).toBe(mockBackend2);
    });
  });

  describe("options handling", () => {
    it("should pass options to useUserResourcePermissions", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useSharedTemplates({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(useUserResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          staleTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
        }),
      );
    });

    it("should use default staleTime of 5 minutes", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(useUserResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: 300000, // 5 minutes
        }),
      );
    });

    it("should disable refetchOnWindowFocus", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(useUserResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          refetchOnWindowFocus: false,
        }),
      );
    });
  });

  describe("return value", () => {
    it("should return refetch function from useUserResourcePermissions", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
        isLoading: false,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.refetch).toBe(mockRefetch);
    });

    it("should spread additional query properties", () => {
      (useUserResourcePermissions as any).mockReturnValue({
        data: { backends: [], files: [], prompts: [] },
        refetch: mockRefetch,
        isLoading: false,
        isError: false,
        isSuccess: true,
        error: null,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe("empty templates handling", () => {
    it("should handle backends with empty templates array", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual([]);
    });

    it("should handle backends with undefined templates", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: undefined,
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe("default description", () => {
    it("should use empty string for undefined description", () => {
      const mockBackend = {
        uuid: "backend-1",
        templates: [
          {
            templateId: "t1",
            id: "t1",
            name: "Template",
            description: undefined,
          },
        ],
      };

      (useUserResourcePermissions as any).mockReturnValue({
        data: {
          backends: [mockBackend],
          files: [],
          prompts: [],
        },
        refetch: mockRefetch,
        isSuccess: true,
      });

      const { result } = renderHook(() => useSharedTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.data[0].description).toBe("");
    });
  });
});
