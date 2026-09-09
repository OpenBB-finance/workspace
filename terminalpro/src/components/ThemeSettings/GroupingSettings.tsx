import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import { Label } from "~/components/ds/atoms/Label";
import { ColorPicker } from "~/components/ds/molecules/ColorPicker";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  type EntityThemeSettings,
  type ThemeSettings,
  useTableChartThemesStore,
} from "~/lib/state/tableChartThemes";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import SettingsMenu from "../ds/molecules/SettingsMenu";
import Icon from "../Icon";
import { THEME_MODES, ThemeSettingsLayout } from "./ThemeSettingsLayout";

const DEFAULT_COLORS = [
  "#00AAFF", // blue
  "#EF6689", // pink
  "#16A34A", // green
  "#FB923C", // orange
  "#CCBE00", // yellow
  "#337DBA", // dark blue
  "#998E00", // dark yellow
  "#917DB0", // purple
  "#FB923C", // orange
];

const MIN_COLORS = 5;

interface GroupingThemeState {
  palette: string[];
  isReset?: boolean;
}

const THEME_DEFAULT: GroupingThemeState = {
  palette: DEFAULT_COLORS,
};

type GroupingSettingsState = {
  light?: GroupingThemeState;
  dark?: GroupingThemeState;
  themeMode?: "light" | "dark";
};

const STATE_DEFAULT: GroupingSettingsState = {
  light: THEME_DEFAULT,
  dark: THEME_DEFAULT,
};

function updateState(
  currentTheme: ThemeSettings["appTheme"],
  mode: "light" | "dark",
  updatedState: Partial<GroupingSettingsState>,
) {
  if (currentTheme?.grouping?.palette) {
    updatedState[mode] = {
      palette: currentTheme.grouping.palette,
      isReset: false,
    };
  } else {
    updatedState[mode] = { ...STATE_DEFAULT[mode], isReset: true };
  }
}

function initializer(state: GroupingSettingsState): GroupingSettingsState {
  const { light, dark } = useTableChartThemesStore.getState();
  const appThemes = { light: light?.appTheme, dark: dark?.appTheme };
  const updatedState = {} as Partial<GroupingSettingsState>;
  for (const mode of THEME_MODES) {
    updateState(appThemes[mode], mode, updatedState);
  }
  return { ...state, ...updatedState };
}

