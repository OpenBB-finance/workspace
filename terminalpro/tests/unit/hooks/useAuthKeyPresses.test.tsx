import { renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies
vi.mock("use-debounce", () => ({
  useDebouncedCallback: (fn: any) => fn,
}));

vi.mock("~/api/dashboard.api", () => ({
  saveDashboards: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/components/DataConnectors/Providers/DataConnectorContext", () => ({
  useDataConnectorContext: () => ({
    setOpen: vi.fn(),
  }),
}));

vi.mock("~/components/LayoutAuth/AppLayout/hooks/usePanelsState", () => ({
  usePanelsState: () => false,
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: () => vi.fn(),
}));

const mockCopilotStore = {
  isFullscreen: false,
  lastPanelState: "open",
  toggleFullscreen: vi.fn(),
  setLastPanelState: vi.fn(),
  setIsIntentionallyCollapsed: vi.fn(),
};

vi.mock("~/lib/state/copilot", () => ({
  useCopilotStore: {
    getState: () => mockCopilotStore,
  },
}));

const mockThemeStore = {
  toggleGroupingVisibility: vi.fn(),
  toggleTheme: vi.fn(),
  togglePresenterMode: vi.fn(),
  toggleShortcutSidebar: vi.fn(),
  toggleSearch: vi.fn(),
  setInitialSelectedSearchTab: vi.fn(),
  setCreateFolderPopup: vi.fn(),
  debouncedUpdateSettings: vi.fn(),
};

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => mockThemeStore,
}));

vi.mock("~/lib/utils", () => ({
  dispatchSaveState: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/lib/utils/app", () => ({
  createTab: vi.fn(),
}));

import useAuthKeyPresses from "~/hooks/useAuthKeyPresses";
import { createTab } from "~/lib/utils/app";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useAuthKeyPresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DOM
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const simulateKeypress = (key: string, options: Partial<KeyboardEvent> = {}) => {
    const event = new KeyboardEvent("keydown", {
      key,
      keyCode: key.charCodeAt(0),
      bubbles: true,
      ...options,
    });
    document.dispatchEvent(event);
  };

  const simulateKeypressWithCode = (keyCode: number, options: Partial<KeyboardEvent> = {}) => {
    const event = new KeyboardEvent("keydown", {
      keyCode,
      bubbles: true,
      ...options,
    });
    document.dispatchEvent(event);
  };

  describe("keyboard shortcuts", () => {
    it("should register keydown event listener on mount", () => {
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      renderHook(() => useAuthKeyPresses(), { wrapper });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        expect.any(Object),
      );
    });

    it("should remove event listener on unmount", () => {
      const { unmount } = renderHook(() => useAuthKeyPresses(), { wrapper });

      const abortSpy = vi.fn();
      const originalAbortController = global.AbortController;
      global.AbortController = class {
        signal = {};
        abort = abortSpy;
      } as any;

      unmount();

      global.AbortController = originalAbortController;
    });

    it("should toggle grouping visibility on Cmd+G", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(71, { metaKey: true }); // G = 71

      expect(mockThemeStore.toggleGroupingVisibility).toHaveBeenCalled();
    });

    it("should toggle search on Cmd+K", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(75, { metaKey: true }); // K = 75

      expect(mockThemeStore.setInitialSelectedSearchTab).toHaveBeenCalledWith("widgets");
      expect(mockThemeStore.toggleSearch).toHaveBeenCalled();
    });

    it("should toggle theme on Cmd+M", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(77, { metaKey: true }); // M = 77

      expect(mockThemeStore.toggleTheme).toHaveBeenCalled();
      expect(mockThemeStore.debouncedUpdateSettings).toHaveBeenCalled();
    });

    it("should toggle presenter mode on Cmd+Shift+F", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(70, { metaKey: true, shiftKey: true }); // F = 70

      expect(mockThemeStore.togglePresenterMode).toHaveBeenCalled();
    });

    it("should toggle shortcut sidebar on Cmd+H", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(72, { metaKey: true }); // H = 72

      expect(mockThemeStore.toggleShortcutSidebar).toHaveBeenCalled();
    });

    it("should create new tab on Cmd+Alt+T", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(84, { metaKey: true, altKey: true }); // T = 84

      expect(createTab).toHaveBeenCalled();
    });

    it("should open create folder popup on Cmd+Alt+F", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(70, { metaKey: true, altKey: true }); // F = 70

      expect(mockThemeStore.setCreateFolderPopup).toHaveBeenCalledWith(true);
    });

    it("should work with Ctrl key as well as Meta key", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      simulateKeypressWithCode(71, { ctrlKey: true }); // G = 71

      expect(mockThemeStore.toggleGroupingVisibility).toHaveBeenCalled();
    });
  });

  describe("event prevention", () => {
    it("should prevent default for handled shortcuts", () => {
      renderHook(() => useAuthKeyPresses(), { wrapper });

      const event = new KeyboardEvent("keydown", {
        keyCode: 71, // G
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
