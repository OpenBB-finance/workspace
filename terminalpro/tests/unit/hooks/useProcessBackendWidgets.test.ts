import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendPermissionsT } from "~/api/user_roles.api";
import { useProcessBackendWidgets } from "~/hooks/useProcessBackendWidgets";
import type { BackendTemplate, ValidateBackend } from "~/lib/state/backendConnector";

// Mock getApiSourceWidgets from backendConnector
const mockGetApiSourceWidgets = vi.fn();
vi.mock("~/lib/state/backendConnector", async () => {
  const actual = await vi.importActual("~/lib/state/backendConnector");
  return {
    ...actual,
    useShallowBackendConnectorStore: vi.fn((selector) =>
      selector({
        getApiSourceById: mockGetApiSourceById,
      }),
    ),
  };
});

vi.mock("~/lib/utils/validateBackend", async () => {
  const actual = await vi.importActual("~/lib/utils/validateBackend");
  return {
    ...actual,
    getApiSourceWidgets: (...args: unknown[]) => mockGetApiSourceWidgets(...args),
  };
});

// Mock permissions store
const mockHasAccess = vi.fn();
const mockPermissions = {
  backends: [],
  files: [],
  prompts: [],
};
vi.mock("~/lib/state/permissions", () => ({
  useShallowPermissionsStore: vi.fn((selector) =>
    selector({
      permissions: mockPermissions,
      hasAccess: mockHasAccess,
    }),
  ),
}));

// Mock createSourceWidget
const mockCreateSourceWidget = vi.fn((widget, source, hasAccess) => ({
  ...widget,
  id: "created-widget-id",
  sourceId: source.id,
  sourceName: source.name,
  isSharedWidget: source.isSharedSource,
  disabled: !hasAccess,
}));
vi.mock("~/components/DataConnectors/common/helpers", () => ({
  // @ts-expect-error - ignored for now
  createSourceWidget: (...args: unknown[]) => mockCreateSourceWidget(...args),
}));

// Mock someTruthy
vi.mock("~/components/General/Table/utils", () => ({
  someTruthy: (...args: unknown[]) =>
    args.some((arg) => {
      if (Array.isArray(arg)) return arg.length > 0;
      if (typeof arg === "object" && arg !== null) return Object.keys(arg).length > 0;
      return Boolean(arg);
    }),
}));

// Mock cleanURL
vi.mock("~/lib/utils/widgetParams", () => ({
  cleanURL: (url: string) => url?.replace(/([^:]\/)\/+/g, "$1"),
}));

// Mock getApiSourceById
const mockGetApiSourceById = vi.fn();

// Helper to create a mock BackendPermissionsT
function createMockBackend(
  overrides: Partial<BackendPermissionsT> = {},
): BackendPermissionsT {
  return {
    uuid: "backend-uuid-123",
    name: "Test Backend",
    access: "access",
    url: "https://api.example.com",
    endpointHeaders: [],
    widgets: [
      { widgetId: "widget-1", access: "access" },
      { widgetId: "widget-2", access: "access" },
    ],
    templates: [
      {
        templateId: "template-1",
        access: "access",
        description: "Test template",
        prompts: [{ promptId: "prompt-1", access: "access" }],
      },
    ],
    ...overrides,
  };
}

// Helper to create mock widgets from backend
function createMockWidgets(): Record<string, any> {
  return {
    "widget-1": {
      widgetId: "widget-1",
      name: "Widget One",
      endpoint: "/api/widget1",
      type: "table",
    },
    "widget-2": {
      widgetId: "widget-2",
      name: "Widget Two",
      endpoint: "/api/widget2",
      type: "chart",
    },
  };
}

// Helper to create mock templates
function createMockTemplates(): BackendTemplate[] {
  return [
    {
      name: "template-1",
      description: "Template One",
      tabs: {},
      prompts: ["prompt-1"],
    },
  ];
}

