import dayjs from "dayjs";
import { debounce, isEqual } from "lodash";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { postUserTVState } from "~/api/auth.api";
import type { MetricType } from "~/components/Charting/constants";
import type {
  ChartData,
  ChartMetaInfo,
  ChartTemplate,
  ChartTemplateContent,
  LineToolsAndGroupsLoadRequestContext,
  LineToolsAndGroupsLoadRequestType,
  LineToolsAndGroupsState,
  ResolutionString,
  SavedStateMetaInfo,
  StudyTemplateData,
  StudyTemplateMetaInfo,
} from "../charting_library";
import type { Selector } from "./app";
import mainContent from "./main.json";

interface ChartingState {
  widgetStates: { [widgetId: string]: { symbol: string; prevSymbol: string } };
  widgetSecurities: {
    [widgetId: string]: { [symbol: string]: { metrics: MetricType[] } };
  };
  changeSymbol: (widgetId: string, symbol: string) => void;
  getSymbol: (widgetId: string) => string;
  getSecurityMetrics: (widgetId: string, symbol: string) => MetricType[];
  updateSecurityMetrics: (
    widgetId: string,
    symbol: string,
    metrics: MetricType[],
  ) => void;
  removeWidgetData: (widgetId: string) => void;
  removeTabWidgetsData: (widgetIds: string[]) => void;
}

export const useChartingStore = createWithEqualityFn<ChartingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        widgetStates: {
          charting_page: {
            symbol: "AAPL",
            prevSymbol: "",
          },
        },
        widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
        getSymbol: (widgetId: string) => {
          const { widgetStates } = get();
          return widgetStates[widgetId]?.symbol || "AAPL";
        },
        changeSymbol: (widgetId: string, symbol: string) => {
          const { widgetStates } = get();
          const currentSymbol = widgetStates[widgetId]?.symbol || "AAPL";
          if (symbol === currentSymbol) {
            return;
          }

          set((state) => ({
            widgetStates: {
              ...state.widgetStates,
              [widgetId]: {
                symbol,
                prevSymbol: currentSymbol,
              },
            },
          }));
        },
        getSecurityMetrics: (widgetId: string, symbol: string) => {
          const { widgetSecurities } = get();
          return widgetSecurities[widgetId]?.[symbol]?.metrics || [];
        },
        updateSecurityMetrics: (
          widgetId: string,
          symbol: string,
          metrics: MetricType[],
        ) => {
          set((state) => {
            if (!state.widgetSecurities[widgetId]) {
              state.widgetSecurities[widgetId] = {};
            }
            state.widgetSecurities[widgetId][symbol] = { metrics };
            return state;
          });
        },
        removeWidgetData: (widgetId: string) => {
          const { widgetStates, widgetSecurities } = get();

          const newWidgetStates = Object.fromEntries(
            Object.entries(widgetStates).filter(([wId]) => wId !== widgetId),
          );
          const newWidgetSecurities = Object.fromEntries(
            Object.entries(widgetSecurities).filter(([wId]) => wId !== widgetId),
          );

          useTradingViewStore.getState().removeWidgetLayout(widgetId);
          set({
            widgetStates: newWidgetStates,
            widgetSecurities: newWidgetSecurities,
          });
        },
        removeTabWidgetsData: (widgetIds: string[]) => {
          if (!widgetIds.length) return;
          const { widgetStates, widgetSecurities } = get();

          const newWidgetStates = Object.fromEntries(
            Object.entries(widgetStates).filter(([wId]) => !widgetIds.includes(wId)),
          );
          const newWidgetSecurities = Object.fromEntries(
            Object.entries(widgetSecurities).filter(
              ([wId]) => !widgetIds.includes(wId),
            ),
          );

          useTradingViewStore.getState().removeTabWidgetsData(widgetIds);

          set({
            widgetStates: newWidgetStates,
            widgetSecurities: newWidgetSecurities,
          });
        },
      }),
      {
        version: 2,
        name: "charting-storage",
        migrate(persistedState: any, version) {
          if (version === 1) {
            return {
              widgetStates: {
                charting_page: {
                  symbol: "AAPL",
                  prevSymbol: "",
                },
              },
              widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
            };
          }
          return persistedState;
        },
      },
    ),
  ),
);

// interface ChartData {
//   /** unique ID of the chart (may be `undefined` if it wasn't saved before) */
//   id: string | undefined | number;
//   /** name of the chart */
//   name: string;
//   /** symbol of the chart */
//   symbol: string;
//   /** resolution of the chart */
//   resolution: ResolutionString;
//   /** content of the chart */
//   content: string;
//   /** UNIX time when the chart was last modified */
//   timestamp: number;
// }

