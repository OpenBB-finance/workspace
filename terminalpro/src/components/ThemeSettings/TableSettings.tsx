import type { ColDef, Part, ThemeDefaultParams } from "ag-grid-community";
import {
  colorSchemeDark,
  colorSchemeLight,
  iconSetAlpine,
  iconSetMaterial,
  iconSetQuartz,
  ModuleRegistry,
  themeAlpine,
} from "ag-grid-community";
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { AgGridReact } from "ag-grid-react";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { FontFamilyInput } from "~/components/ds/atoms/FontFamilyInput";
import { Input } from "~/components/ds/atoms/Input";
import { Label } from "~/components/ds/atoms/Label";
import { Select } from "~/components/ds/atoms/Select";
import { SpacingInput } from "~/components/ds/atoms/SpacingInput";
import { ColorPicker } from "~/components/ds/molecules/ColorPicker";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  type EntityThemeSettings,
  type ThemeDefaultParamsT,
  type ThemeSettings,
  useTableChartThemesStore,
} from "~/lib/state/tableChartThemes";
import { useShallowThemeStore } from "~/lib/state/theme";
import SettingsMenu from "../ds/molecules/SettingsMenu";
import {
  customCssPart,
  getDefaultAgGridThemeParams,
} from "../General/Table/hooks/constants";
import { THEME_MODES, ThemeSettingsLayout } from "./ThemeSettingsLayout";

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface IconSetOption {
  id: "iconSetQuartz" | "iconSetAlpine" | "iconSetMaterial";
  label: string;
  themePart: Part<unknown>;
}

const iconSets: IconSetOption[] = [
  { id: "iconSetAlpine", label: "Alpine", themePart: iconSetAlpine },
  { id: "iconSetQuartz", label: "Quartz", themePart: iconSetQuartz() },
  { id: "iconSetMaterial", label: "Material", themePart: iconSetMaterial },
];

const sampleData = (() => {
  const countries = [
    "Argentina",
    "Italy",
    "United Kingdom",
    "France",
    "Greece",
    "Luxembourg",
    "Sweden",
    "Brazil",
  ];
  const sports = [
    "Basketball",
    "Horse Racing",
    "Bowling",
    "Bobsleigh",
    "Darts",
    "Snowboarding",
    "Tennis",
    "Skateboarding",
  ];
  const names = [
    "Layla Cole",
    "Isabella Corbin",
    "Sophie Brock",
    "Grace Corbin",
    "Ella Griffin",
    "Lily Donovan",
    "Grace Black",
    "Lily Dallas",
  ];

  const data = [];
  for (let i = 0; i < 50; i++) {
    data.push({
      country: countries[i % countries.length],
      sport: sports[i % sports.length],
      name: names[i % names.length],
      totalWinnings: Math.floor(Math.random() * 100000) + 30000,
      winnings2023: Math.floor(Math.random() * 50000) + 10000,
      winnings2022: Math.floor(Math.random() * 50000) + 5000,
      selected: Math.random() > 0.7,
    });
  }
  return data;
})();

const columnDefs: ColDef[] = [
  {
    field: "selected",
    headerName: "",
    width: 50,
  },
  { field: "country", headerName: "Country", width: 150 },
  { field: "sport", headerName: "Sport", width: 150 },
  { field: "name", headerName: "Name", width: 200 },
  {
    field: "totalWinnings",
    headerName: "Total winnings",
    width: 150,
    valueFormatter: (params) => `$${params.value?.toLocaleString()}`,
  },
  {
    field: "winnings2023",
    headerName: "2023 winnings",
    width: 150,
    valueFormatter: (params) => `$${params.value?.toLocaleString()}`,
  },
  {
    field: "winnings2022",
    headerName: "2022 winnings",
    width: 150,
    valueFormatter: (params) => `$${params.value?.toLocaleString()}`,
  },
];

const defaultGridProps = {
  defaultColDef: {
    editable: true,
    flex: 1,
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true,
  },
  paginationPageSize: 25,
  paginationPageSizeSelector: [25, 50, 100],
  enableCharts: true,
  pagination: true,
  sideBar: {
    toolPanels: [
      {
        id: "columns",
        labelDefault: "Columns",
        labelKey: "columns",
        iconKey: "columns",
        toolPanel: "agColumnsToolPanel",
      },
    ],
    // delete this or set to null to not show it by default
    defaultToolPanel: "",
  },
};

