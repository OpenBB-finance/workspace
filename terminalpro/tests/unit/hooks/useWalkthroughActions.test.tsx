import { renderHook } from "@testing-library/react";
import * as router from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useWalkthroughActions } from "~/hooks/useWalkthroughActions";

// Mock all the stores
vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn((selector) =>
    selector({
      addWidget: vi.fn(),
      getTabById: vi.fn(),
    }),
  ),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useShallowAppWidgetsStore: vi.fn((selector) =>
    selector({
      getAppWidget: vi.fn(),
      lastUpdated: 0,
    }),
  ),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: vi.fn((selector) =>
    selector({
      toggleSelectedWidget: vi.fn(),
    }),
  ),
}));

vi.mock("~/lib/state/walkthrough", () => ({
  useShallowWalkthroughStore: vi.fn((selector) =>
    selector({
      copilotArtifact: {
        content: [{ a: 1 }],
        description: "test",
        chart_params: { chartType: "bar" },
      },
    }),
  ),
}));

vi.mock("~/lib/state/sidebar", () => ({
  useShallowSidebarStore: vi.fn((selector) =>
    selector({
      setIsHamburgerMenuOpen: vi.fn(),
    }),
  ),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn((selector) =>
    selector({
      addChat: vi.fn(),
      setCurrentChat: vi.fn(),
      getChatsData: vi.fn(() => []),
    }),
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector) =>
    selector({
      setShowWidgetControlsEllipsis: vi.fn(),
    }),
  ),
}));

// Mock router
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(() => ({ id: "tab-1" })),
}));

// Mock utils
vi.mock("~/components/AI/hooks/utils", () => ({
  dispatchCopilotCommand: vi.fn(),
  dispatchCopilotSubmit: vi.fn(),
}));

vi.mock("~/lib/utils", () => ({
  uuidv4: vi.fn(() => "uuid-123"),
}));

describe("useWalkthroughActions", () => {
  it("should return all expected actions", () => {
    const { result } = renderHook(() => useWalkthroughActions());
    expect(result.current).toHaveProperty("expandCopilot");
    expect(result.current).toHaveProperty("newCopilotChat");
    expect(result.current).toHaveProperty("createEarningHistoryWidget");
    expect(result.current).toHaveProperty("addEarningHistoryWidgetToContext");
    expect(result.current).toHaveProperty("clickHamburgerMenu");
    expect(result.current).toHaveProperty("askCopilotGeneralEarningSurprisePercentage");
    expect(result.current).toHaveProperty("navigateToApps");
    expect(result.current).toHaveProperty(
      "createCopilotWidgetGeneralEarningSurprisePercentage",
    );
  });

  it("should handle navigateToApps", () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    const { result } = renderHook(() => useWalkthroughActions());
    result.current.navigateToApps();
    expect(navigate).toHaveBeenCalledWith("/app");
  });

  it("should handle clickHamburgerMenu", async () => {
    const setIsHamburgerMenuOpen = vi.fn();
    // We need to re-mock or find a way to get the spy.
    // Since useWalkthroughActions uses useShallowSidebarStore,
    // let's adjust the mock to capture the spy.
    const { useShallowSidebarStore } = await import("~/lib/state/sidebar");
    vi.mocked(useShallowSidebarStore).mockImplementation((selector: any) =>
      selector({ setIsHamburgerMenuOpen }),
    );

    const { result } = renderHook(() => useWalkthroughActions());
    result.current.clickHamburgerMenu();
    expect(setIsHamburgerMenuOpen).toHaveBeenCalledWith(true);
  });

  it("should handle expandCopilot", () => {
    const mockElement = { click: vi.fn() };
    vi.spyOn(document, "getElementById").mockReturnValue(mockElement as any);

    const { result } = renderHook(() => useWalkthroughActions());
    result.current.expandCopilot();
    expect(mockElement.click).toHaveBeenCalled();
  });
});
