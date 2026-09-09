import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import {
  getColumnDefs,
  getContextMenuItems,
} from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks";
import { getTableData } from "~/components/General/Table/utils";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { useEtfHoldings, useEtfHoldingsDate } from "~/lib/api/sdkComponents";
import type { Widget } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

const QUARTER_OPTIONS = [
  { label: "Q1", value: "Q1" },
  { label: "Q2", value: "Q2" },
  { label: "Q3", value: "Q3" },
  { label: "Q4", value: "Q4" },
];

export default function ETFHoldings() {
  const { widget, updateWidget, widgetFromJSON } = useWidgetContext();

  const [possibleYears, setPossibleYears] = useState<number[]>([]);
  const selectedQuarter = widget.storage?.params?.quarter || `Q${dayjs().quarter()}`;
  const selectedYear = widget.storage?.params?.year || 0;

  const { data: datesQuery } = useEtfHoldingsDate(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "SPY",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const datesData = datesQuery?.results;

  const setSelectedYear = useCallback(
    (year: number) => {
      updateWidget({
        ...widget,
        storage: {
          ...widget.storage,
          params: { ...(widget?.storage?.params ?? {}), year },
        },
      });
    },
    [widget],
  );

  const { isLoading, data, dataUpdatedAt, error } = useEtfHoldings(
    {
      queryParams: {
        provider: "intrinio",
        symbol: widget.data?.mainTicker?.symbol ?? "SPY",
        date:
          datesData?.find((item) => {
            const date = dayjs(item.date);
            return (
              date.year() === selectedYear &&
              date.quarter() === Number.parseInt(selectedQuarter.replace("Q", ""), 10)
            );
          })?.date ?? datesData?.at(-1)?.date,
      },
    },
    {
      enabled: possibleYears?.length > 0,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const rowData = useMemo(() => {
    if (!data?.results?.length) return null;

    const newData = getTableData(
      data?.results,
      {
        data: {
          table: {
            transpose: widgetFromJSON.data?.table?.transpose ?? false,
            columnsDefs: widgetFromJSON.data?.table?.columnsDefs,
            showAll: widgetFromJSON.data?.table?.showAll ?? false,
          },
        },
      } as Widget,
      { period: "annual" },
    );

    return newData;
  }, [data?.results]);

  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const columnDefs = useMemo(() => {
    if (!rowData) return [];

    return getColumnDefs(rowData, {
      external: widget?.external,
      widgetId: widget.widgetId,
      data: {
        table: {
          transpose: widgetFromJSON.data?.table?.transpose ?? false,
          columnsDefs: widgetFromJSON.data?.table?.columnsDefs,
          showAll: widgetFromJSON.data?.table?.showAll ?? false,
        },
      },
    });
  }, [rowData]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  useEffect(() => {
    if (!datesData) return;
    if (datesData?.length) {
      const dates = datesData.map((item) => dayjs(item.date));
      setPossibleYears(Array.from(new Set(dates.map((item) => item.year()))));
      setSelectedYear(selectedYear !== 0 ? selectedYear : dates[0].year());
    }
  }, [datesData]);

  const handleSave = useCallback(() => {
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        decimalDigits: decimalDigitsSettings,
      },
    }));
  }, [decimalDigitsSettings]);

  return (
    <DraggableCard
      aiData={data?.results}
      aiEnabled={true}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={setDecimalDigitsSettings}
        />
      }
      elementNextToTitle={
        <>
          {possibleYears.length > 0 && (
            <AdvancedSelect
              className="obb-parameter"
              popupWidth={100}
              label={
                possibleYears?.includes(selectedYear)
                  ? selectedYear.toString()
                  : (dayjs(datesData?.[0]?.date).year().toString() ?? "Year")
              }
              selected={
                possibleYears?.includes(selectedYear)
                  ? selectedYear
                  : dayjs(datesData?.[0]?.date).year()
              }
              onSelect={(year) => setSelectedYear(Number(year))}
              values={[...possibleYears]
                .sort((a, b) => b - a)
                .map((y) => ({ label: y.toString(), value: y }))}
            />
          )}
          <AdvancedSelect
            className="obb-parameter"
            popupWidth={100}
            label={selectedQuarter}
            selected={selectedQuarter}
            onSelect={(value) => {
              if (!value) return;
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  params: {
                    ...(prev?.storage?.params ?? {}),
                    quarter: String(value),
                  },
                },
              }));
            }}
            values={QUARTER_OPTIONS}
          />
        </>
      }
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(data, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(data, title, "excel", false);
        },
      }}
      loading={isLoading}
      error={error}
    >
      <div className="h-[calc(100%-24px)]">
        <AgGridProvider
          rowData={rowData}
          getContextMenuItems={useCallback(
            (params) => getContextMenuItems(params, { widgetId: widget?.id }),
            [],
          )}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
        />
      </div>
    </DraggableCard>
  );
}
