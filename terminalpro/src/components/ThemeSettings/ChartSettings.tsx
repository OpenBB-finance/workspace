import type {
  AgChartOptions,
  AgChartTheme,
  AgChartThemeName,
} from "ag-charts-enterprise";
import { AgCharts } from "ag-charts-react";
import cloneDeep from "lodash/cloneDeep";
import get from "lodash/get";
import isEqual from "lodash.isequal";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { Button } from "~/components/ds/atoms/Button";
import { FontFamilyInput } from "~/components/ds/atoms/FontFamilyInput";
import { Input } from "~/components/ds/atoms/Input";
import { Label } from "~/components/ds/atoms/Label";
import { Select } from "~/components/ds/atoms/Select";
import { Switch } from "~/components/ds/atoms/Switch";
import { ColorPicker } from "~/components/ds/molecules/ColorPicker";
import { cn } from "~/components/ds/utils";
import Tooltip from "~/components/Tooltip";
import { type DispatchAction, useStateReducer } from "~/hooks/useStateReducer";
import {
  type ChartThemePalette,
  type ChartThemeParams,
  type EntityThemeSettings,
  type ThemeSettings,
  useTableChartThemesStore,
} from "~/lib/state/tableChartThemes";
import { useShallowThemeStore } from "~/lib/state/theme";
import SettingsMenu from "../ds/molecules/SettingsMenu";
import Icon from "../Icon";
import { THEME_MODES, ThemeSettingsLayout } from "./ThemeSettingsLayout";

function getData(totalFills: number) {
  // Always show all 4 dolphins for variety
  const data = [
    {
      dolphin: "Peter",
      interactionDurationTM: 120,
      interactionDurationYM: 86,
      numberOfLooksTM: 60,
      numberOfLooksYM: 64,
    },
    {
      dolphin: "Mary",
      interactionDurationTM: 135,
      interactionDurationYM: 259,
      numberOfLooksTM: 57,
      numberOfLooksYM: 93,
    },
    {
      dolphin: "Mercutio",
      interactionDurationTM: 140,
      interactionDurationYM: 145,
      numberOfLooksTM: 238,
      numberOfLooksYM: 217,
    },
    {
      dolphin: "Ada",
      interactionDurationTM: 110,
      interactionDurationYM: 147,
      numberOfLooksTM: 237,
      numberOfLooksYM: 217,
    },
  ];

  // Create series to match the exact number of fill colors
  const baseSeries = [
    {
      type: "bar" as const,
      xKey: "dolphin",
      yKey: "numberOfLooksTM",
      yName: "Number of Looks (TM)",
      strokeWidth: 2,
    },
    {
      type: "bar" as const,
      xKey: "dolphin",
      yKey: "numberOfLooksYM",
      yName: "Number of Looks (YM)",
      strokeWidth: 2,
    },
    {
      type: "bar" as const,
      xKey: "dolphin",
      yKey: "interactionDurationTM",
      yName: "Interaction Duration (TM)",
      strokeWidth: 2,
    },
    {
      type: "bar" as const,
      xKey: "dolphin",
      yKey: "interactionDurationYM",
      yName: "Interaction Duration (YM)",
      strokeWidth: 2,
    },
  ];

  const series = baseSeries.slice(0, Math.min(totalFills, 4));

  // Add extra series if we need more than 4
  const neededSeries = totalFills - 4;
  if (neededSeries > 0) {
    for (let i = 1; i <= neededSeries; i++) {
      // Add data for each dolphin for this series
      for (const [idx, d] of data.entries()) {
        const isOdd = (idx + i) % 2 === 1;
        d[`series${i}`] = isOdd ? 30 + i * 10 : 50 + i * 10;
      }

      series.push({
        type: "bar",
        xKey: "dolphin",
        yKey: `series${i}`,
        yName: `Series ${i + 4}`,
        strokeWidth: 2,
      });
    }
  }

  return { data, series };
}