export function GroupingSettings() {
  const theme = useShallowThemeStore((state) => state.theme);
  const [themesState, dispatch] = useStateReducer<GroupingSettingsState>(
    { themeMode: theme },
    initializer,
  );

  const saveThemeSettings = useTableChartThemesStore((s) => s.saveThemeSettings);

  useEffect(() => {
    const unsub = useTableChartThemesStore.subscribe(
      (state) => ({ light: state.light?.appTheme, dark: state.dark?.appTheme }),
      (current) => {
        const updatedState = {} as Partial<GroupingSettingsState>;
        for (const mode of THEME_MODES) {
          updateState(current[mode], mode, updatedState);
        }

        if (Object.keys(updatedState).length > 0) {
          dispatch(cloneDeep(updatedState));
        }
      },
    );

    return () => unsub();
  }, []);

  const state = themesState[themesState.themeMode];

  const handleColorChange = useCallback(
    (index: number) => (color: string) => {
      dispatch((prev) => {
        const newPalette = [...prev[prev.themeMode].palette];
        newPalette[index] = color;
        return {
          ...prev,
          [prev.themeMode]: {
            palette: newPalette,
            isReset: false,
          },
        };
      });
    },
    [],
  );

  const handleAddColor = useCallback(() => {
    dispatch((prev) => {
      const newPalette = [...prev[prev.themeMode].palette, "#000000"];
      return {
        ...prev,
        [prev.themeMode]: {
          palette: newPalette,
          isReset: false,
        },
      };
    });
  }, []);

  const handleRemoveColor = useCallback(
    (index: number) => {
      if (state.palette.length <= MIN_COLORS) {
        toast.error(`Minimum ${MIN_COLORS} colors required`);
        return;
      }
      dispatch((prev) => {
        const newPalette = prev[prev.themeMode].palette.filter((_, i) => i !== index);
        return {
          ...prev,
          [prev.themeMode]: {
            palette: newPalette,
            isReset: false,
          },
        };
      });
    },
    [state.palette.length],
  );

  const handleSave = useCallback(async () => {
    let hasChanges = false;
    const updatedState = {} as EntityThemeSettings;

    for await (const mode of THEME_MODES) {
      const { isReset, palette } = themesState[mode];

      if (palette.length < MIN_COLORS) {
        toast.error(`Minimum ${MIN_COLORS} colors required`);
        return;
      }

      if (!isReset && isEqual(themesState[mode], STATE_DEFAULT[mode])) {
        console.log(`No changes detected for ${mode} theme, skipping save.`);
        continue;
      }

      hasChanges = true;
      updatedState[mode] = {
        appTheme: isReset ? null : { grouping: { palette } },
      };
    }

    if (hasChanges) return await saveThemeSettings(updatedState);

    toast.info("No changes detected in theme settings.");
  }, [themesState, saveThemeSettings]);

  const handleReset = useCallback(
    () =>
      dispatch((s) => ({
        ...s,
        [s.themeMode]: {
          ...STATE_DEFAULT[s.themeMode],
          isReset: true,
        },
      })),
    [],
  );

  const controls = (
    <div className="flex flex-col gap-6">
      <SettingsMenu title="Grouping Colors" canCollapse={false}>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-light-500 dark:text-dark-300">
            Define the color palette used for widget grouping. Minimum {MIN_COLORS}{" "}
            colors required.
          </p>
          <div className="flex flex-col gap-2">
            {state.palette.map((color, index) => (
              <div
                key={index}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
              >
                <Label className="justify-self-start text-xs w-16">
                  Color {index + 1}:
                </Label>
                <ColorPicker
                  value={color}
                  onChange={handleColorChange(index)}
                  className="w-full"
                  clearable={false}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveColor(index)}
                  disabled={state.palette.length <= MIN_COLORS}
                  className={cn(
                    "p-1.5 rounded hover:bg-light-200 dark:hover:bg-dark-700 transition-colors",
                    {
                      "opacity-50 cursor-not-allowed":
                        state.palette.length <= MIN_COLORS,
                    },
                  )}
                  title={
                    state.palette.length <= MIN_COLORS
                      ? `Minimum ${MIN_COLORS} colors required`
                      : "Remove color"
                  }
                >
                  <Icon id="trash-icon" className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            onClick={handleAddColor}
            variant="secondary"
            size="sm"
            className="w-fit mt-2"
          >
            <Icon id="plus-icon" className="w-4 h-4 mr-1" />
            Add Color
          </Button>
        </div>
      </SettingsMenu>
    </div>
  );

  const preview = (
    <GroupingPreview palette={state.palette} themeMode={themesState.themeMode} />
  );

  return (
    <ThemeSettingsLayout
      onSave={handleSave}
      onReset={handleReset}
      preview={preview}
      selectedThemeMode={themesState.themeMode}
      onThemeModeChange={(themeMode) => dispatch({ themeMode })}
    >
      {controls}
    </ThemeSettingsLayout>
  );
}

// Preview component showing mock groups. The background must reflect the
// locally-selected theme mode (not the global app theme), so colors are driven
// off `themeMode` with primitive classes rather than `dark:` variants.
function GroupingPreview({
  palette,
  themeMode,
}: {
  palette: string[];
  themeMode?: "light" | "dark";
}) {
  const isDark = themeMode === "dark";

  const mockGroups = useMemo(() => {
    return palette.slice(0, Math.min(palette.length, 6)).map((color, index) => ({
      id: `group-${index}`,
      name: `Group ${index + 1}`,
      color,
    }));
  }, [palette]);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-6 rounded flex-1 min-h-0",
        isDark ? "bg-base-100" : "bg-light-50",
      )}
    >
      <div className="flex flex-col gap-2">
        <h3
          className={cn(
            "text-sm font-medium",
            isDark ? "text-light-100" : "text-light-850",
          )}
        >
          Grouping Color Preview
        </h3>
        <p className={cn("text-xs", isDark ? "text-dark-50" : "text-light-600")}>
          Preview of how colors will appear in widget groups
        </p>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
        {mockGroups.map((group, _index) => (
          <div
            key={group.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded border",
              isDark ? "bg-dark-900 border-dark-800" : "bg-white border-light-200",
            )}
          >
            <div
              className="w-1 h-10 rounded-sm"
              style={{ backgroundColor: group.color }}
            />
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-light-100" : "text-light-850",
                )}
              >
                {group.name}
              </span>
              <span
                className={cn(
                  "text-xs font-mono",
                  isDark ? "text-dark-300" : "text-light-500",
                )}
              >
                {group.color}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: group.color,
                  color: isLight(group.color) ? "#1a1a1f" : "#ffffff",
                }}
              >
                {group.name.split(" ")[1]?.charAt(0) || "G"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {palette.length > 6 && (
        <p
          className={cn("text-xs italic", isDark ? "text-dark-300" : "text-light-500")}
        >
          + {palette.length - 6} more color{palette.length - 6 !== 1 ? "s" : ""} in
          palette
        </p>
      )}
    </div>
  );
}

// Helper to determine if color is light
function isLight(color: string): boolean {
  const hex = color.replace("#", "");
  const r = Number.parseInt(hex.substr(0, 2), 16);
  const g = Number.parseInt(hex.substr(2, 2), 16);
  const b = Number.parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}