describe("useProcessBackendWidgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiSourceById.mockReturnValue(undefined);
    mockHasAccess.mockReturnValue(true);
  });

  describe("successful widget processing", () => {
    it("should process backend widgets successfully with valid data", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();
      const mockTemplates = createMockTemplates();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: mockTemplates,
        errorMessage: null,
      } as Partial<ValidateBackend>);

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.status).toBe("success");
      expect(processed.id).toBe(mockBackend.uuid);
      expect(processed.isSharedSource).toBe(true);
      expect(processed.validatedUrl).toBeDefined();
    });

    it("should call createSourceWidget for each widget with access", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();
      const mockTemplates = createMockTemplates();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: mockTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      await result.current(mockBackend);

      expect(mockCreateSourceWidget).toHaveBeenCalledTimes(2);
      expect(mockCreateSourceWidget).toHaveBeenCalledWith(
        expect.objectContaining({ widgetId: "widget-1" }),
        expect.objectContaining({ id: mockBackend.uuid }),
        expect.any(Boolean),
      );
    });

    it("should return processed widgets in correct format", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();
      const mockTemplates = createMockTemplates();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: mockTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(Object.keys(processed.widgets)).toHaveLength(2);
      expect(processed.widgets["widget-1"]).toBeDefined();
      expect(processed.widgets["widget-2"]).toBeDefined();
    });

    it("should use existing source widgets when backend is already owned", async () => {
      const mockBackend = createMockBackend();
      const existingWidgets = createMockWidgets();
      const existingTemplates = createMockTemplates();

      mockGetApiSourceById.mockReturnValue({
        widgets: existingWidgets,
        templates: existingTemplates,
        status: "success",
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      await result.current(mockBackend);

      // Should not call getApiSourceWidgets when existing source is found
      expect(mockGetApiSourceWidgets).not.toHaveBeenCalled();
    });

    it("should clean URL properly", async () => {
      const mockBackend = createMockBackend({
        url: "https://api.example.com//path//to//api",
      });
      const mockWidgets = createMockWidgets();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: [],
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.validatedUrl).toBe("https://api.example.com/path/to/api");
    });
  });

  describe("widget filtering based on user permissions", () => {
    it("should filter out widgets user does not have access to", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: [],
        errorMessage: null,
      });

      // Deny access to widget-2
      mockHasAccess.mockImplementation((_sourceId, widgetId) => {
        return widgetId !== "widget-2";
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);
      const accessibleWidgets = Object.fromEntries(
        Object.entries(processed.widgets).filter(([, w]) => !w.disabled),
      );

      expect(Object.keys(accessibleWidgets)).toHaveLength(1);
      expect(accessibleWidgets["widget-1"]).toBeDefined();
      expect(accessibleWidgets["widget-2"]).toBeUndefined();
    });

    it("should call hasAccess with correct parameters", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: [],
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      await result.current(mockBackend);

      expect(mockHasAccess).toHaveBeenCalledWith(mockBackend.uuid, "widget-1");
      expect(mockHasAccess).toHaveBeenCalledWith(mockBackend.uuid, "widget-2");
    });

    it("should disable widgets when user has no permissions", async () => {
      const mockBackend = createMockBackend();
      const mockWidgets = createMockWidgets();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: mockWidgets,
        templates: [],
        errorMessage: null,
      });

      mockHasAccess.mockReturnValue(false);

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);
      const accessibleWidgets = Object.values(processed.widgets).filter(
        (w) => !w.disabled,
      );

      expect(accessibleWidgets).toHaveLength(0);
    });
  });

  describe("error handling when backend is unreachable", () => {
    it("should return error status when getApiSourceWidgets returns errorMessage", async () => {
      const mockBackend = createMockBackend();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: {},
        templates: [],
        errorMessage: "Backend not reachable",
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.status).toBe("error");
      expect(processed.widgets).toEqual({});
      expect(processed.templates).toEqual([]);
    });

    it("should return error status when getApiSourceWidgets throws", async () => {
      const mockBackend = createMockBackend();

      mockGetApiSourceWidgets.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.status).toBe("error");
      expect(processed.widgets).toEqual({});
      expect(processed.templates).toEqual([]);
      expect(processed.isSharedSource).toBe(true);
    });

    it("should handle timeout errors gracefully", async () => {
      const mockBackend = createMockBackend();

      mockGetApiSourceWidgets.mockRejectedValue(new Error("Request timed out"));

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.status).toBe("error");
      expect(processed.name).toBe(mockBackend.name);
    });

    it("should return error when existing source has error status", async () => {
      const mockBackend = createMockBackend();

      mockGetApiSourceById.mockReturnValue({
        widgets: {},
        templates: [],
        status: "error",
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.status).toBe("error");
    });

    it("should preserve backend metadata on error", async () => {
      const mockBackend = createMockBackend({
        name: "Custom Backend Name",
        uuid: "custom-uuid",
      });

      mockGetApiSourceWidgets.mockRejectedValue(new Error("Connection refused"));

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.name).toBe("Custom Backend Name");
      expect(processed.uuid).toBe("custom-uuid");
    });
  });

  describe("template filtering and permission validation", () => {
    it("should filter templates based on access permission", async () => {
      const mockBackend = createMockBackend({
        templates: [
          { templateId: "template-1", access: "access", prompts: [] },
          { templateId: "template-2", access: "denied", prompts: [] },
          { templateId: "template-3", access: "access", prompts: [] },
        ],
      });

      const backendTemplates: BackendTemplate[] = [
        { name: "template-1", description: "Accessible", tabs: {} },
        { name: "template-2", description: "Denied", tabs: {} },
        { name: "template-3", description: "Also Accessible", tabs: {} },
      ];

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: backendTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.templates).toHaveLength(2);
      expect(processed.templates.map((t) => t.name)).toContain("template-1");
      expect(processed.templates.map((t) => t.name)).toContain("template-3");
      expect(processed.templates.map((t) => t.name)).not.toContain("template-2");
    });

    it("should preserve prompts from backend.templates", async () => {
      const mockBackend = createMockBackend({
        templates: [
          {
            templateId: "template-1",
            access: "access",
            prompts: [
              { promptId: "custom-prompt-1", access: "access" },
              { promptId: "custom-prompt-2", access: "access" },
            ],
          },
        ],
      });

      const backendTemplates: BackendTemplate[] = [
        {
          name: "template-1",
          description: "Template with prompts",
          tabs: {},
          prompts: ["default-prompt"],
        },
      ];

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: backendTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.templates[0].prompts).toHaveLength(2);
      expect(processed.templates[0].prompts).toEqual([
        { promptId: "custom-prompt-1", access: "access" },
        { promptId: "custom-prompt-2", access: "access" },
      ]);
    });

    it("should fall back to template.prompts when backend.templates prompts is undefined", async () => {
      const mockBackend = createMockBackend({
        templates: [
          { templateId: "template-1", access: "access", prompts: undefined as any },
        ],
      });

      const backendTemplates: BackendTemplate[] = [
        {
          name: "template-1",
          description: "Template",
          tabs: {},
          prompts: ["fallback-prompt"],
        },
      ];

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: backendTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      // Should use template's prompts as fallback since backend.templates prompts is undefined
      expect(processed.templates[0].prompts).toEqual(["fallback-prompt"]);
    });

    it("should use empty prompts array when backend.templates has empty prompts (no fallback)", async () => {
      const mockBackend = createMockBackend({
        templates: [{ templateId: "template-1", access: "access", prompts: [] }],
      });

      const backendTemplates: BackendTemplate[] = [
        {
          name: "template-1",
          description: "Template",
          tabs: {},
          prompts: ["fallback-prompt"],
        },
      ];

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: backendTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      // Empty array is truthy, so no fallback occurs - this tests actual behavior
      expect(processed.templates[0].prompts).toEqual([]);
    });

    it("should handle templates with no matching backend template", async () => {
      const mockBackend = createMockBackend({
        templates: [{ templateId: "template-1", access: "access", prompts: [] }],
      });

      const backendTemplates: BackendTemplate[] = [
        { name: "different-template", description: "No match", tabs: {} },
      ];

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: backendTemplates,
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      // Template should be filtered out since no matching access entry
      expect(processed.templates).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    describe("empty widgets", () => {
      it("should return error status when backend has no widgets and no templates", async () => {
        const mockBackend = createMockBackend({
          widgets: [],
          templates: [],
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("error");
        expect(processed.widgets).toEqual({});
        expect(processed.templates).toEqual([]);
      });

      it("should handle backend with empty widget array from API", async () => {
        const mockBackend = createMockBackend();

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: {},
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("success");
        expect(Object.keys(processed.widgets)).toHaveLength(0);
      });

      it("should process successfully with templates but no widgets", async () => {
        const mockBackend = createMockBackend({
          widgets: [],
          templates: [{ templateId: "t1", access: "access", prompts: [] }],
        });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: {},
          templates: [{ name: "t1", description: "Template", tabs: {} }],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("success");
        expect(processed.templates).toHaveLength(1);
      });
    });

    describe("no templates", () => {
      it("should process successfully with widgets but no templates", async () => {
        const mockBackend = createMockBackend({
          templates: [],
        });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("success");
        expect(Object.keys(processed.widgets)).toHaveLength(2);
        expect(processed.templates).toHaveLength(0);
      });

      it("should handle undefined templates from API response", async () => {
        const mockBackend = createMockBackend();

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: undefined,
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        // Should handle undefined templates gracefully
        expect(processed.status).toBe("success");
      });
    });

    describe("permission denials", () => {
      it("should return empty widgets when all permissions denied", async () => {
        const mockBackend = createMockBackend();

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        mockHasAccess.mockReturnValue(false);

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);
        const accessibleWidgets = Object.values(processed.widgets).filter(
          (w) => !w.disabled,
        );

        expect(processed.status).toBe("success");
        expect(accessibleWidgets).toHaveLength(0);
      });

      it("should handle partial permission grants", async () => {
        const mockBackend = createMockBackend();

        const widgets = {
          ...createMockWidgets(),
          "widget-3": { widgetId: "widget-3", name: "Widget Three" },
        };

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets,
          templates: [],
          errorMessage: null,
        });

        // Only allow widget-1 and widget-3
        mockHasAccess.mockImplementation((_, widgetId) => {
          return widgetId === "widget-1" || widgetId === "widget-3";
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);
        const accessibleWidgets = Object.fromEntries(
          Object.entries(processed.widgets).filter(([, w]) => !w.disabled),
        );

        expect(Object.keys(accessibleWidgets)).toHaveLength(2);
        expect(accessibleWidgets["widget-1"]).toBeDefined();
        expect(accessibleWidgets["widget-3"]).toBeDefined();
        expect(accessibleWidgets["widget-2"]).toBeUndefined();
      });
    });

    describe("widget ID assignment", () => {
      it("should assign widgetId from key when widget lacks widgetId", async () => {
        const mockBackend = createMockBackend();

        const widgets = {
          "key-based-widget": {
            name: "Widget Without ID",
            endpoint: "/api/test",
          },
        };

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets,
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        await result.current(mockBackend);

        expect(mockCreateSourceWidget).toHaveBeenCalledWith(
          expect.objectContaining({ widgetId: "key-based-widget" }),
          expect.anything(),
          expect.any(Boolean),
        );
      });

      it("should preserve existing widgetId if present", async () => {
        const mockBackend = createMockBackend();

        const widgets = {
          "key-widget": {
            widgetId: "existing-widget-id",
            name: "Widget With ID",
            endpoint: "/api/test",
          },
        };

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets,
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        await result.current(mockBackend);

        expect(mockCreateSourceWidget).toHaveBeenCalledWith(
          expect.objectContaining({ widgetId: "existing-widget-id" }),
          expect.anything(),
          expect.any(Boolean),
        );
      });
    });

    describe("source creation", () => {
      it("should create source with isSharedSource flag", async () => {
        const mockBackend = createMockBackend();

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        await result.current(mockBackend);

        expect(mockCreateSourceWidget).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ isSharedSource: true }),
          expect.any(Boolean),
        );
      });

      it("should pass correct source id from backend uuid", async () => {
        const mockBackend = createMockBackend({
          uuid: "specific-backend-uuid",
        });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        await result.current(mockBackend);

        expect(mockCreateSourceWidget).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ id: "specific-backend-uuid" }),
          expect.any(Boolean),
        );
      });
    });

    describe("backend with special characters in URL", () => {
      it("should handle URLs with query parameters", async () => {
        const mockBackend = createMockBackend({
          url: "https://api.example.com/v1?token=abc123",
        });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("success");
        expect(processed.validatedUrl).toBeDefined();
      });

      it("should handle URLs with trailing slashes", async () => {
        const mockBackend = createMockBackend({
          url: "https://api.example.com/",
        });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const processed = await result.current(mockBackend);

        expect(processed.status).toBe("success");
      });
    });

    describe("concurrent processing", () => {
      it("should handle multiple backends processed in parallel", async () => {
        const backend1 = createMockBackend({ uuid: "backend-1", name: "Backend 1" });
        const backend2 = createMockBackend({ uuid: "backend-2", name: "Backend 2" });

        mockGetApiSourceWidgets.mockResolvedValue({
          widgets: createMockWidgets(),
          templates: [],
          errorMessage: null,
        });

        const { result } = renderHook(() => useProcessBackendWidgets());

        const [processed1, processed2] = await Promise.all([
          result.current(backend1),
          result.current(backend2),
        ]);

        expect(processed1.id).toBe("backend-1");
        expect(processed2.id).toBe("backend-2");
        expect(processed1.status).toBe("success");
        expect(processed2.status).toBe("success");
      });
    });
  });

  describe("type safety and return value structure", () => {
    it("should return ProcessedBackendT with all required fields", async () => {
      const mockBackend = createMockBackend();

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: createMockTemplates(),
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      // Verify all expected fields are present
      expect(processed).toHaveProperty("status");
      expect(processed).toHaveProperty("id");
      expect(processed).toHaveProperty("widgets");
      expect(processed).toHaveProperty("validatedUrl");
      expect(processed).toHaveProperty("templates");
      expect(processed).toHaveProperty("isSharedSource");
      expect(processed).toHaveProperty("uuid");
      expect(processed).toHaveProperty("name");
      expect(processed).toHaveProperty("access");
      expect(processed).toHaveProperty("url");
    });

    it("should maintain backend properties in returned object", async () => {
      const mockBackend = createMockBackend({
        uuid: "test-uuid",
        name: "Test Name",
        access: "access",
        url: "https://test.com",
        endpointHeaders: [
          { key: "Authorization", value: "Bearer token", location: "headers" },
        ],
      });

      mockGetApiSourceWidgets.mockResolvedValue({
        widgets: createMockWidgets(),
        templates: [],
        errorMessage: null,
      });

      const { result } = renderHook(() => useProcessBackendWidgets());

      const processed = await result.current(mockBackend);

      expect(processed.uuid).toBe("test-uuid");
      expect(processed.name).toBe("Test Name");
      expect(processed.access).toBe("access");
      expect(processed.url).toBe("https://test.com");
      expect(processed.endpointHeaders).toEqual([
        { key: "Authorization", value: "Bearer token", location: "headers" },
      ]);
    });
  });
});