function getImageURL() {
  return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIHdpZHRoPSI2NCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDY0IDQ4IiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjI7Ij4KICA8c3R5bGU+CiAgICAuYXF1YSB7CiAgICAgIGZpbGw6ICM1NWI0Yzg7CiAgICB9CgogICAgLm9yYW5nZSB7CiAgICAgIGZpbGw6ICNmZjhjMDA7CiAgICB9CgogICAgLnJlZCB7CiAgICAgIGZpbGw6ICNmMDA7CiAgICB9CgogICAgLmdyZXkgewogICAgICBmaWxsOiAjYjRiZWJlOwogICAgfQogIDwvc3R5bGU+CiAgCiAgPHJlY3QgY2xhc3M9ImFxdWEgcmlnaHQtMSIgeD0iNTEiIHk9IjEwIiB3aWR0aD0iNyIgaGVpZ2h0PSI4Ii8+CiAgPHBhdGggY2xhc3M9ImFxdWEgcmlnaHQtMSIgZD0iTTU4LDEwbC0xNywwbC04LDhsMjUsMGwwLC04WiIvPgogIDxyZWN0IGNsYXNzPSJvcmFuZ2UgcmlnaHQtMiIgeD0iMzYiIHk9IjIyIiB3aWR0aD0iNyIgaGVpZ2h0PSI4Ii8+CiAgPHBhdGggY2xhc3M9Im9yYW5nZSByaWdodC0yIiBkPSJNNDMsMzBsMCwtNy45OTVsLTE0LC0wbC04LjAwOCw3Ljk5NWwyMi4wMDgsMFoiLz4KICA8cmVjdCBjbGFzcz0icmVkIHJpZ2h0LTMiIHg9IjI0IiB5PSIzNCIgd2lkdGg9IjciIGhlaWdodD0iOCIvPgogIDxwYXRoIGNsYXNzPSJyZWQgcmlnaHQtMyIgZD0iTTEzLDM4LjAxbDQsLTQuMDFsMTQsMGwwLDhsLTE4LDBsMCwtMy45OVoiLz4KCiAgPHJlY3QgY2xhc3M9ImdyZXkgbGVmdC0xIiB4PSIxMSIgeT0iNiIgd2lkdGg9IjciIGhlaWdodD0iOCIvPgogIDxwYXRoIGNsYXNzPSJncmV5IGxlZnQtMSIgZD0iTTQxLDEwbC00LDRsLTI2LDBsMCwtOGwzMCwwbDAsNFoiLz4KICA8cmVjdCBjbGFzcz0iZ3JleSBsZWZ0LTIiIHg9IjE2IiB5PSIxOCIgd2lkdGg9IjciIGhlaWdodD0iOCIvPgogIDxwYXRoIGNsYXNzPSJncmV5IGxlZnQtMiIgZD0iTTE2LDI2bDksMGw4LC04bC0xNywtMGwwLDhaIi8+CiAgPHJlY3QgY2xhc3M9ImdyZXkgbGVmdC0zIiB4PSI2IiB5PSIzMCIgd2lkdGg9IjciIGhlaWdodD0iOCIvPgogIDxwYXRoIGNsYXNzPSJncmV5IGxlZnQtMyIgZD0iTTYsMzcuOTg4bDcsMC4wMTJsNy45OTIsLThsLTE0Ljk5MiwtMC4wNDdsLTAsOC4wMzVaIi8+Cgo8L3N2Zz4=";
}

interface ChartThemeState {
  selectedBaseTheme: AgChartThemeName;
  fills: string[];
  strokes: string[];
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | null;
  foregroundColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  borderColor?: string;
  textColor?: string;
  subtleTextColor?: string;
  padding?: number;
  chromeBackgroundColor?: string;
  chromeTextColor?: string;
  chromeFontFamily?: string;
  chromeFontSize?: number;
  chromeFontWeight?: string | null;
  chromeSubtleTextColor?: string;
  inputBackgroundColor?: string;
  inputTextColor?: string;
  gridLineColor?: string;
  axisColor?: string;
  crosshairLabelBackgroundColor?: string;
  crosshairLabelTextColor?: string;
  backgroundImage: ThemeSettings["chartTheme"]["backgroundImage"];

  isReset?: boolean;
}

const DEFAULT_DARK_FILLS = [
  "#5090dc",
  "#ffa03a",
  "#459d55",
  "#34bfe1",
  "#e1cc00",
  "#9669cb",
  "#b5b5b5",
  "#bd5aa7",
  "#8a6224",
  "#ef5452",
];

const DEFAULT_DARK_STROKES = [
  "#74a8e6",
  "#ffbe70",
  "#6cb176",
  "#75d4ef",
  "#f6e559",
  "#aa86d8",
  "#a1a1a1",
  "#ce7ab9",
  "#997b52",
  "#ff7872",
];

const DEFAULT_LIGHT_FILLS = [
  "#5BC0EB",
  "#FDE74C",
  "#9BC53D",
  "#E55934",
  "#FA7921",
  "#C45AB3",
  "#8B7355",
  "#E67E22",
  "#3498DB",
  "#E74C3C",
];

const DEFAULT_LIGHT_STROKES = [
  "#4A90A4",
  "#D4BE41",
  "#7F9B32",
  "#C84A2A",
  "#D4621B",
  "#A84A94",
  "#6D5A44",
  "#C86A1C",
  "#2980B9",
  "#C0392B",
];