export interface TVChartsState {
  charts: ChartData[];
  studyTemplates: StudyTemplateData[];
  drawingTemplates: { name: string; content: string }[];
  chartTemplates: { name: string; content: ChartTemplateContent }[];
  chartLayouts: {
    [widgetId: string]: { meta_info: SavedStateMetaInfo; saved_data: object };
  };
}

export interface TVState {
  charts_state?: TVChartsState;
  settings?: { [key: string]: string };
}

type TVWidgetLayout = {
  meta_info: SavedStateMetaInfo;
  saved_data: object | any;
};

interface TradingViewState extends TVChartsState {
  /** Initial settings */
  initialSettings?: {
    [key: string]: string;
  };
  /** Set a value for a setting */
  setValue(key: string, value: string): void;
  /** Remove a value for a setting */
  removeValue(key: string): void;
  getIsSidebarHidden: () => boolean;
  // Charting API
  getAllCharts: () => Promise<ChartMetaInfo[]>;
  removeChart: (chartId: string | number) => Promise<void>;
  saveChart: (chartData: ChartData) => Promise<string>;
  getChartContent: (chartId: string | number) => Promise<string>;
  getAllStudyTemplates(): Promise<StudyTemplateMetaInfo[]>;
  removeStudyTemplate(studyTemplateInfo: StudyTemplateMetaInfo): Promise<void>;
  saveStudyTemplate(studyTemplateData: StudyTemplateData): Promise<void>;
  getStudyTemplateContent(studyTemplateInfo: StudyTemplateMetaInfo): Promise<string>;
  getDrawingTemplates(toolName: string): Promise<string[]>;
  loadDrawingTemplate(toolName: string, templateName: string): Promise<string>;
  removeDrawingTemplate(toolName: string, templateName: string): Promise<void>;
  saveDrawingTemplate(
    toolName: string,
    templateName: string,
    content: string,
  ): Promise<void>;
  getChartTemplateContent(templateName: string): Promise<ChartTemplate>;
  getAllChartTemplates(): Promise<string[]>;
  saveChartTemplate(newName: string, theme: ChartTemplateContent): Promise<void>;
  removeChartTemplate(templateName: string): Promise<void>;
  saveLineToolsAndGroups(
    layoutId: string | undefined,
    chartId: string | number,
    state: LineToolsAndGroupsState,
  ): Promise<void>;
  loadLineToolsAndGroups(
    layoutId: string | undefined,
    chartId: string | number,
    requestType: LineToolsAndGroupsLoadRequestType,
    requestContext: LineToolsAndGroupsLoadRequestContext,
  ): Promise<Partial<LineToolsAndGroupsState> | null>;
  getWidgetLayout: (widgetId: string) => TVWidgetLayout;
  saveWidgetLayout: (
    widgetId: string,
    saved_data: object,
    meta_info?: SavedStateMetaInfo | undefined,
  ) => TVWidgetLayout;
  removeWidgetLayout: (widgetId: string) => void;
  removeTabWidgetsData: (widgetIds: string[]) => void;
  _getDrawingKey: (layoutId: string | undefined, chartId: string | number) => string;
  getTVState: () => TVState;
  uploadUserTVState: () => Promise<void>;
  updateTVState: (state: TVState) => void;
  debounceUpdateTVState: () => Promise<void>;
}

