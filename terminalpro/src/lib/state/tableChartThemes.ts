import type { AgChartThemeName } from "ag-charts-enterprise";
import type {
  ColorValue,
  FontFamilyValue,
  LengthValue,
  ScaleValue,
  ThemeDefaultParams,
} from "ag-grid-enterprise";
import isEqual from "lodash.isequal";
import { toast } from "sonner";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { updateEntityThemeSettings } from "~/api/admin.api";
import { getEntityThemeSettings } from "~/api/auth.api";
import type { Selector } from "./app";

type NonString<T> = T extends string
  ? string
  : T extends ScaleValue
    ? number
    : T extends ColorValue | FontFamilyValue | LengthValue
      ? string
      : T;

export type ThemeDefaultParamsT = {
  [K in keyof ThemeDefaultParams]: NonString<ThemeDefaultParams[K]>;
} & {
  altHeaderBackgroundColor: string;
  evenRowBackgroundColor: string;
};

export type ChartThemeParams = {
  // Core Parameters
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  foregroundColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  borderColor?: string;
  textColor?: string;
  subtleTextColor?: string;
  padding?: number;
  // Chrome Parameters
  chromeBackgroundColor?: string;
  chromeTextColor?: string;
  chromeFontFamily?: string;
  chromeFontSize?: number;
  chromeFontWeight?: string;
  chromeSubtleTextColor?: string;
  // Input Parameters
  inputBackgroundColor?: string;
  inputTextColor?: string;
  // Grid and Axis Parameters
  gridLineColor?: string;
  axisColor?: string;
  // Crosshair Parameters
  crosshairLabelBackgroundColor?: string;
  crosshairLabelTextColor?: string;
  // Background image properties
  backgroundImageEnabled?: boolean;
  backgroundImageUrl?: string;
  backgroundImageWidth?: number;
  backgroundImageHeight?: number;
  backgroundImageLeft?: number;
  backgroundImageTop?: number;
  backgroundImageRight?: number;
  backgroundImageBottom?: number;
};

export type ChartThemePalette = {
  fills?: string[];
  strokes?: string[];
};

type TableTheme = {
  iconSet?: "iconSetQuartz" | "iconSetAlpine" | "iconSetMaterial";
  params: ThemeDefaultParams;
};

type ChartTheme = {
  baseTheme: AgChartThemeName;
  palette: ChartThemePalette;
  params: ChartThemeParams;
  backgroundImage?: {
    enabled: boolean;
    url: string;
    width: number;
    height: number;
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
    opacity: number;
  };
};

// Application-level theming (e.g., grouping colors)
type AppTheme = {
  grouping: {
    palette: string[];
  };
};

export type ThemeSettings = {
  tableTheme?: TableTheme | null;
  chartTheme?: ChartTheme | null;
  appTheme?: AppTheme | null;
};

export interface EntityThemeSettings {
  light: ThemeSettings | null;
  dark: ThemeSettings | null;
}

interface TableChartThemesState extends EntityThemeSettings {
  updateThemeSettings: (settings?: EntityThemeSettings) => Promise<void>;
  saveThemeSettings: (settings: EntityThemeSettings) => Promise<void>;
}

const getDefault = (): ThemeSettings => ({
  tableTheme: null,
  chartTheme: null,
  appTheme: null,
});

export const useTableChartThemesStore = createWithEqualityFn<TableChartThemesState>()(
  subscribeWithSelector((set, _get) => ({
    light: getDefault(),
    dark: getDefault(),
    updateThemeSettings: async (settings) => {
      if (settings) return set(settings);

      settings = await getEntityThemeSettings();
      for (const key of Object.keys(settings)) {
        if (settings[key] === null) {
          settings[key] = getDefault();
        }
      }
      set(settings);
    },
    saveThemeSettings: async (settings) => {
      const changedSettings = await getEntityThemeSettings();

      for (const mode of ["light", "dark"] as const) {
        if (!settings[mode]) continue;

        for (const themeType of ["tableTheme", "chartTheme", "appTheme"] as const) {
          if (themeType in settings[mode])
            changedSettings[mode] = {
              ...changedSettings[mode],
              [themeType]: settings[mode]?.[themeType],
            };
        }
      }
      set(changedSettings);
      await updateEntityThemeSettings(changedSettings);

      // Determine which theme type was changed
      let themeTypeChanged = "Theme";
      for (const mode of ["light", "dark"] as const) {
        if (settings[mode]?.tableTheme !== undefined) {
          themeTypeChanged = "Table";
          break;
        }
        if (settings[mode]?.chartTheme !== undefined) {
          themeTypeChanged = "Chart";
          break;
        }
        if (settings[mode]?.appTheme !== undefined) {
          themeTypeChanged = "Grouping";
          break;
        }
      }

      toast.success("Theme settings updated.", {
        id: "theme-settings-update",
        description: `${themeTypeChanged} theme settings updated.`,
      });
    },
  })),
  shallow,
);

export function useShallowTableChartThemesStore<S extends TableChartThemesState, T>(
  selector: Selector<S, T>,
): T {
  return useTableChartThemesStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}