const DEFAULT_CHART_THEME: ChartThemeState = {
  selectedBaseTheme: "ag-default",
  fills: DEFAULT_LIGHT_FILLS,
  strokes: DEFAULT_LIGHT_STROKES,
  fontFamily: "",
  fontSize: 12,
  fontWeight: null,
  foregroundColor: "",
  backgroundColor: "",
  accentColor: "",
  borderColor: "",
  textColor: "",
  subtleTextColor: "",
  padding: undefined,
  chromeBackgroundColor: "",
  chromeTextColor: "",
  chromeFontFamily: "",
  chromeFontSize: undefined,
  chromeFontWeight: null,
  chromeSubtleTextColor: "",
  inputBackgroundColor: "",
  inputTextColor: "",
  gridLineColor: "",
  axisColor: "",
  crosshairLabelBackgroundColor: "",
  crosshairLabelTextColor: "",
  backgroundImage: {
    enabled: false,
    url: "",
    width: 50,
    height: 50,
    left: undefined,
    top: undefined,
    right: 10,
    bottom: 10,
    opacity: 1,
  },
};

type BackgroundImageT = ChartThemeState["backgroundImage"];

type BackgroundImagePosition = "nw" | "ne" | "sw" | "se" | "center";

const BACKGROUND_IMAGE_POSITION_PADDING = 10;

function getBackgroundImagePosition(
  bgImage: BackgroundImageT,
): BackgroundImagePosition {
  const { left, top, right, bottom } = bgImage;
  if (left !== undefined && top !== undefined) return "nw";
  if (right !== undefined && top !== undefined) return "ne";
  if (left !== undefined && bottom !== undefined) return "sw";
  if (right !== undefined && bottom !== undefined) return "se";
  return "center";
}

function TooltipLabel({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip message={tooltip} className="max-w-[300px]">
      <Label className="cursor-help">{children}</Label>
    </Tooltip>
  );
}

type ChartSettingsState = {
  light?: ChartThemeState;
  dark?: ChartThemeState;
  themeMode?: "light" | "dark";
};

function getThemeDefaults(mode: "light" | "dark"): ChartThemeState {
  return {
    ...DEFAULT_CHART_THEME,
    selectedBaseTheme: mode === "dark" ? "ag-default-dark" : "ag-default",
    fills: mode === "dark" ? DEFAULT_DARK_FILLS : DEFAULT_LIGHT_FILLS,
    strokes: mode === "dark" ? DEFAULT_DARK_STROKES : DEFAULT_LIGHT_STROKES,
    backgroundColor: mode === "dark" ? "#151518" : "#FFFFFF",
  };
}

const STATE_DEFAULT: ChartSettingsState = {
  light: getThemeDefaults("light"),
  dark: getThemeDefaults("dark"),
};

function updateState(
  currentTheme: ThemeSettings["chartTheme"],
  mode: "light" | "dark",
  updatedState: Partial<ChartSettingsState>,
) {
  if (currentTheme) {
    const themeDefaults = getThemeDefaults(mode);
    const { baseTheme, palette, params, backgroundImage } = currentTheme;

    const fills = palette.fills || themeDefaults.fills;
    let strokes = palette.strokes || themeDefaults.strokes;

    // Ensure fills and strokes arrays have the same length
    if (strokes.length !== fills.length) {
      const defaultStroke = mode === "dark" ? "#74a8e6" : "#4A90A4";
      strokes =
        strokes.length < fills.length
          ? [...strokes, ...Array(fills.length - strokes.length).fill(defaultStroke)]
          : strokes.slice(0, fills.length);
    }

    updatedState[mode] = {
      ...themeDefaults,
      selectedBaseTheme: baseTheme,
      fills,
      strokes,
      backgroundImage: backgroundImage || themeDefaults.backgroundImage,
      ...params,
      isReset: false,
    };
  } else {
    updatedState[mode] = { ...getThemeDefaults(mode), isReset: true };
  }
}

function initializer(state: ChartSettingsState): ChartSettingsState {
  const { light, dark } = useTableChartThemesStore.getState();
  const chartThemes = { light: light?.chartTheme, dark: dark?.chartTheme };
  const updatedState = {} as Partial<ChartSettingsState>;
  for (const mode of THEME_MODES) {
    updateState(chartThemes[mode], mode, updatedState);
  }
  return { ...state, ...updatedState };
}