export const useTradingViewStore = createWithEqualityFn<TradingViewState>()(
  subscribeWithSelector((set, get: () => TradingViewState) => ({
    charts: [
      {
        name: "Main",
        content: JSON.stringify(mainContent),
        symbol: "AAPL",
        resolution: "1D" as ResolutionString,
        id: "nahr3in4k" as any,
        timestamp: 1697126934,
      },
    ],
    studyTemplates: [],
    drawingTemplates: [],
    chartTemplates: [],
    getAllCharts: async () => {
      const { charts } = get();
      return Promise.resolve(
        charts.map((chart: ChartData & { timestamp: number }) => ({
          id: chart.id as any,
          name: chart.name,
          symbol: chart.symbol,
          resolution: chart.resolution,
          timestamp: chart.timestamp,
          content: chart.content,
        })) as ChartMetaInfo[],
      );
    },
    removeChart: async (chartId: string) => {
      const { charts, chartLayouts } = get();
      const newChartLayouts = Object.fromEntries(
        Object.entries(chartLayouts).filter(
          ([_widgetId, layout]) => layout.meta_info?.uid?.toString() !== chartId,
        ),
      );
      set({
        charts: charts.filter((chart) => chart.id !== chartId.toString()),
        chartLayouts: newChartLayouts,
      });
      return Promise.resolve();
    },
    saveChart: async (chartData: ChartData) => {
      const { charts } = get();
      const chart: ChartData & { timestamp?: number } = chartData;
      const newCharts = charts.filter((chart) => chart.id !== chartData.id);

      chart.timestamp = dayjs().unix();
      if (!chartData.id) {
        chart.id = Math.random().toString(36).substr(2, 9) as any;
      }
      newCharts.push(chart);

      set({ charts: newCharts });
      return Promise.resolve(chartData.id.toString());
    },
    getChartContent: async (chartId: number | string) => {
      const { charts } = get();
      return Promise.resolve(
        charts?.find((chart) => chart.id === chartId)?.content || "",
      );
    },
    getAllStudyTemplates: async () => {
      const { studyTemplates } = get();
      return Promise.resolve(studyTemplates);
    },
    removeStudyTemplate: async (studyTemplateInfo: StudyTemplateMetaInfo) => {
      const { studyTemplates } = get();

      set({
        studyTemplates: studyTemplates.filter(
          (studyTemplate) => studyTemplate.name !== studyTemplateInfo.name,
        ),
      });
      return Promise.resolve();
    },
    saveStudyTemplate: async (studyTemplateData: StudyTemplateData) => {
      const { studyTemplates } = get();
      const newStudyTemplates = studyTemplates.filter(
        (studyTemplate) => studyTemplate.name !== studyTemplateData.name,
      );
      newStudyTemplates.push(studyTemplateData);
      set({ studyTemplates: newStudyTemplates });
      return Promise.resolve();
    },
    getStudyTemplateContent: async (studyTemplateInfo: StudyTemplateMetaInfo) => {
      const { studyTemplates } = get();
      const studyTemplate = studyTemplates.find(
        (studyTemplate) => studyTemplate.name === studyTemplateInfo.name,
      );
      return Promise.resolve(studyTemplate?.content || "");
    },
    getDrawingTemplates: async (_toolName: string) => {
      const { drawingTemplates } = get();
      return drawingTemplates.map((template) => template.name);
    },
    loadDrawingTemplate: async (_toolName: string, templateName: string) => {
      const { drawingTemplates } = get();
      const template = drawingTemplates.find(
        (template) => template.name === templateName,
      );
      return Promise.resolve(template?.content || "");
    },
    removeDrawingTemplate: async (_toolName: string, templateName: string) => {
      const { drawingTemplates } = get();
      const newDrawingTemplates = drawingTemplates.filter(
        (template) => template.name !== templateName,
      );
      set({ drawingTemplates: newDrawingTemplates });
      return Promise.resolve();
    },
    saveDrawingTemplate: async (
      _toolName: string,
      templateName: string,
      content: string,
    ) => {
      const { drawingTemplates } = get();
      const newDrawingTemplates = drawingTemplates.filter(
        (template) => template.name !== templateName,
      );
      newDrawingTemplates.push({ name: templateName, content });
      set({ drawingTemplates: newDrawingTemplates });
      return Promise.resolve();
    },
    getChartTemplateContent: async (templateName: string) => {
      const { chartTemplates } = get();
      const theme = { content: null };

      const content = chartTemplates.find((x) => x.name === templateName)?.content;

      if (content) {
        theme.content = structuredClone(content);
      }
      return Promise.resolve(theme);
    },
    getAllChartTemplates: async () => {
      const { chartTemplates } = get();
      return Promise.resolve(chartTemplates.map((template) => template.name));
    },
    saveChartTemplate: async (newName: string, theme: ChartTemplateContent) => {
      const { chartTemplates } = get();
      const newTheme = chartTemplates.find((x) => x.name === newName);

      if (newTheme) {
        newTheme.content = theme;
      } else {
        chartTemplates.push({ name: newName, content: theme });
      }
      set({ chartTemplates });
      return Promise.resolve();
    },
    removeChartTemplate: async (templateName: string) => {
      const { chartTemplates, chartLayouts } = get();
      const newChartTemplates = chartTemplates.filter(
        (template) => template.name !== templateName,
      );
      const newChartLayouts = Object.fromEntries(
        Object.entries(chartLayouts).filter(
          ([_widgetId, layout]) => layout.meta_info?.name !== templateName,
        ),
      );
      set({ chartTemplates: newChartTemplates, chartLayouts: newChartLayouts });
      return Promise.resolve();
    },
    saveLineToolsAndGroups: async (
      layoutId: string | undefined,
      chartId: string | number,
      state: LineToolsAndGroupsState,
    ) => {
      const drawings = state.sources;

      const { drawingTemplates } = get();

      if (!drawingTemplates[`${layoutId}/${chartId}`]) {
        drawingTemplates[`${layoutId}/${chartId}`] = {};
      }

      for (const [key, state] of drawings) {
        if (state === null) {
          delete drawingTemplates[`${layoutId}/${chartId}`][key];
        } else {
          drawingTemplates[`${layoutId}/${chartId}`][key] = state;
        }
      }

      set({ drawingTemplates });
      return Promise.resolve();
    },
    loadLineToolsAndGroups: async (
      layoutId: string | undefined,
      chartId: string | number,
      _requestType: LineToolsAndGroupsLoadRequestType,
      _requestContext: LineToolsAndGroupsLoadRequestContext,
    ) => {
      const { drawingTemplates } = get();
      const rawSources = drawingTemplates[`${layoutId}/${chartId}`];
      if (!rawSources) return null;
      const sources = new Map();

      for (const [key, state] of Object.entries(rawSources)) {
        sources.set(key, state);
      }

      return Promise.resolve({ sources });
    },

    _getDrawingKey: (layoutId: string | undefined, chartId: string | number) => {
      return `${layoutId}/${chartId}`;
    },
    getWidgetLayout: (widgetId: string) => {
      const { chartLayouts } = get();
      return chartLayouts?.[widgetId] || ({ meta_info: {}, saved_data: {} } as any);
    },
    saveWidgetLayout: (
      widgetId: string,
      saved_data: object,
      meta_info: SavedStateMetaInfo,
    ) => {
      const { chartLayouts } = get();
      const widgetLayout = { meta_info, saved_data };
      set({
        chartLayouts: {
          ...chartLayouts,
          [widgetId]: widgetLayout,
        },
      });

      return widgetLayout;
    },
    chartLayouts: {},
    removeWidgetLayout: (widgetId: string) => {
      const { chartLayouts } = get();
      if (!chartLayouts?.[widgetId]) return;

      const newChartLayouts = Object.fromEntries(
        Object.entries(chartLayouts).filter(([wId]) => wId !== widgetId),
      );

      set({ chartLayouts: newChartLayouts });
      get().debounceUpdateTVState();
    },
    removeTabWidgetsData: (widgetIds: string[]) => {
      const { chartLayouts } = get();
      if (!widgetIds.some((widgetId) => chartLayouts?.[widgetId])) return;

      const newChartLayouts = Object.fromEntries(
        Object.entries(chartLayouts).filter(
          ([widgetId]) => !widgetIds.includes(widgetId),
        ),
      );

      set({ chartLayouts: newChartLayouts });
      get().debounceUpdateTVState();
    },
    /** Settings */
    initialSettings: { "StyleWidget.quicks": "[2,1]" },
    setValue: (key: string, value: string) => {
      set((state) => {
        const newSettings = { ...state.initialSettings, [key]: value };
        return { initialSettings: newSettings };
      });
    },
    removeValue: (key: string) => {
      set((state) => {
        const newSettings = { ...state.initialSettings };
        delete newSettings[key];
        return { initialSettings: newSettings };
      });
    },
    getIsSidebarHidden: () => {
      const { initialSettings } = get();
      return initialSettings["ChartDrawingToolbarWidget.visible"] === "false";
    },
    /** TV State */
    getTVState: () => {
      const {
        charts,
        studyTemplates,
        drawingTemplates,
        chartTemplates,
        chartLayouts,
        initialSettings,
      } = get();

      return {
        charts_state: {
          charts,
          studyTemplates,
          drawingTemplates,
          chartTemplates,
          chartLayouts,
        },
        settings: initialSettings,
      };
    },
    uploadUserTVState: async () => {
      const state = get().getTVState();
      await postUserTVState(state);
    },
    updateTVState: (state: TVState) => {
      if (Object.keys(state ?? {}).length === 0) return;
      const { charts_state = {}, settings = {} } = state;

      set((state) => {
        return {
          ...state,
          ...charts_state,
          initialSettings: {
            ...state.initialSettings,
            ...settings,
          },
        };
      });
    },
    debounceUpdateTVState: debounce(async () => {
      await get().uploadUserTVState();
    }, 2000),
  })),
);

export function useShallowChartingStore<S extends ChartingState, T>(
  selector: Selector<S, T>,
): T {
  return useChartingStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

export function useShallowTradingViewStore<S extends TradingViewState, T>(
  selector: Selector<S, T>,
): T {
  return useTradingViewStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
