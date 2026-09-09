import dayjs from "dayjs";
import { usePostHog } from "posthog-js/react";
import {
  type Dispatch,
  forwardRef,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import TVIndicatorsDialogDialog from "~/components/Charting/TVIndicatorsDialog";
import { useWidgetContext } from "~/components/Widget.context";
import { convertHeadersToRecord } from "~/lib/api";
import {
  type ChartingLibraryFeatureset,
  type ChartingLibraryWidgetOptions,
  type IChartingLibraryWidget,
  type RangeOptions,
  type SavedStateMetaInfo,
  widget as TVChartWidget,
} from "~/lib/charting_library";
import { useTradingViewStore } from "~/lib/state/charting";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";
import { cn, formatNumberNoMagnitude } from "~/lib/utils";
import {
  onSymbolChanged,
  onTASecondTickers,
  useComponentDidMount,
  usePrevWebsocketState,
} from "../datafeed/hooks";
import ChartResources from "../datafeed/resources/TVChartResources";
import { UDFCompatibleDatafeed } from "../datafeed/src/udf-compatible-datafeed";
import type { ChartDataFeed } from "../datafeed/type";
import { getHeaders } from "../Misc/Charting";

const TVChartResources = ChartResources("TVCHART_MAIN_LABEL");

export interface TVChartContainerProps {
  ticker?: string;
  extraClassName?: string;
  simpleChart?: boolean;
  secondTickers?: string[];
  showTA?: boolean;
}

export interface ChartingLibraryWidget extends IChartingLibraryWidget {
  _ready: boolean;
  datafeed: ChartDataFeed;
  getTvWidget: () => this;
  setOnDataHandler: (callback: (data: any) => void) => void;
}

const simpleHideOptions: ChartingLibraryFeatureset[] = [
  "header_symbol_search",
  "header_widget",
  "header_resolutions",
  "left_toolbar",
  "symbol_info",
  "header_symbol_search",
  "show_symbol_logos",
];

function SaveChartLayout(
  tvWidget: ChartingLibraryWidget,
  saveLayout: (save_data: object, meta_info?: SavedStateMetaInfo) => void,
) {
  tvWidget.saveChartToServer(
    // @ts-expect-error
    (layout: any) => {
      tvWidget.save((data) =>
        saveLayout(data, {
          uid: layout.uid,
          name: layout.data.name,
          description: layout.data.description,
        }),
      );
    },
    (error: any) => {
      console.log(error);
    },
  );
}

const themeOverrides = {
  light: {
    "paneProperties.background": "#ffffff",
    "paneProperties.backgroundType": "solid" as const,
  },
  dark: {
    "paneProperties.background": "#151518",
    "paneProperties.backgroundType": "gradient" as const,
    "paneProperties.backgroundGradientStartColor": "#151518",
    "paneProperties.backgroundGradientEndColor": "#151518",
  },
};

const TVChartContainer = forwardRef<ChartingLibraryWidget, TVChartContainerProps>(
  (props, ref) => {
    const { simpleChart, secondTickers, showTA } = props;
    const { widgetRef, activeDashboardId, updateWidget, getWidget } =
      useWidgetContext(true);

    const widgetUUID = widgetRef?.current?.id;
    const chartId = widgetUUID || "charting_page";

    const containerRef = useRef<HTMLDivElement>(null);
    const tvRef = useRef<ChartingLibraryWidget | undefined | null>(undefined);

    const [openFinancials, setOpenFinancials] = useState(false);

    const posthog = usePostHog();
    const { theme, changeSearch, setInitialSelectedSearchTab, setTheme } =
      useShallowThemeStore((state) => ({
        theme: state.theme,
        changeSearch: state.changeSearch,
        setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
        setTheme: state.setTheme,
      }));

    const saveLoadAdapter = useTradingViewStore();

    const savedLayoutRef = useRef(saveLoadAdapter.getWidgetLayout(chartId));

    const saveLayout = useCallback(
      (save_data: object, meta_info?: SavedStateMetaInfo) => {
        savedLayoutRef.current = saveLoadAdapter.saveWidgetLayout(
          chartId,
          save_data,
          meta_info,
        );
      },
      [chartId, savedLayoutRef],
    );

    useEffect(() => {
      const unsubscribe = useTradingViewStore.subscribe(
        (state) => state.charts,
        (_) => {
          if (!tvRef.current?.layoutName()) return;
          const metaInfo = savedLayoutRef.current?.meta_info;
          if (!metaInfo?.uid) SaveChartLayout(tvRef.current, saveLayout);
        },
      );
      return () => unsubscribe();
    }, [chartId, tvRef, savedLayoutRef, saveLayout]);

    const defaultProps = useMemo(() => {
      return {
        ...TVChartResources,
        container: `tv_chart_container_${chartId}`,
      };
    }, [chartId]);

    const customUDFdatafeed = useMemo(() => {
      const widget = widgetRef.current;
      const { headers } = convertHeadersToRecord(widget.endpoint?.headers ?? {});
      return (
        widget?.endpoint?.url &&
        new UDFCompatibleDatafeed(
          widget.endpoint.url,
          widget?.data?.updateFrequency || 60 * 1000,
          headers,
        )
      );
    }, [widgetRef]);

    defaultProps.datafeed.chartId = chartId;

    const overrides = useMemo(() => {
      if (simpleChart) return themeOverrides[theme];

      const paneProperties =
        savedLayoutRef.current?.saved_data?.charts?.[0]?.chartProperties
          ?.paneProperties;
      const paneBg = paneProperties?.background;
      const bgType = paneProperties?.backgroundType;
      const gradientStartColor = paneProperties?.backgroundGradientStartColor;
      const gradientEndColor = paneProperties?.backgroundGradientEndColor;

      const defaultOR = {
        "mainSeriesProperties.showCountdown": true,
        "paneProperties.background": paneBg ?? "#ffffff",
        "paneProperties.backgroundType": bgType ?? ("solid" as const),
        "paneProperties.backgroundGradientStartColor": gradientStartColor ?? "#151518",
        "paneProperties.backgroundGradientEndColor": gradientEndColor ?? "#151518",
      };

      if (theme === "light") return defaultOR;

      return {
        ...defaultOR,
        "paneProperties.background": paneBg ?? "#151518",
        "paneProperties.backgroundType": bgType ?? ("gradient" as const),
      };
    }, [theme, savedLayoutRef]);

    const setOnDataLoadedRef = useRef<Dispatch<SetStateAction<any>> | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getTvWidget: () =>
          tvRef?.current || ({ activeChart: () => ({}) } as ChartingLibraryWidget),
        setOnDataHandler: (callback: (data: any) => Promise<void>) => {
          setOnDataLoadedRef.current = callback;
        },
        ...((tvRef.current || {}) as ChartingLibraryWidget),
      }),
      [setOnDataLoadedRef, tvRef],
    );

    useEffect(() => {
      return () => {
        setOnDataLoadedRef.current = null;
      };
    }, []);

    const handleOnDataLoaded = useCallback(() => {
      if (!(setOnDataLoadedRef.current !== null && tvRef.current?._ready)) return;
      tvRef.current.onChartReady(() => {
        const activeChart = tvRef.current.activeChart();
        activeChart.exportData({ includeDisplayedValues: true }).then((data) => {
          const headers = getHeaders(data.schema);
          const dataAsObjects = data.displayedData.map((row) => {
            return row.reduce((obj, value: string | number, index) => {
              if (typeof value === "string" && value.includes("−"))
                value = value.replace("−", "-");
              if (
                !(
                  Number.isNaN(Number.parseFloat(value as string)) ||
                  ["Date", "Time"].includes(headers[index])
                )
              )
                value = formatNumberNoMagnitude(value);

              if (value?.toString()?.includes("NaN.n/a")) value = null;

              obj[headers[index]] = value;
              return obj;
            }, {});
          });
          setOnDataLoadedRef.current?.(dataAsObjects);
        });
      });
    }, [setOnDataLoadedRef, tvRef]);

    const getWidgetConfig = useCallback((): ChartingLibraryWidgetOptions => {
      if (tvRef.current) {
        tvRef.current.remove();
      }

      const widget = widgetRef.current;
      const loadLastChart = ![simpleChart, secondTickers?.length > 0].some((v) => v);
      const loadSavedData =
        savedLayoutRef.current?.saved_data?.charts &&
        savedLayoutRef.current?.meta_info?.uid &&
        loadLastChart;

      return {
        ...defaultProps,
        ...(customUDFdatafeed && {
          datafeed: customUDFdatafeed,
        }),
        symbol:
          widget?.storage?.defaultSymbol ||
          props.ticker ||
          widget?.data?.mainTicker?.symbol ||
          "AAPL",
        disabled_features: [
          ...defaultProps.disabled_features,
          ...(simpleChart ? simpleHideOptions : []),
        ],
        user_id: widget?.id,
        container: containerRef?.current
          ? containerRef.current
          : defaultProps.container,
        interval: defaultProps.interval,
        theme: theme,
        save_load_adapter: saveLoadAdapter,
        settings_adapter: saveLoadAdapter,
        settings_overrides: overrides,
        saved_data_meta_info: loadSavedData
          ? savedLayoutRef.current?.meta_info
          : undefined,
        saved_data: loadSavedData ? savedLayoutRef.current?.saved_data : undefined,
        // debug: true,
        load_last_chart: false,
        overrides,
      };
    }, [customUDFdatafeed, defaultProps.container, widgetRef, savedLayoutRef]);

    const getOnChartReadyHandler = useCallback(() => {
      if (!tvRef.current) {
        return;
      }

      if (
        savedLayoutRef.current?.saved_data?.charts &&
        !savedLayoutRef.current?.meta_info?.uid
      ) {
        tvRef.current.load(savedLayoutRef.current?.saved_data);
      }

      const hasTickers = secondTickers?.length > 0;

      onSymbolChanged({
        tvWidget: tvRef.current,
        secondTickers,
        posthog,
        getWidget,
        activeDashboardId,
        updateWidget,
      });

      // @ts-expect-error
      tvRef.current.onShortcut("ctrl+k", (e: any) => {
        e.preventDefault();
        setInitialSelectedSearchTab("widgets");
        changeSearch(true);
      });

      // @ts-expect-error
      tvRef.current.onShortcut("ctrl+m", (e: any) => {
        e.preventDefault();
        setTheme(useThemeStore.getState().theme === "dark" ? "light" : "dark");
      });

      tvRef.current.subscribe("study", (studyParams) => {
        handleOnDataLoaded();
        if (posthog) {
          const symbol = tvRef?.current?.activeChart()?.symbolExt()?.symbol;
          if (!symbol) return;
          posthog.capture("TV_added_study_or_metric", {
            value: studyParams?.value,
            // @ts-expect-error
            category: studyParams?.category,
            ticker: symbol,
            type_of_widget: "TV-charting",
          });
        }
      });

      tvRef.current.subscribe(
        // @ts-expect-error
        "ss",
        (_event: { category: string; label: string; value: string }) => {},
      );

      tvRef.current.subscribe("indicators_dialog", () => {});

      if (!simpleChart) {
        tvRef.current.subscribe("chart_loaded", () => {
          if (!tvRef.current?.layoutName()) return;
          const metaInfo = savedLayoutRef.current?.meta_info;
          const sameLayout = tvRef.current?.layoutName() === metaInfo?.name;

          if (!sameLayout) SaveChartLayout(tvRef.current, saveLayout);
        });

        tvRef.current.subscribe("onAutoSaveNeeded", () => {
          const { saved_data } = savedLayoutRef.current || {};
          const hasLayout = tvRef.current?.layoutName();
          if (!(saved_data?.charts || hasLayout)) return;

          if (hasLayout) return SaveChartLayout(tvRef.current, saveLayout);

          tvRef.current.save((data) => saveLayout(data));
        });

        tvRef.current.subscribe("undo_redo_state_changed", () => {
          const { saved_data } = savedLayoutRef.current || {};
          const hasLayout = tvRef.current?.layoutName();
          if (!(saved_data?.charts || hasLayout)) return;

          if (hasLayout) return SaveChartLayout(tvRef.current, saveLayout);

          tvRef.current.save((data) => saveLayout(data));
        });
      }

      if (widgetRef?.current?.widgetId === "price_performance") {
        tvRef.current.activeChart().setTimeFrame({
          val: {
            from: dayjs().subtract(6, "month").unix(),
            to: dayjs().unix(),
          },
          res: "1D",
        } as RangeOptions);
      } else if (!widgetRef?.current?.external) {
        tvRef.current.headerReady().then(() => {
          tvRef.current.createButton({
            useTradingViewStyle: true,
            align: "left",
            text: "Financials",
            onClick: () => {
              setOpenFinancials((prev) => !prev);
            },
          });
        });
      }

      const panes = tvRef.current.activeChart().getPanes();
      for (const pane of panes) {
        if (widgetRef?.current?.widgetId === "price_performance")
          pane.getMainSourcePriceScale().setMode(2);
        pane.getMainSourcePriceScale().setAutoScale(true);
      }

      tvRef.current.subscribe("study_event", (_entityId, event) => {
        setTimeout(() => {
          if (event === "remove") handleOnDataLoaded();
        }, 100);
      });

      tvRef.current
        .activeChart()
        .onDataLoaded()
        .subscribe(null, () => {
          if (!savedLayoutRef.current?.saved_data?.charts && activeDashboardId) {
            tvRef.current.save((data) => saveLayout(data));
          }
          handleOnDataLoaded();
        });
      tvRef.current.onChartReady(() => {
        const activeChart = tvRef.current.activeChart();

        if (hasTickers && activeDashboardId) {
          onTASecondTickers(activeChart, secondTickers, showTA);
          if (hasTickers && activeDashboardId && widgetRef?.current)
            updateWidget((prev) => ({
              ...prev,
              data: {
                ...prev.data,
                secondaryTickers: [],
              },
            }));
        }

        if (simpleChart && !savedLayoutRef.current?.meta_info?.uid)
          activeChart.setChartType(1, () => {});
      });
    }, [saveLayout, widgetRef, getWidget, tvRef, savedLayoutRef, handleOnDataLoaded]);

    const initWidget = useCallback(() => {
      tvRef.current?.remove();
      const widgetOptions = getWidgetConfig();
      const widgetInstance = new TVChartWidget(widgetOptions);
      tvRef.current = widgetInstance as ChartingLibraryWidget;
      tvRef.current.onChartReady(getOnChartReadyHandler);
    }, [tvRef, getWidgetConfig, widgetUUID, getOnChartReadyHandler]);

    usePrevWebsocketState(initWidget);

    useComponentDidMount(() => {
      if (!tvRef.current) initWidget();
      return (): void => {
        if (customUDFdatafeed) customUDFdatafeed?.obliterate?.();
        if (tvRef.current) {
          saveLoadAdapter.debounceUpdateTVState();
          tvRef.current.remove();
          tvRef.current = null;
        }
      };
    });

    useEffect(() => {
      if (tvRef?.current === undefined) return;
      tvRef.current.onChartReady(() => {
        if (tvRef.current?.getTheme() !== theme) {
          tvRef.current.changeTheme(theme, { disableUndo: true }).then(() => {
            tvRef.current?.applyOverrides(overrides);
          });
        }
      });
    }, [overrides]);

    useEffect(() => {
      if (tvRef?.current === undefined) return;
      tvRef.current.onChartReady(() => {
        const currentSymbol = tvRef.current?.activeChart()?.symbolExt()?.symbol;
        if (currentSymbol !== props.ticker)
          tvRef.current?.activeChart().setSymbol(props.ticker);
      });
    }, [props.ticker]);

    return (
      <div className="relative h-[calc(100%-16px)]">
        <div
          ref={(el) => (containerRef.current = el)}
          id={`tv_chart_container_${chartId}`}
          className={cn("ph-no-capture", props.extraClassName)}
        >
          <TVIndicatorsDialogDialog
            widgetId={chartId}
            open={openFinancials}
            setOpen={setOpenFinancials}
            tvWidget={tvRef.current}
          />
        </div>
      </div>
    );
  },
);

export default memo(TVChartContainer);