interface TableThemeState extends Partial<ThemeDefaultParamsT> {
  selectedIconSet: (typeof iconSets)[0];
  isReset?: boolean;
}

const THEME_DEFAULT: TableThemeState = {
  selectedIconSet: iconSets[0],
  rowVerticalPaddingScale: 0.97,
  cellHorizontalPaddingScale: 0.8,
};

type TableSettingsState = {
  light?: TableThemeState;
  dark?: TableThemeState;
  themeMode?: "light" | "dark";
};

const STATE_DEFAULT: TableSettingsState = {
  light: {
    ...THEME_DEFAULT,
    ...getDefaultAgGridThemeParams("light"),
  },
  dark: {
    ...THEME_DEFAULT,
    ...getDefaultAgGridThemeParams("dark"),
  },
};

function updateState(
  currentTheme: ThemeSettings["tableTheme"],
  mode: "light" | "dark",
  updatedState: Partial<TableSettingsState>,
) {
  if (currentTheme) {
    updatedState[mode] = {
      ...THEME_DEFAULT,
      ...((currentTheme.params || {}) as ThemeDefaultParamsT),
      selectedIconSet:
        iconSets.find((i) => i.id === currentTheme.iconSet) ?? iconSets[0],
      isReset: false,
    };
  } else {
    updatedState[mode] = { ...STATE_DEFAULT[mode], isReset: true };
  }
}

function initializer(state: TableSettingsState): TableSettingsState {
  const { light, dark } = useTableChartThemesStore.getState();
  const chartThemes = { light: light?.tableTheme, dark: dark?.tableTheme };
  const updatedState = {} as Partial<TableSettingsState>;
  for (const mode of THEME_MODES) {
    updateState(chartThemes[mode], mode, updatedState);
  }
  return { ...state, ...updatedState };
}