export function ChartSettings() {
  const theme = useShallowThemeStore((state) => state.theme);
  const [themesState, dispatch] = useStateReducer<ChartSettingsState>(
    { themeMode: theme },
    initializer,
  );

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const saveThemeSettings = useTableChartThemesStore((s) => s.saveThemeSettings);

  useEffect(() => {
    const unsub = useTableChartThemesStore.subscribe(
      (state) => ({ light: state.light?.chartTheme, dark: state.dark?.chartTheme }),
      (current) => {
        const updatedState = {} as Partial<ChartSettingsState>;

        for (const mode of THEME_MODES) {
          const currentTheme = current[mode];

          updateState(currentTheme, mode, updatedState);

          for (const field in inputRefs.current || {}) {
            const value = get(updatedState[mode], field) || "";

            inputRefs.current[field]!.value = value.toString();
          }
        }

        if (Object.keys(updatedState).length > 0) {
          dispatch(cloneDeep(updatedState));
        }
      },
    );

    return () => unsub();
  }, [inputRefs]);

  const handleInputChange = useCallback(
    (
      key: keyof ChartThemeState | `backgroundImage.${keyof BackgroundImageT}`,
      asString = true,
    ) =>
      (v: string) => {
        if (key === "fills" || key === "strokes") {
          return;
        }

        let value: string | number | null = v;
        if (!asString && key !== "selectedBaseTheme") {
          const numValue = Number.parseFloat(v);
          value = Number.isNaN(numValue)
            ? (DEFAULT_CHART_THEME[key] as number) || 0
            : numValue;
        }

        if ((key === "fontWeight" || key === "chromeFontWeight") && v === "") {
          value = null;
        }
        const [_, bgImageKey] = key.split(".");

        const changes: DispatchAction<ChartSettingsState> = (prev) => {
          const newState = cloneDeep(prev[prev.themeMode]);
          if (bgImageKey) {
            newState.backgroundImage[bgImageKey] = value;
          } else {
            newState[key] = value;
          }
          newState.isReset = false;
          return {
            ...prev,
            [prev.themeMode]: newState,
          };
        };

        if (inputRefs.current[key] && key !== "selectedBaseTheme") {
          inputRefs.current[key]!.value = v ?? "";
        }

        dispatch(changes);
      },
    [],
  );

  const handleColorArrayChange = useCallback(
    (key: "fills" | "strokes", index: number) => (color: string) =>
      dispatch((prev) => {
        const newState = cloneDeep(prev[prev.themeMode]);
        newState[key][index] = color;
        newState.isReset = false;
        return {
          ...prev,
          [prev.themeMode]: newState,
        };
      }),

    [],
  );

  const addColor = useCallback((key: "fills" | "strokes") => {
    dispatch((prev) => {
      const newState = cloneDeep(prev[prev.themeMode]);

      if (key === "fills") {
        // Pick random colors from the default palette based on theme mode
        const defaultFills =
          prev.themeMode === "dark" ? DEFAULT_DARK_FILLS : DEFAULT_LIGHT_FILLS;
        const defaultStrokes =
          prev.themeMode === "dark" ? DEFAULT_DARK_STROKES : DEFAULT_LIGHT_STROKES;

        const randomIndex = Math.floor(Math.random() * defaultFills.length);
        const newFillColor = defaultFills[randomIndex];
        const newStrokeColor = defaultStrokes[randomIndex];

        // When adding a fill, also add a corresponding stroke
        newState.fills = [...newState.fills, newFillColor];
        newState.strokes = [...newState.strokes, newStrokeColor];
      } else {
        // Adding stroke only (shouldn't normally happen, but keep for safety)
        const defaultStrokes =
          prev.themeMode === "dark" ? DEFAULT_DARK_STROKES : DEFAULT_LIGHT_STROKES;
        const randomIndex = Math.floor(Math.random() * defaultStrokes.length);
        newState.strokes = [...newState.strokes, defaultStrokes[randomIndex]];
      }

      newState.isReset = false;
      return {
        ...prev,
        [prev.themeMode]: newState,
      };
    });
  }, []);

  const removeColor = useCallback((key: "fills" | "strokes", index: number) => {
    dispatch((prev) => {
      const newState = cloneDeep(prev[prev.themeMode]);

      if (key === "fills") {
        // When removing a fill, also remove the corresponding stroke
        newState.fills = newState.fills.filter((_, i) => i !== index);
        newState.strokes = newState.strokes.filter((_, i) => i !== index);
      } else {
        // Removing stroke only
        newState.strokes = newState.strokes.filter((_, i) => i !== index);
      }

      newState.isReset = false;
      return {
        ...prev,
        [prev.themeMode]: newState,
      };
    });
  }, []);

  const handleBgImagePositionChange = useCallback(
    (position: BackgroundImagePosition) => {
      dispatch((prev) => {
        const newState = cloneDeep(prev[prev.themeMode]);
        newState.backgroundImage.left = undefined;
        newState.backgroundImage.top = undefined;
        newState.backgroundImage.right = undefined;
        newState.backgroundImage.bottom = undefined;

        if (position === "nw") {
          newState.backgroundImage.left = BACKGROUND_IMAGE_POSITION_PADDING;
          newState.backgroundImage.top = BACKGROUND_IMAGE_POSITION_PADDING;
        } else if (position === "ne") {
          newState.backgroundImage.right = BACKGROUND_IMAGE_POSITION_PADDING;
          newState.backgroundImage.top = BACKGROUND_IMAGE_POSITION_PADDING;
        } else if (position === "sw") {
          newState.backgroundImage.left = BACKGROUND_IMAGE_POSITION_PADDING;
          newState.backgroundImage.bottom = BACKGROUND_IMAGE_POSITION_PADDING;
        } else if (position === "se") {
          newState.backgroundImage.right = BACKGROUND_IMAGE_POSITION_PADDING;
          newState.backgroundImage.bottom = BACKGROUND_IMAGE_POSITION_PADDING;
        }

        newState.isReset = false;
        return {
          ...prev,
          [prev.themeMode]: newState,
        };
      });
    },
    [],
  );

  const state = themesState[themesState.themeMode];
  const bgImagePosition = getBackgroundImagePosition(state.backgroundImage);

  const handleSave = useCallback(async () => {
    let hasChanges = false;
    const updatedState = {} as EntityThemeSettings;

    for await (const mode of THEME_MODES) {
      const { isReset, ...agTheme } = themesState[mode];
      const {
        selectedBaseTheme: baseTheme,
        fills: paletteF,
        strokes: paletteS,
        backgroundImage,
        ...chartParams
      } = agTheme;

      const palette: ChartThemePalette = { fills: paletteF, strokes: paletteS };
      const filteredParams = Object.fromEntries(
        Object.entries(chartParams).filter(
          ([, value]) => ![undefined, null, ""].some((v) => v === value),
        ),
      ) as ChartThemeParams;

      const chartTheme: ThemeSettings["chartTheme"] = {
        baseTheme: baseTheme,
        palette,
        params: filteredParams,
      };

      if (backgroundImage.enabled && backgroundImage.url) {
        chartTheme.backgroundImage = backgroundImage;
      }

      if (!isReset && isEqual(agTheme, STATE_DEFAULT[mode])) {
        console.log(`No changes detected for ${mode} theme, skipping save.`);
        continue;
      }
      hasChanges = true;
      updatedState[mode] = { chartTheme: isReset ? null : chartTheme };
    }

    if (hasChanges) return await saveThemeSettings(updatedState);

    toast.info("No changes detected in theme settings.");
  }, [themesState, saveThemeSettings]);

  const handleReset = useCallback(
    () =>
      dispatch((s) => ({
        ...s,
        [s.themeMode]: {
          ...getThemeDefaults(s.themeMode),
          isReset: true,
        },
      })),
    [],
  );

  const chartOptions = useMemo((): AgChartOptions => {
    const { selectedBaseTheme, fills, strokes, backgroundImage, isReset, ...params } =
      state;

    const customTheme: AgChartTheme = {
      baseTheme: selectedBaseTheme,
      palette: { fills, strokes },
      params: Object.fromEntries(
        Object.entries(params).filter(
          ([, value]) => ![undefined, null, ""].some((v) => v === value),
        ),
      ),
    };

    const { series, data } = getData(fills?.length);

    const options: AgChartOptions = {
      theme: customTheme,
      data,
      series,
      axes: [
        {
          type: "category",
          position: "bottom",
        },
        {
          type: "number",
          position: "left",
        },
      ],
      title: {
        text: "Dolphin Interaction Data",
      },
      legend: {
        position: "bottom",
      },
    };

    if (backgroundImage.enabled && backgroundImage.url) {
      const imageConfig: any = { ...backgroundImage };

      options.background = {
        image: imageConfig,
      };
    } else {
      options.background = undefined;
    }

    if (
      themesState.themeMode === "dark" &&
      !(options.background || customTheme.params.backgroundColor)
    ) {
      options.background = { visible: false };
    }

    return options;
  }, [state, themesState.themeMode]);

  const [debouncedChartOptions] = useDebounceValue(chartOptions, 300);

  const controls = (
    <div className="flex flex-col gap-6">
      <SettingsMenu
        title="Palette"
        tooltip="Palette settings define the color scheme used for chart data visualization - fill colors for chart elements and stroke colors for outlines and borders."
        canCollapse={true}
      >
        <div className="w-full flex flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
            <div className="flex-1">
              <TooltipLabel tooltip="Colors used to fill chart elements like bars, areas, and pie slices">
                Fill Color
              </TooltipLabel>
            </div>
            <div className="flex-1">
              <TooltipLabel tooltip="Colors used for chart element outlines and borders">
                Stroke Color
              </TooltipLabel>
            </div>
            <Button
              size="xs"
              variant="outlined"
              className="h-[30px]"
              onClick={() => addColor("fills")}
            >
              <Icon id="plus" className="size-3.5" />
            </Button>
          </div>
          {state.fills.map((color, index) => (
            <div key={index} className="flex flex-row items-center gap-2">
              <ColorPicker
                value={color}
                onChange={handleColorArrayChange("fills", index)}
                className="flex-1"
                clearable={false}
              />
              <ColorPicker
                value={state.strokes[index]}
                onChange={handleColorArrayChange("strokes", index)}
                className="flex-1"
                clearable={false}
              />
              {state.fills.length > 1 && (
                <Button
                  size="xs"
                  variant="outlined"
                  className="h-[30px]"
                  onClick={() => removeColor("fills", index)}
                >
                  <Icon id="trash-04" className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingsMenu>

      <SettingsMenu
        tooltip="Core settings control the actual chart visualization - data elements like bars/lines, chart background, axes, grid lines, and main chart text/labels."
        title="Core Settings"
        canCollapse={true}
      >
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <TooltipLabel tooltip="Font family used for all text in the chart">
            Font Family:
          </TooltipLabel>
          <FontFamilyInput
            className="w-full"
            value={state.fontFamily}
            onChange={handleInputChange("fontFamily")}
            placeholder="Select font family..."
          />

          <TooltipLabel tooltip="Default font size used for all text. Titles and some other text are scaled to this font size">
            Font Size:
          </TooltipLabel>
          <Input
            ref={(el) => (inputRefs.current.fontSize = el)}
            type="number"
            className="w-full"
            defaultValue={state.fontSize || "12"}
            onChange={handleInputChange("fontSize", false)}
          />

          <TooltipLabel tooltip="Default font weight used for all text">
            Font Weight:
          </TooltipLabel>
          <Select
            className="w-full"
            value={state.fontWeight || "default"}
            onValueChange={(v) =>
              handleInputChange("fontWeight")(v === "default" ? "" : v)
            }
            options={[
              { label: "Default", value: "default" },
              { label: "Normal", value: "normal" },
              { label: "Bold", value: "bold" },
              { label: "100", value: "100" },
              { label: "200", value: "200" },
              { label: "300", value: "300" },
              { label: "400", value: "400" },
              { label: "500", value: "500" },
              { label: "600", value: "600" },
              { label: "700", value: "700" },
              { label: "800", value: "800" },
              { label: "900", value: "900" },
            ]}
          />

          <TooltipLabel tooltip="Background colour of the chart. Most text, borders and backgrounds are defined as a blend between the background and foreground colors">
            Background Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.backgroundColor ||
              (themesState.themeMode === "dark" ? "#1a1a1f" : "#ffffff")
            }
            onChange={handleInputChange("backgroundColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Default colour for neutral UI elements. Most text, borders and backgrounds are defined as a blend between the background and foreground colors">
            Foreground Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.foregroundColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("foregroundColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="The 'brand colour' for the chart, used wherever a non-neutral colour is required. Selections, focus outlines and checkboxes use the accent colour by default">
            Accent Color:
          </TooltipLabel>
          <ColorPicker
            value={state.accentColor || "#337dba"}
            onChange={handleInputChange("accentColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Default colour for borders">
            Border Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.borderColor ||
              (themesState.themeMode === "dark" ? "#444444" : "#dddddd")
            }
            onChange={handleInputChange("borderColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Default colour for text in the chart">
            Text Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.textColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("textColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Colour of text that should stand out less than the default">
            Subtle Text Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.subtleTextColor ||
              (themesState.themeMode === "dark" ? "#888888" : "#666666")
            }
            onChange={handleInputChange("subtleTextColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="The outer chart padding in pixels">
            Padding:
          </TooltipLabel>
          <Input
            ref={(el) => (inputRefs.current.padding = el)}
            type="number"
            className="w-full"
            defaultValue={state.padding || ""}
            onChange={handleInputChange("padding", false)}
            placeholder="Default padding"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu
        title="Chrome Settings"
        canCollapse={true}
        tooltip="Chrome settings control interactive UI elements that overlay the chart - tooltips, menus, dialogs, toolbars, buttons, and text inputs. These often need different styling for better visibility and accessibility."
      >
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <TooltipLabel tooltip="Background colour of tooltips, menus, dialogs, toolbars and buttons">
            Chrome Background:
          </TooltipLabel>
          <ColorPicker
            value={
              state.chromeBackgroundColor ||
              (themesState.themeMode === "dark" ? "#2a2a31" : "#f6f6f6")
            }
            onChange={handleInputChange("chromeBackgroundColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Default colour for text in tooltips, menus, dialogs, toolbars, buttons and text inputs">
            Chrome Text Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.chromeTextColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("chromeTextColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Font family used for text in tooltips, menus, dialogs, toolbars, buttons and text inputs">
            Chrome Font Family:
          </TooltipLabel>
          <FontFamilyInput
            className="w-full"
            value={state.chromeFontFamily}
            onChange={handleInputChange("chromeFontFamily")}
            placeholder="Defaults to font family..."
          />

          <TooltipLabel tooltip="Font size used for text in tooltips, menus, dialogs, toolbars, buttons and text inputs">
            Chrome Font Size:
          </TooltipLabel>
          <Input
            ref={(el) => (inputRefs.current.chromeFontSize = el)}
            type="number"
            className="w-full"
            defaultValue={state.chromeFontSize || ""}
            onChange={handleInputChange("chromeFontSize", false)}
            placeholder="Defaults to font size"
          />

          <TooltipLabel tooltip="Font weight used for text in tooltips, menus, dialogs, toolbars, buttons and text inputs">
            Chrome Font Weight:
          </TooltipLabel>
          <Select
            className="w-full"
            value={state.chromeFontWeight || "default"}
            onValueChange={(v) =>
              handleInputChange("chromeFontWeight")(v === "default" ? "" : v)
            }
            options={[
              { label: "Default", value: "default" },
              { label: "Normal", value: "normal" },
              { label: "Bold", value: "bold" },
              { label: "100", value: "100" },
              { label: "200", value: "200" },
              { label: "300", value: "300" },
              { label: "400", value: "400" },
              { label: "500", value: "500" },
              { label: "600", value: "600" },
              { label: "700", value: "700" },
              { label: "800", value: "800" },
              { label: "900", value: "900" },
            ]}
          />

          <TooltipLabel tooltip="Colour of text that should stand out less than the default in tooltips, menus, dialogs, toolbars and buttons">
            Chrome Subtle Text:
          </TooltipLabel>
          <ColorPicker
            value={
              state.chromeSubtleTextColor ||
              (themesState.themeMode === "dark" ? "#888888" : "#666666")
            }
            onChange={handleInputChange("chromeSubtleTextColor")}
            className="w-full"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu
        title="Input Settings"
        canCollapse={true}
        tooltip="Input settings specifically control the appearance of text input fields within chart UI elements like search boxes and filter inputs."
      >
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <TooltipLabel tooltip="Background colour for text inputs">
            Input Background:
          </TooltipLabel>
          <ColorPicker
            value={
              state.inputBackgroundColor ||
              (themesState.themeMode === "dark" ? "#1a1a1f" : "#ffffff")
            }
            onChange={handleInputChange("inputBackgroundColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Colour of text within text inputs">
            Input Text Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.inputTextColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("inputTextColor")}
            className="w-full"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu
        title="Grid & Axis Settings"
        canCollapse={true}
        tooltip="Grid & Axis settings control the visual appearance of chart grid lines and axis elements - the structural framework that helps users read chart values."
      >
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <TooltipLabel tooltip="Default colour for grid lines">
            Grid Line Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.gridLineColor ||
              (themesState.themeMode === "dark" ? "#444444" : "#dddddd")
            }
            onChange={handleInputChange("gridLineColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Default colour for axis lines and ticks">
            Axis Color:
          </TooltipLabel>
          <ColorPicker
            value={
              state.axisColor ||
              (themesState.themeMode === "dark" ? "#666666" : "#333333")
            }
            onChange={handleInputChange("axisColor")}
            className="w-full"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu
        title="Crosshair Settings"
        canCollapse={true}
        tooltip="Crosshair settings control the appearance of crosshair labels that appear when hovering over chart data points to show precise values."
      >
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <TooltipLabel tooltip="Background colour of crosshair labels">
            Crosshair Label Background:
          </TooltipLabel>
          <ColorPicker
            value={
              state.crosshairLabelBackgroundColor ||
              (themesState.themeMode === "dark" ? "#2a2a31" : "#f6f6f6")
            }
            onChange={handleInputChange("crosshairLabelBackgroundColor")}
            className="w-full"
          />

          <TooltipLabel tooltip="Colour for text in crosshair labels">
            Crosshair Label Text:
          </TooltipLabel>
          <ColorPicker
            value={
              state.crosshairLabelTextColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("crosshairLabelTextColor")}
            className="w-full"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu
        title="Background Image"
        canCollapse={true}
        tooltip="Background image settings allow you to add a company logo or watermark behind your chart visualization."
      >
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <Label
              className="font-medium cursor-help"
              title="Add a background image to your chart"
            >
              Enable company image
            </Label>
            <Switch
              checked={state.backgroundImage.enabled ?? false}
              onCheckedChange={(checked) => {
                dispatch((prev) => ({
                  ...prev,
                  [prev.themeMode]: {
                    ...prev[prev.themeMode],
                    backgroundImage: {
                      ...(prev[prev.themeMode].backgroundImage || {}),
                      enabled: checked,
                      ...(checked &&
                        !state.backgroundImage.url && { url: getImageURL() }),
                    },
                  },
                }));
              }}
            />
          </div>

          <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-3">
            <TooltipLabel tooltip="URL or base64 data URI for the background image">
              Image URL:
            </TooltipLabel>
            <Input
              ref={(el) => (inputRefs.current["backgroundImage.url"] = el)}
              type="text"
              defaultValue={state.backgroundImage.url}
              onChange={handleInputChange("backgroundImage.url")}
              placeholder="Enter image URL or base64 data"
              className="w-full"
            />

            <TooltipLabel tooltip="Transparency level of the background image (0 = transparent, 1 = opaque)">
              Opacity:
            </TooltipLabel>
            <Input
              ref={(el) => (inputRefs.current["backgroundImage.opacity"] = el)}
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full !pl-3"
              defaultValue={state.backgroundImage.opacity || "1"}
              onChange={handleInputChange("backgroundImage.opacity", false)}
            />

            <TooltipLabel tooltip="Width of the background image in pixels (leave empty for auto-sizing)">
              Width:
            </TooltipLabel>
            <Input
              ref={(el) => (inputRefs.current["backgroundImage.width"] = el)}
              type="number"
              className="w-full"
              defaultValue={state.backgroundImage.width || "50"}
              onChange={handleInputChange("backgroundImage.width", false)}
              placeholder="Auto if empty"
            />

            <TooltipLabel tooltip="Height of the background image in pixels (leave empty for auto-sizing)">
              Height:
            </TooltipLabel>
            <Input
              ref={(el) => (inputRefs.current["backgroundImage.height"] = el)}
              type="number"
              className="w-full"
              defaultValue={state.backgroundImage.height || "50"}
              onChange={handleInputChange("backgroundImage.height", false)}
              placeholder="Auto if empty"
            />

            <TooltipLabel tooltip="Snap the image to a corner or the center of the chart">
              Position:
            </TooltipLabel>
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-20 items-center justify-center rounded border border-general-border-primary bg-general-bg-primary">
                {(["nw", "ne", "sw", "se"] as const).map((corner) => {
                  const isActive = bgImagePosition === corner;
                  return (
                    <button
                      key={corner}
                      type="button"
                      style={{
                        top: corner[0] === "n" ? -8 : "auto",
                        bottom: corner[0] === "s" ? -8 : "auto",
                        left: corner[1] === "w" ? -8 : "auto",
                        right: corner[1] === "e" ? -8 : "auto",
                        position: "absolute",
                      }}
                      onClick={() => handleBgImagePositionChange(corner)}
                      aria-label={`Position ${corner}`}
                      aria-pressed={isActive}
                      className={cn(
                        "h-4 w-4 rounded border transition-colors",
                        isActive
                          ? "bg-brand-main border-brand-main"
                          : "bg-general-bg-primary border-general-border-primary hover:bg-general-bg-secondary",
                      )}
                    />
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleBgImagePositionChange("center")}
                  aria-label="Position center"
                  aria-pressed={bgImagePosition === "center"}
                  className={cn(
                    "h-4 w-4 rounded border transition-colors",
                    bgImagePosition === "center"
                      ? "bg-brand-main border-brand-main"
                      : "bg-general-bg-primary border-general-border-primary hover:bg-general-bg-secondary",
                  )}
                />
              </div>
              <span className="text-xs text-ds-text-caption">
                Click a corner or center to place the image
              </span>
            </div>
          </div>
        </div>
      </SettingsMenu>
    </div>
  );

  const preview = (
    <AgCharts options={debouncedChartOptions} className="w-full h-full" />
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
