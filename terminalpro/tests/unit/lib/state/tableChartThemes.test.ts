/**
 * Tests for tableChartThemes Zustand store
 *
 * Tests the table/chart theme state management including:
 * - Light/dark theme settings storage
 * - Theme update operations
 * - Theme save operations with API calls
 * - Table theme configuration
 * - Chart theme configuration
 * - App theme configuration (grouping palette)
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useTableChartThemesStore,
  type ThemeSettings,
  type EntityThemeSettings,
  type ChartThemeParams,
  type ChartThemePalette,
} from "~/lib/state/tableChartThemes";

// Mock external dependencies
vi.mock("~/api/admin.api", () => ({
  updateEntityThemeSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/api/auth.api", () => ({
  getEntityThemeSettings: vi.fn().mockResolvedValue({
    light: null,
    dark: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateEntityThemeSettings } from "~/api/admin.api";
import { getEntityThemeSettings } from "~/api/auth.api";
import { toast } from "sonner";

const createMockTableTheme = () => ({
  iconSet: "iconSetQuartz" as const,
  params: {
    accentColor: "#0066cc",
    backgroundColor: "#ffffff",
    foregroundColor: "#000000",
  },
});

const createMockChartTheme = () => ({
  baseTheme: "ag-default" as const,
  palette: {
    fills: ["#ff0000", "#00ff00", "#0000ff"],
    strokes: ["#cc0000", "#00cc00", "#0000cc"],
  } satisfies ChartThemePalette,
  params: {
    fontFamily: "Inter",
    fontSize: 12,
    foregroundColor: "#333333",
    backgroundColor: "#ffffff",
  } satisfies ChartThemeParams,
});

const createMockAppTheme = () => ({
  grouping: {
    palette: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
  },
});

const createMockThemeSettings = (
  overrides: Partial<ThemeSettings> = {},
): ThemeSettings => {
  // Only include keys that are explicitly set in overrides
  // The implementation uses `in` operator, so we must not include keys we don't want to change
  return overrides as ThemeSettings;
};

describe("useTableChartThemesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    act(() => {
      useTableChartThemesStore.setState({
        light: {
          tableTheme: null,
          chartTheme: null,
          appTheme: null,
        },
        dark: {
          tableTheme: null,
          chartTheme: null,
          appTheme: null,
        },
      });
    });
  });

  describe("initial state", () => {
    it("should have correct default values for light theme", () => {
      const state = useTableChartThemesStore.getState();

      expect(state.light).toEqual({
        tableTheme: null,
        chartTheme: null,
        appTheme: null,
      });
    });

    it("should have correct default values for dark theme", () => {
      const state = useTableChartThemesStore.getState();

      expect(state.dark).toEqual({
        tableTheme: null,
        chartTheme: null,
        appTheme: null,
      });
    });
  });

  describe("updateThemeSettings", () => {
    it("should update with provided settings", async () => {
      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: createMockTableTheme() as any }),
        dark: createMockThemeSettings({ chartTheme: createMockChartTheme() as any }),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings(settings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.tableTheme).toEqual(createMockTableTheme());
      expect(state.dark?.chartTheme).toEqual(createMockChartTheme());
    });

    it("should fetch settings from API when no settings provided", async () => {
      const apiSettings: EntityThemeSettings = {
        light: createMockThemeSettings({ appTheme: createMockAppTheme() }),
        dark: createMockThemeSettings({ tableTheme: createMockTableTheme() as any }),
      };

      vi.mocked(getEntityThemeSettings).mockResolvedValueOnce(apiSettings);

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings();
      });

      expect(getEntityThemeSettings).toHaveBeenCalled();
      const state = useTableChartThemesStore.getState();
      expect(state.light?.appTheme).toEqual(createMockAppTheme());
      expect(state.dark?.tableTheme).toEqual(createMockTableTheme());
    });

    it("should replace null values with defaults when fetching from API", async () => {
      const apiSettings = {
        light: null,
        dark: createMockThemeSettings({ chartTheme: createMockChartTheme() as any }),
      };

      vi.mocked(getEntityThemeSettings).mockResolvedValueOnce(apiSettings as any);

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings();
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light).toEqual({
        tableTheme: null,
        chartTheme: null,
        appTheme: null,
      });
    });

    it("should handle both modes having null values", async () => {
      const apiSettings = {
        light: null,
        dark: null,
      };

      vi.mocked(getEntityThemeSettings).mockResolvedValueOnce(apiSettings as any);

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings();
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light).toEqual({
        tableTheme: null,
        chartTheme: null,
        appTheme: null,
      });
      expect(state.dark).toEqual({
        tableTheme: null,
        chartTheme: null,
        appTheme: null,
      });
    });
  });

  describe("saveThemeSettings", () => {
    beforeEach(() => {
      vi.mocked(getEntityThemeSettings).mockResolvedValue({
        light: null,
        dark: null,
      });
    });

    it("should save table theme settings", async () => {
      const tableTheme = createMockTableTheme();
      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: tableTheme as any }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      expect(updateEntityThemeSettings).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Theme settings updated.", {
        id: "theme-settings-update",
        description: "Table theme settings updated.",
      });
    });

    it("should save chart theme settings", async () => {
      const chartTheme = createMockChartTheme();
      const settings: EntityThemeSettings = {
        light: null,
        dark: createMockThemeSettings({ chartTheme: chartTheme as any }),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      expect(updateEntityThemeSettings).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Theme settings updated.", {
        id: "theme-settings-update",
        description: "Chart theme settings updated.",
      });
    });

    it("should save app theme settings (grouping)", async () => {
      const appTheme = createMockAppTheme();
      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ appTheme }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      expect(updateEntityThemeSettings).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Theme settings updated.", {
        id: "theme-settings-update",
        description: "Grouping theme settings updated.",
      });
    });

    it("should merge with existing settings from API", async () => {
      const existingSettings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: createMockTableTheme() as any }),
        dark: createMockThemeSettings({ chartTheme: createMockChartTheme() as any }),
      };

      vi.mocked(getEntityThemeSettings).mockResolvedValueOnce(existingSettings);

      const newSettings: EntityThemeSettings = {
        light: createMockThemeSettings({ appTheme: createMockAppTheme() }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(newSettings);
      });

      const callArg = vi.mocked(updateEntityThemeSettings).mock.calls[0][0];
      expect(callArg.light?.tableTheme).toEqual(createMockTableTheme());
      expect(callArg.light?.appTheme).toEqual(createMockAppTheme());
      expect(callArg.dark?.chartTheme).toEqual(createMockChartTheme());
    });

    it("should update local state after saving", async () => {
      const chartTheme = createMockChartTheme();
      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ chartTheme: chartTheme as any }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.chartTheme).toEqual(chartTheme);
    });

    it("should show default theme type message when no specific theme detected", async () => {
      const settings: EntityThemeSettings = {
        light: createMockThemeSettings(),
        dark: createMockThemeSettings(),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      expect(toast.success).toHaveBeenCalledWith("Theme settings updated.", {
        id: "theme-settings-update",
        description: "Theme theme settings updated.",
      });
    });

    it("should handle saving both light and dark mode settings", async () => {
      const lightTable = createMockTableTheme();
      const darkChart = createMockChartTheme();

      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: lightTable as any }),
        dark: createMockThemeSettings({ chartTheme: darkChart as any }),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(settings);
      });

      expect(updateEntityThemeSettings).toHaveBeenCalled();
      const state = useTableChartThemesStore.getState();
      expect(state.light?.tableTheme).toEqual(lightTable);
      expect(state.dark?.chartTheme).toEqual(darkChart);
    });
  });

  describe("theme configuration objects", () => {
    describe("tableTheme", () => {
      it("should store and retrieve table theme with icon set", async () => {
        const tableTheme = {
          iconSet: "iconSetAlpine" as const,
          params: {
            accentColor: "#1a73e8",
            backgroundColor: "#fafafa",
          },
        };

        const settings: EntityThemeSettings = {
          light: createMockThemeSettings({ tableTheme: tableTheme as any }),
          dark: null,
        };

        await act(async () => {
          await useTableChartThemesStore.getState().updateThemeSettings(settings);
        });

        const state = useTableChartThemesStore.getState();
        expect(state.light?.tableTheme?.iconSet).toBe("iconSetAlpine");
        expect(state.light?.tableTheme?.params.accentColor).toBe("#1a73e8");
      });
    });

    describe("chartTheme", () => {
      it("should store and retrieve chart theme with palette", async () => {
        const chartTheme = createMockChartTheme();

        const settings: EntityThemeSettings = {
          light: null,
          dark: createMockThemeSettings({ chartTheme: chartTheme as any }),
        };

        await act(async () => {
          await useTableChartThemesStore.getState().updateThemeSettings(settings);
        });

        const state = useTableChartThemesStore.getState();
        expect(state.dark?.chartTheme?.baseTheme).toBe("ag-default");
        expect(state.dark?.chartTheme?.palette?.fills).toHaveLength(3);
        expect(state.dark?.chartTheme?.params?.fontFamily).toBe("Inter");
      });

      it("should support background image configuration", async () => {
        const chartTheme = {
          ...createMockChartTheme(),
          backgroundImage: {
            enabled: true,
            url: "https://example.com/bg.png",
            width: 100,
            height: 100,
            left: 10,
            top: 10,
            opacity: 0.5,
          },
        };

        const settings: EntityThemeSettings = {
          light: createMockThemeSettings({ chartTheme: chartTheme as any }),
          dark: null,
        };

        await act(async () => {
          await useTableChartThemesStore.getState().updateThemeSettings(settings);
        });

        const state = useTableChartThemesStore.getState();
        expect(state.light?.chartTheme?.backgroundImage?.enabled).toBe(true);
        expect(state.light?.chartTheme?.backgroundImage?.url).toBe("https://example.com/bg.png");
      });
    });

    describe("appTheme", () => {
      it("should store and retrieve grouping palette", async () => {
        const appTheme = {
          grouping: {
            palette: ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"],
          },
        };

        const settings: EntityThemeSettings = {
          light: createMockThemeSettings({ appTheme }),
          dark: createMockThemeSettings({ appTheme }),
        };

        await act(async () => {
          await useTableChartThemesStore.getState().updateThemeSettings(settings);
        });

        const state = useTableChartThemesStore.getState();
        expect(state.light?.appTheme?.grouping?.palette).toHaveLength(5);
        expect(state.dark?.appTheme?.grouping?.palette?.[0]).toBe("#e74c3c");
      });
    });
  });

  describe("state isolation between modes", () => {
    it("should maintain separate state for light and dark modes", async () => {
      const lightTable = {
        ...createMockTableTheme(),
        params: { ...createMockTableTheme().params, backgroundColor: "#ffffff" },
      };

      const darkTable = {
        ...createMockTableTheme(),
        params: { ...createMockTableTheme().params, backgroundColor: "#1a1a1a" },
      };

      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: lightTable as any }),
        dark: createMockThemeSettings({ tableTheme: darkTable as any }),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings(settings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.tableTheme?.params.backgroundColor).toBe("#ffffff");
      expect(state.dark?.tableTheme?.params.backgroundColor).toBe("#1a1a1a");
    });

    it("should allow updating only one mode without affecting the other", async () => {
      const initialSettings: EntityThemeSettings = {
        light: createMockThemeSettings({ tableTheme: createMockTableTheme() as any }),
        dark: createMockThemeSettings({ chartTheme: createMockChartTheme() as any }),
      };

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings(initialSettings);
      });

      const updateSettings: EntityThemeSettings = {
        light: createMockThemeSettings({ appTheme: createMockAppTheme() }),
        dark: null,
      };

      vi.mocked(getEntityThemeSettings).mockResolvedValueOnce(initialSettings);

      await act(async () => {
        await useTableChartThemesStore.getState().saveThemeSettings(updateSettings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.tableTheme).toEqual(createMockTableTheme());
      expect(state.light?.appTheme).toEqual(createMockAppTheme());
      expect(state.dark?.chartTheme).toEqual(createMockChartTheme());
    });
  });

  describe("edge cases", () => {
    it("should handle partial theme settings", async () => {
      const partialChartTheme = {
        baseTheme: "ag-sheets" as const,
        palette: {},
        params: {
          fontSize: 14,
        },
      };

      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ chartTheme: partialChartTheme as any }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings(settings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.chartTheme?.params?.fontSize).toBe(14);
      expect(state.light?.chartTheme?.params?.fontFamily).toBeUndefined();
    });

    it("should handle empty palette arrays", async () => {
      const chartTheme = {
        ...createMockChartTheme(),
        palette: {
          fills: [],
          strokes: [],
        },
      };

      const settings: EntityThemeSettings = {
        light: createMockThemeSettings({ chartTheme: chartTheme as any }),
        dark: null,
      };

      await act(async () => {
        await useTableChartThemesStore.getState().updateThemeSettings(settings);
      });

      const state = useTableChartThemesStore.getState();
      expect(state.light?.chartTheme?.palette?.fills).toEqual([]);
      expect(state.light?.chartTheme?.palette?.strokes).toEqual([]);
    });
  });
});