export function TableSettings() {
  const theme = useShallowThemeStore((state) => state.theme);
  const [themesState, dispatch] = useStateReducer<TableSettingsState>(
    { themeMode: theme },
    initializer,
  );

  const saveThemeSettings = useTableChartThemesStore((s) => s.saveThemeSettings);

  useEffect(() => {
    const unsub = useTableChartThemesStore.subscribe(
      (state) => ({ light: state.light?.tableTheme, dark: state.dark?.tableTheme }),
      (current) => {
        const updatedState = {} as Partial<TableSettingsState>;
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

  const handleInputChange = useCallback(
    (key: keyof TableThemeState, asString = true) =>
      (v: string) => {
        dispatch((prev) => {
          let value = v as string | number;
          if (!asString) {
            const numValue = Number.parseFloat(v);
            value = (Number.isNaN(numValue) ? THEME_DEFAULT[key] : numValue) as number;
          }

          return {
            ...prev,
            [prev.themeMode]: {
              ...prev[prev.themeMode],
              [key]: value || STATE_DEFAULT[prev.themeMode][key],
              isReset: false,
            },
          };
        });
      },
    [],
  );

  const state = themesState[themesState.themeMode];

  const handleSave = useCallback(async () => {
    let hasChanges = false;
    const updatedState = {} as EntityThemeSettings;
    for await (const mode of THEME_MODES) {
      const { isReset, ...agTheme } = themesState[mode];
      const { selectedIconSet, ...rest } = agTheme;
      const iconSet = selectedIconSet.id;

      const params = Object.fromEntries(
        Object.entries(rest).filter(
          ([, value]) => ![undefined, null, ""].some((v) => v === value),
        ),
      ) as ThemeDefaultParams;

      if (!isReset && isEqual(agTheme, STATE_DEFAULT[mode])) {
        console.log(`No changes detected for ${mode} theme, skipping save.`);
        continue;
      }
      hasChanges = true;
      updatedState[mode] = { tableTheme: isReset ? null : { iconSet, params } };
    }

    if (hasChanges) return await saveThemeSettings(updatedState);

    toast.info("No changes detected in theme settings.");
  }, [themesState, saveThemeSettings]);

  const handleIconSetChange = useCallback((value: string) => {
    const iconSet = iconSets.find((i) => i.id === value);
    if (iconSet) {
      dispatch((prev) => ({
        ...prev,
        [prev.themeMode]: {
          ...prev[prev.themeMode],
          selectedIconSet: iconSet,
          isReset: false,
        },
      }));
    }
  }, []);

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

  const gridTheme = useMemo(() => {
    const { selectedIconSet, isReset, ...params } = state;

    const filteredThemeParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, value]) => ![undefined, null, ""].some((v) => v === value),
      ),
    );

    const gridTheme = themeAlpine
      .withPart(themesState.themeMode === "dark" ? colorSchemeDark : colorSchemeLight)
      .withPart(selectedIconSet.themePart)
      .withPart(customCssPart)
      .withParams(filteredThemeParams);

    return gridTheme;
  }, [state, themesState.themeMode]);

  const [debouncedGridTheme] = useDebounceValue(gridTheme, 300);

  const controls = (
    <div className="flex flex-col gap-6">
      <SettingsMenu title="General" canCollapse={true}>
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <Label htmlFor="font-family" className="justify-self-start">
            Font Family:
          </Label>
          <FontFamilyInput
            className="w-full"
            value={state.fontFamily}
            onChange={handleInputChange("fontFamily")}
            placeholder="Select font family..."
          />
          <Label htmlFor="font-size" className="justify-self-start">
            Font Size:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.fontSize}
            onChange={handleInputChange("fontSize")}
          />
          <Label htmlFor="background-color" className="justify-self-start">
            Background Color:
          </Label>
          <ColorPicker
            value={
              state.backgroundColor ||
              (themesState.themeMode === "dark" ? "#1a1a1f" : "#ffffff")
            }
            onChange={handleInputChange("backgroundColor")}
            className="w-full"
          />
          <Label htmlFor="chrome-background-color" className="justify-self-start">
            Chrome Background Color:
          </Label>
          <ColorPicker
            value={state.chromeBackgroundColor}
            onChange={handleInputChange("chromeBackgroundColor")}
            className="w-full"
          />
          <Label htmlFor="header-background-color" className="justify-self-start">
            Row Group Panel Background Color:
          </Label>
          <ColorPicker
            value={state.headerBackgroundColor}
            onChange={handleInputChange("headerBackgroundColor")}
            className="w-full"
          />
          {/* <Label htmlFor="side-bar-bg-color" className="justify-self-start">
            Side Bar Background Color:
          </Label>
          <ColorPicker
            value={state.sideBarBackgroundColor}
            onChange={handleInputChange("sideBarBackgroundColor")}
            className="w-full"
          />
          <Label htmlFor="side-bar-buttons-bg-color" className="justify-self-start">
            Side Bar Buttons Background Color:
          </Label>
          <ColorPicker
            value={state.sideButtonBarBackgroundColor}
            onChange={handleInputChange("sideButtonBarBackgroundColor")}
            className="w-full"
          /> */}
          <Label htmlFor="accent-color" className="justify-self-start">
            Accent Color:
          </Label>
          <ColorPicker
            value={state.accentColor || "#337dba"}
            onChange={handleInputChange("accentColor")}
            className="w-full"
          />
        </div>
      </SettingsMenu>

      <SettingsMenu title="Borders & Spacing" canCollapse={true}>
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <Label htmlFor="border-color" className="justify-self-start">
            Border Color:
          </Label>
          <ColorPicker
            value={
              state.borderColor ||
              (themesState.themeMode === "dark" ? "#444444" : "#dddddd")
            }
            onChange={handleInputChange("borderColor")}
            className="w-full"
          />
          <Label htmlFor="spacing" className="justify-self-start">
            Spacing:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.spacing}
            onChange={handleInputChange("spacing")}
          />
          <Label htmlFor="wrapper-radius" className="justify-self-start">
            Wrapper Radius:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.wrapperBorderRadius}
            onChange={handleInputChange("wrapperBorderRadius")}
          />
          <Label htmlFor="widget-radius" className="justify-self-start">
            Widget Radius:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.borderRadius}
            onChange={handleInputChange("borderRadius")}
          />
        </div>
      </SettingsMenu>

      <SettingsMenu title="Header" canCollapse={true}>
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <Label htmlFor="header-bg-color" className="justify-self-start">
            Background Color:
          </Label>
          <ColorPicker
            value={
              state.altHeaderBackgroundColor ||
              (themesState.themeMode === "dark" ? "#2a2a31" : "#f6f6f6")
            }
            onChange={handleInputChange("altHeaderBackgroundColor")}
            className="w-full"
          />
          <Label htmlFor="header-text-color" className="justify-self-start">
            Text Color:
          </Label>
          <ColorPicker
            value={
              state.headerTextColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("headerTextColor")}
            className="w-full"
          />
          <Label htmlFor="header-font-family" className="justify-self-start">
            Font Family:
          </Label>
          <FontFamilyInput
            className="w-full"
            value={state.headerFontFamily}
            onChange={handleInputChange("headerFontFamily")}
            placeholder="Select font family..."
          />
          <Label htmlFor="header-font-size" className="justify-self-start">
            Font Size:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.headerFontSize}
            onChange={handleInputChange("headerFontSize")}
          />
          <Label htmlFor="header-vert-padding" className="justify-self-start">
            Vertical Padding:
          </Label>
          <Input
            type="number"
            className="w-full"
            value={state.headerVerticalPaddingScale || "1.50"}
            onChange={handleInputChange("headerVerticalPaddingScale", false)}
          />
        </div>
      </SettingsMenu>

      <SettingsMenu title="Cells" canCollapse={true}>
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <Label htmlFor="cell-text-color" className="justify-self-start">
            Cell Text Color:
          </Label>
          <ColorPicker
            value={
              state.cellTextColor ||
              (themesState.themeMode === "dark" ? "#ffffff" : "#000000")
            }
            onChange={handleInputChange("cellTextColor")}
            className="w-full"
          />
          <Label htmlFor="odd-row-bg" className="justify-self-start">
            Even Row Background:
          </Label>
          <ColorPicker
            value={state.evenRowBackgroundColor}
            onChange={handleInputChange("evenRowBackgroundColor")}
            className="w-full"
          />
          <Label htmlFor="odd-row-bg" className="justify-self-start">
            Odd Row Background:
          </Label>
          <ColorPicker
            value={
              state.oddRowBackgroundColor ||
              (themesState.themeMode === "dark" ? "#2a2a31" : "#f6f6f6")
            }
            onChange={handleInputChange("oddRowBackgroundColor")}
            className="w-full"
          />
          <Label htmlFor="cell-vert-padding" className="justify-self-start">
            Vertical Padding:
          </Label>
          <Input
            min={0.5}
            type="number"
            className="w-full"
            value={state.rowVerticalPaddingScale || "1.0"}
            onChange={handleInputChange("rowVerticalPaddingScale", false)}
          />
          <Label htmlFor="cell-horiz-padding" className="justify-self-start">
            Horizontal Padding:
          </Label>
          <SpacingInput
            type="number"
            className="w-full"
            value={state.cellHorizontalPadding}
            onChange={handleInputChange("cellHorizontalPadding")}
          />
        </div>
      </SettingsMenu>

      <SettingsMenu title="Icons" canCollapse={true}>
        <div className="grid w-full grid-cols-[1fr_2fr] items-center gap-x-4 gap-y-2">
          <Label htmlFor="icon-set" className="justify-self-start">
            Icon Set:
          </Label>
          <Select
            className="w-full"
            value={state.selectedIconSet.id}
            onValueChange={handleIconSetChange}
            options={iconSets.map((set) => ({
              label: set.label,
              value: set.id,
            }))}
          />
          <Label htmlFor="icon-size" className="justify-self-start">
            Icon Size:
          </Label>
          <SpacingInput
            className="w-full"
            value={state.iconSize}
            onChange={handleInputChange("iconSize")}
          />
        </div>
      </SettingsMenu>
    </div>
  );

  const preview = (
    <AgGridReact
      className="ag-grid h-full w-full"
      debug={true}
      theme={debouncedGridTheme}
      columnDefs={columnDefs}
      rowData={sampleData}
      rowGroupPanelShow="always"
      {...defaultGridProps}
    />
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
