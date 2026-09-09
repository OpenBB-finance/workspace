import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import {
  getColumnDefs,
  getContextMenuItems,
} from "~/components/General/Table/AgGridUtils";
import {
  ChartViewButton,
  ChartViewElement,
} from "~/components/General/Table/Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "~/components/General/Table/Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  useAgGridContext,
} from "~/components/General/Table/hooks/useTableContext";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { processEconomicIndicatorsData } from "~/components/Widgets/dataProcessors";
import { useEconomyIndicators } from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, getJsonColDefs } from "~/lib/utils";
import GroupDropdown from "../Helpers/GroupDropdown";
import {
  countryData,
  countryOptions,
  getIndicators,
  transformOptions,
  transformOptionsMap,
} from "./constants";

export default function EconomicIndicators() {
  const { widget, updateWidget } = useWidgetContext();
  const { chartViewElementRef } = useAgGridContext();

  const params = useMemo(
    () => widget?.storage?.params || {},
    [widget?.storage?.params],
  );

  const selectedCountry = widget.groupId
    ? widget.data.mainTicker.symbol
    : params?.country || "US";
  const indicators = params?.symbol || "RGDP,GDP";
  const chartView = widget.storage?.chartView?.enabled;

  const transform = params?.transform || null;

  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  // @ts-expect-error - ignored for now
  const columnDefsFromJSON = useMemo(() => getJsonColDefs("economic_indicators"), []);

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const {
    isLoading,
    data: queryData,
    dataUpdatedAt,
    error,
  } = useEconomyIndicators(
    {
      queryParams: {
        provider: "econdb",
        symbol: indicators,
        country: selectedCountry,
        start_date: dayjs().subtract(4, "years").startOf("year").format("YYYY-MM-DD"),
        frequency: "quarter",
        // Transform can't be included as None
        ...(transform !== null && { transform: transform }),
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
    },
  );

  const { rowData, columnDefs } = useMemo(() => {
    const rowData = processEconomicIndicatorsData(queryData)?.rowData;

    if (!rowData?.length) return { rowData: [], columnDefs: [] };
    // Dynamically generate column definitions based on unique dates
    const coldefs = getColumnDefs(rowData, {
      // @ts-expect-error - ignored for now
      widgetId: "economic_indicators",
      external: false,
      data: {
        table: {
          transpose: true,
          columnsDefs: columnDefsFromJSON,
        },
      },
    });

    for (const col of coldefs) {
      if (col.field.includes("-")) {
        const date = dayjs(col.field);
        col.headerName = `${date.year()} Q${date.quarter()}`;
      }
    }

    return { rowData, columnDefs: coldefs };
  }, [queryData?.results]);

  const gridOptions = useMemo(() => {
    return { rowHeight: 32, headerHeight: 32, enableCharts: true };
  }, []);

  const handleSave = useCallback(() => {
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        decimalDigits: decimalDigitsSettings,
      },
    }));
  }, [decimalDigitsSettings]);

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: widget?.id }),
    [],
  );

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();

  const elementNextToTitle = useMemo(() => <IndicatorsSelect />, []);
  const extraNavbarElements = useMemo(() => <ChartViewButton />, []);

  return (
    <DraggableCard
      isBlocked={true}
      aiEnabled={true}
      aiData={rowData}
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={(value) => setDecimalDigitsSettings(value)}
        />
      }
      error={rowData?.length === 0 ? "No data found" : error}
      extraNavbarElements={extraNavbarElements}
      extraSettings={ChartToolPanelActions}
      elementNextToTitle={elementNextToTitle}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("grid", {
          "h-[calc(100%-5px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridProvider
          rowData={rowData}
          gridOptions={gridOptions}
          groupDisplayType={"singleColumn"}
          getContextMenuItems={contextMenuItems}
          columnDefs={columnDefs}
          popupParent={chartViewElementRef.current}
          {...agChartViewProps}
        />
      </div>
    </DraggableCard>
  );
}

function IndicatorsSelect() {
  const {
    widget: { groupId, storage: { params } = {}, data: { mainTicker } = {} },
    updateWidget,
  } = useWidgetContext();

  const { transform = null, symbol = "RGDP,GDP", country } = params || {};

  const selectedCountry = groupId ? mainTicker.symbol : country || "US";

  const allIndicators = useMemo(() => getIndicators(), []);

  return (
    <>
      <GroupDropdown type="ticker">
        <NewAdvancedSelect
          className=""
          selected={selectedCountry}
          label={countryData?.[selectedCountry]?.label || "United States"}
          forceSearch={true}
          onSelect={(val: string) => {
            const name = countryData?.[val]?.label;
            updateWidget((prev) => ({
              ...prev,
              data: {
                ...prev.data,
                mainTicker: { ...prev.data.mainTicker, symbol: val, id: val, name },
              },
              storage: {
                ...prev.storage,
                params: {
                  ...(prev.storage.params || {}),
                  country: val,
                },
              },
            }));
          }}
          values={countryOptions}
        />
      </GroupDropdown>
      <NewAdvancedSelect
        selected={transform}
        label={transformOptionsMap?.[transform] || "Default"}
        onSelect={(val) => {
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              params: {
                ...(prev.storage.params || {}),
                transform: val,
              },
            },
          }));
        }}
        values={transformOptions}
      />
      <NewAdvancedSelect
        selected={symbol?.split(",") ?? ["RGDP", "GDP"]}
        label={"Indicators"}
        values={allIndicators}
        listWidth={280}
        onSelect={(val: string[]) => {
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              params: {
                ...(prev.storage.params || {}),
                symbol: val.join(","),
              },
            },
          }));
        }}
      />
    </>
  );
}
