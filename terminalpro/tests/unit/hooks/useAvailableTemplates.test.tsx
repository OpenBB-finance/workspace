import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockAddTab = vi.fn();
const mockCreateEquityTemplateTab = vi.fn();

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
  useAppStore: {
    getState: () => ({
      items: { "test-dashboard-id": { tabs: [] } },
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: vi.fn(),
}));

vi.mock("~/lib/templates", () => ({
  getAvailableTemplates: vi.fn(),
}));

vi.mock("~/lib/utils/createTemplates", () => ({
  createEquityTemplateTab: (...args: any[]) => mockCreateEquityTemplateTab(...args),
}));

import { useAvailableTemplates } from "~/hooks/useAvailableTemplates";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { getAvailableTemplates } from "~/lib/templates";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAvailableTemplates", () => {
  const mockDefaultTicker = {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "stock",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowAppStore as any).mockImplementation((selector: (state: any) => any) =>
      selector({
        addTab: mockAddTab,
      }),
    );

    (useShallowThemeStore as any).mockImplementation((selector: (state: any) => any) =>
      selector({
        defaultTicker: mockDefaultTicker,
        theme: "dark",
      }),
    );

    (useShallowFeatureFlagsStore as any).mockImplementation(
      (selector: (state: any) => any) => selector({}),
    );

    (getAvailableTemplates as any).mockReturnValue(["equity"]);
  });

  describe("template generation", () => {
    it("should return equity template when available", () => {
      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe("equity");
      expect(result.current[0].name).toBe("Sandbox App (FMP Data)");
    });

    it("should include correct description for equity template", () => {
      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current[0].description).toContain(
        "Sandbox data from Financial Modeling Prep (FMP)",
      );
      expect(result.current[0].description).toContain("company financials, comparisons, ownership");
    });

    it("should have onClick handler that creates equity template tab", () => {
      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      result.current[0].onClick();

      expect(mockCreateEquityTemplateTab).toHaveBeenCalledWith(
        { name: mockDefaultTicker.symbol },
        expect.objectContaining({
          addTab: mockAddTab,
          navigate: mockNavigate,
          currentDashboard: "test-dashboard-id",
          defaultTicker: mockDefaultTicker,
        }),
      );
    });
  });

  describe("theme-based image selection", () => {
    it("should use light theme image path when theme is light", () => {
      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: mockDefaultTicker,
            theme: "light",
          }),
      );

      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current[0].img).toBe("/assets/images/openbb_cover.png");
    });

    it("should use dark theme image path when theme is dark", () => {
      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: mockDefaultTicker,
            theme: "dark",
          }),
      );

      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current[0].img).toBe("/assets/images/openbb_cover.png");
    });
  });

  describe("filtering based on feature flags", () => {
    it("should return empty array when no templates are available", () => {
      (getAvailableTemplates as any).mockReturnValue([]);

      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current).toHaveLength(0);
    });

    it("should filter templates based on getAvailableTemplates result", () => {
      (getAvailableTemplates as any).mockReturnValue(["charting"]);

      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      expect(result.current).toHaveLength(0);
    });

    it("should call getAvailableTemplates with feature flags data_bundle_info", () => {
      const mockFeatureFlags = {
        featureFlags: {
          data_bundle_info: {
            except_dashboard_templates: ["charting"],
          },
        },
      };

      (useShallowFeatureFlagsStore as any).mockImplementation(
        (selector: (state: any) => any) => selector(mockFeatureFlags),
      );

      renderHook(() => useAvailableTemplates(), { wrapper });

      expect(getAvailableTemplates).toHaveBeenCalledWith(
        mockFeatureFlags.featureFlags.data_bundle_info,
      );
    });

    it("should pass null to getAvailableTemplates when no data_bundle_info", () => {
      (useShallowFeatureFlagsStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            featureFlags: null,
          }),
      );

      renderHook(() => useAvailableTemplates(), { wrapper });

      expect(getAvailableTemplates).toHaveBeenCalledWith(null);
    });
  });

  describe("default ticker usage", () => {
    it("should use defaultTicker symbol in template creation", () => {
      const customTicker = {
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        type: "stock",
      };

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: customTicker,
            theme: "dark",
          }),
      );

      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      result.current[0].onClick();

      expect(mockCreateEquityTemplateTab).toHaveBeenCalledWith(
        { name: "GOOGL" },
        expect.objectContaining({
          defaultTicker: customTicker,
        }),
      );
    });
  });

  describe("memoization", () => {
    it("should return same reference when dependencies do not change", () => {
      const { result, rerender } = renderHook(() => useAvailableTemplates(), {
        wrapper,
      });

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it("should return new reference when theme changes", () => {
      let theme = "dark";

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: mockDefaultTicker,
            theme,
          }),
      );

      const { result, rerender } = renderHook(() => useAvailableTemplates(), {
        wrapper,
      });

      const firstResult = result.current;

      theme = "light";
      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: mockDefaultTicker,
            theme,
          }),
      );

      rerender();
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });

  describe("template structure", () => {
    it("should return templates with required TemplateT properties", () => {
      const { result } = renderHook(() => useAvailableTemplates(), { wrapper });

      const template = result.current[0];
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("name");
      expect(template).toHaveProperty("description");
      expect(template).toHaveProperty("onClick");
      expect(template).toHaveProperty("img");
      expect(typeof template.onClick).toBe("function");
    });
  });
});
