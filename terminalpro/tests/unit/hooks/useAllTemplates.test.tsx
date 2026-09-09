import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockAddTab = vi.fn();
const mockCreateCustomTemplateTab = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "test-dashboard-id" }),
  };
});

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: vi.fn(),
  getTemplateWidgetsMetadata: vi.fn(),
}));

vi.mock("~/hooks/useAvailableTemplates", () => ({
  useAvailableTemplates: vi.fn(),
}));

vi.mock("~/hooks/useSharedTemplates", () => ({
  useSharedTemplates: vi.fn(),
}));

vi.mock("~/lib/templates", () => ({
  TEMPLATES: {
    equity: {
      widgets: [{ widgetId: "ticker_info" }, { widgetId: "price_chart" }],
      prompts: ["Show me the price"],
    },
    onboarding: {},
  },
}));

vi.mock("~/lib/utils/createTemplates", () => ({
  OPENBB_ONBOARDING_WIDGETS: [{ widgetId: "onboarding_widget" }],
  createCustomTemplateTab: (...args: any[]) => mockCreateCustomTemplateTab(...args),
}));

import { useAllTemplates } from "~/hooks/useAllTemplates";
import { useAvailableTemplates } from "~/hooks/useAvailableTemplates";
import { useSharedTemplates } from "~/hooks/useSharedTemplates";
import { useShallowAppStore } from "~/lib/state/app";
import {
  getTemplateWidgetsMetadata,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAllTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowAppStore as any).mockImplementation((selector: (state: any) => any) =>
      selector({
        addTab: mockAddTab,
        items: { "test-dashboard-id": { tabs: [] } },
      }),
    );

    (useShallowBackendConnectorStore as any).mockImplementation(
      (selector: (state: any) => any) =>
        selector({
          apiSources: [],
        }),
    );

    (useAvailableTemplates as any).mockReturnValue([]);
    (useSharedTemplates as any).mockReturnValue({ data: [] });
    (getTemplateWidgetsMetadata as any).mockReturnValue({
      widgets: [],
      totalWidgets: 0,
    });
  });

  describe("basic functionality", () => {
    it("should return empty array when no templates available", () => {
      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toEqual([]);
    });

    it("should include OpenBB templates with correct type", () => {
      (useAvailableTemplates as any).mockReturnValue([
        {
          id: "equity",
          name: "Sandbox App (FMP Data)",
          description: "Sandbox data from Financial Modeling Prep (FMP)",
          onClick: vi.fn(),
          img: "/assets/equity.png",
        },
      ]);

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].type).toBe("openbb");
      expect(result.current[0].id).toBe("equity");
      expect(result.current[0].name).toBe("Sandbox App (FMP Data)");
    });

    it("should populate widgets and prompts from TEMPLATES for OpenBB templates", () => {
      (useAvailableTemplates as any).mockReturnValue([
        {
          id: "equity",
          name: "Sandbox App (FMP Data)",
          description: "Sandbox data from Financial Modeling Prep (FMP)",
          onClick: vi.fn(),
          img: "/assets/equity.png",
        },
      ]);

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].widgets).toEqual([
        { widgetId: "ticker_info" },
        { widgetId: "price_chart" },
      ]);
      expect(result.current[0].prompts).toEqual(["Show me the price"]);
    });

    it("should use OPENBB_ONBOARDING_WIDGETS for onboarding template", () => {
      (useAvailableTemplates as any).mockReturnValue([
        {
          id: "onboarding",
          name: "Onboarding",
          description: "Get started",
          onClick: vi.fn(),
          img: "/assets/onboarding.png",
        },
      ]);

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].widgets).toEqual([{ widgetId: "onboarding_widget" }]);
    });
  });

  describe("user templates from API sources", () => {
    it("should include user templates from apiSources", () => {
      const mockSource = {
        uuid: "source-1",
        name: "Custom Backend",
        url: "https://custom.api.com",
        templates: [
          {
            id: "custom-template",
            name: "Custom Template",
            description: "User's custom template",
            prompts: ["Custom prompt"],
            img: "/custom.png",
          },
        ],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [{ name: "Custom Widget" }],
        totalWidgets: 1,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].type).toBe("user");
      expect(result.current[0].id).toBe("custom-template");
      expect(result.current[0].name).toBe("Custom Template");
      expect(result.current[0].source).toBe(mockSource);
    });

    it("should filter out sources without templates", () => {
      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [
              { uuid: "source-1", templates: [] },
              { uuid: "source-2", templates: null },
              {
                uuid: "source-3",
                templates: [{ id: "t1", name: "Template" }],
              },
            ],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
    });

    it("should call createCustomTemplateTab on user template click", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [
          {
            id: "custom-template",
            name: "Custom Template",
            description: "Desc",
          },
        ],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      result.current[0].onClick();

      expect(mockCreateCustomTemplateTab).toHaveBeenCalledWith({
        addTab: mockAddTab,
        navigate: mockNavigate,
        items: { "test-dashboard-id": { tabs: [] } },
        template: mockSource.templates[0],
        source: mockSource,
        currentDashboard: "test-dashboard-id",
      });
    });

    it("should mark user templates as shared when in sharedTemplatesData", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [
          { id: "shared-template", name: "Shared Template" },
          { id: "private-template", name: "Private Template" },
        ],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (useSharedTemplates as any).mockReturnValue({
        data: [{ id: "shared-template" }],
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      const sharedTemplate = result.current.find((t) => t.id === "shared-template");
      const privateTemplate = result.current.find((t) => t.id === "private-template");

      expect(sharedTemplate?.isShared).toBe(true);
      expect(privateTemplate?.isShared).toBe(false);
    });
  });

  describe("shared templates", () => {
    it("should include shared templates with correct type", () => {
      const mockSharedTemplate = {
        id: "shared-1",
        templateId: "shared-template-id",
        name: "Shared Template",
        description: "A shared template",
        prompts: ["Shared prompt"],
        source: { uuid: "shared-source" },
      };

      (useSharedTemplates as any).mockReturnValue({
        data: [mockSharedTemplate],
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [{ name: "Shared Widget" }],
        totalWidgets: 2,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].type).toBe("shared");
      expect(result.current[0].id).toBe("shared-template-id");
      expect(result.current[0].name).toBe("Shared Template");
    });

    it("should not duplicate templates that exist in both user and shared", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [{ id: "duplicate-id", name: "User Template" }],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (useSharedTemplates as any).mockReturnValue({
        data: [
          {
            id: "duplicate-id",
            templateId: "duplicate-id",
            name: "Shared Template",
            source: {},
          },
        ],
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      const duplicateTemplates = result.current.filter((t) => t.id === "duplicate-id");
      expect(duplicateTemplates).toHaveLength(1);
      expect(duplicateTemplates[0].type).toBe("user");
    });

    it("should call createCustomTemplateTab on shared template click", () => {
      const mockSharedTemplate = {
        id: "shared-1",
        templateId: "shared-template-id",
        name: "Shared Template",
        description: "Desc",
        prompts: [],
        source: { uuid: "shared-source" },
      };

      (useSharedTemplates as any).mockReturnValue({
        data: [mockSharedTemplate],
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      result.current[0].onClick();

      expect(mockCreateCustomTemplateTab).toHaveBeenCalledWith({
        addTab: mockAddTab,
        navigate: mockNavigate,
        items: { "test-dashboard-id": { tabs: [] } },
        template: mockSharedTemplate,
        source: mockSharedTemplate.source,
        currentDashboard: "test-dashboard-id",
      });
    });
  });

  describe("template ordering", () => {
    it("should order templates as: shared, user, openbb", () => {
      (useAvailableTemplates as any).mockReturnValue([
        { id: "equity", name: "OpenBB Template" },
      ]);

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [
              {
                uuid: "source-1",
                templates: [{ id: "user-template", name: "User Template" }],
              },
            ],
          }),
      );

      (useSharedTemplates as any).mockReturnValue({
        data: [
          {
            id: "shared-template",
            templateId: "shared-template",
            name: "Shared Template",
            source: {},
          },
        ],
      });

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].type).toBe("shared");
      expect(result.current[1].type).toBe("user");
      expect(result.current[2].type).toBe("openbb");
    });
  });

  describe("isLoadingApiSources parameter", () => {
    it("should disable shared templates query when isLoadingApiSources is true", () => {
      renderHook(() => useAllTemplates(true), { wrapper });

      expect(useSharedTemplates).toHaveBeenCalledWith({ enabled: false });
    });

    it("should enable shared templates query when isLoadingApiSources is false", () => {
      renderHook(() => useAllTemplates(false), { wrapper });

      expect(useSharedTemplates).toHaveBeenCalledWith({ enabled: true });
    });

    it("should default to enabling shared templates query", () => {
      renderHook(() => useAllTemplates(), { wrapper });

      expect(useSharedTemplates).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe("template properties", () => {
    it("should include all template image variants", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [
          {
            id: "template-1",
            name: "Template",
            img: "/default.png",
            img_dark: "/dark.png",
            img_light: "/light.png",
          },
        ],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].img).toBe("/default.png");
      expect(result.current[0].img_dark).toBe("/dark.png");
      expect(result.current[0].img_light).toBe("/light.png");
    });

    it("should include selected_agent for user templates", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [
          {
            id: "template-1",
            name: "Template",
            selected_agent: "custom-agent-id",
          },
        ],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [],
        totalWidgets: 0,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].selected_agent).toBe("custom-agent-id");
    });

    it("should include totalWidgets from getTemplateWidgetsMetadata", () => {
      const mockSource = {
        uuid: "source-1",
        templates: [{ id: "template-1", name: "Template" }],
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            apiSources: [mockSource],
          }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [{ name: "W1" }, { name: "W2" }],
        totalWidgets: 5,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current[0].totalWidgets).toBe(5);
      expect(result.current[0].widgets).toEqual([{ name: "W1" }, { name: "W2" }]);
    });
  });

  describe("rehydrated listed apps", () => {
    it("renders rehydrated listed app from full cached templates (no fake disconnected template)", () => {
      const cachedTemplate = {
        id: "cached-template",
        name: "Cached Listed Template",
        description: "Hydrated from localStorage",
        prompts: ["cached prompt"],
        widgets: { foo: { name: "Foo" } },
        tabs: {},
      };

      const mockSource = {
        id: "source-listed",
        uuid: "source-listed",
        name: "Listed Backend",
        url: "https://listed.example.com",
        status: "rehydrated",
        templates: [cachedTemplate],
        widgets: { foo: { name: "Foo" } },
        vendorApp: {
          uuid: "vendor-uuid",
          name: "Vendor App",
          shortDescription: "Vendor desc",
          prompts: [],
        },
      };

      (useShallowBackendConnectorStore as any).mockImplementation(
        (selector: (state: any) => any) => selector({ apiSources: [mockSource] }),
      );

      (getTemplateWidgetsMetadata as any).mockReturnValue({
        widgets: [{ name: "Foo" }],
        totalWidgets: 1,
      });

      const { result } = renderHook(() => useAllTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
      const tpl = result.current[0];
      expect(tpl.type).toBe("listed");
      expect(tpl.id).toBe("listed-vendor-uuid");
      expect(tpl.name).toBe("Vendor App");
      expect(tpl.description).toBe(cachedTemplate.description);
      expect(tpl.prompts).toEqual(["cached prompt"]);
    });
  });
});
