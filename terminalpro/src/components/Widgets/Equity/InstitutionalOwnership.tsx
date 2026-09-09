import type { ColDef } from "ag-grid-community";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { getTableData } from "~/components/General/Table/utils";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { useEquityOwnershipInstitutional } from "~/lib/api/sdkComponents";
import type { Widget } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { formatNumber } from "~/lib/utils";

export default function InstitutionalOwnership() {
  const { widget, updateWidget, widgetFromJSON } = useWidgetContext();

  const [possibleYears, setPossibleYears] = useState<number[]>([]);
  const selectedYear = widget.storage?.params?.year || 0;
  const selectedQuarter = widget.storage?.params?.quarter || `Q${dayjs().quarter()}`;

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const setSelected = useCallback(
    (params: { year?: number; quarter?: string }) => {
      const current = widget?.storage?.params;

      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          params: {
            ...(prev?.storage?.params ?? {}),
            year: params.year ?? current.year,
            quarter: params.quarter ?? current.quarter,
          },
        },
      }));
    },
    [widget?.storage?.params, updateWidget],
  );

  const {
    isLoading,
    data: queryData,
    dataUpdatedAt,
    error,
  } = useEquityOwnershipInstitutional(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    const data = queryData?.results;
    if (!data) return;
    if (data?.length) {
      setPossibleYears(
        Array.from(new Set(data.map((item) => dayjs(item.date).year()))),
      );
    }
  }, [queryData?.results]);

  const rowData = useMemo(() => {
    const data = queryData?.results;

    if (!data) return [];

    const newData = getTableData(
      data,
      {
        data: {
          table: {
            transpose: true,
            columnsDefs: widgetFromJSON.data?.table?.columnsDefs,
            showAll: widgetFromJSON.data?.table?.showAll ?? false,
          },
        },
      } as Widget,
      { period: "annual" },
    );

    return newData;
  }, [queryData?.results]);

  const tableData = useMemo(() => {
    if (!rowData || rowData?.length === 0) return [];

    const quarter = Number.parseInt(selectedQuarter.replace("Q", ""), 10);
    // array of dates in [YYYY-MM-DD] format from most recent to oldest
    const dates = Object.keys(rowData?.[0]).filter((item) => item !== "Index");
    const newYear =
      selectedYear !== 0 ? selectedYear : dayjs(queryData?.results?.[0].date).year();

    const year = possibleYears?.includes(newYear) ? newYear : dayjs(dates?.[0]).year();

    const closestQuarterDateString = dates.find((item) => {
      const date = dayjs(item);
      return date.year() === year && date.quarter() === quarter;
    });

    // previousQuarterDateString is the date of the quarter before the closestQuarterDateString
    const previousQuarterDateString =
      dates[dates.indexOf(closestQuarterDateString) + 1];

    if (!closestQuarterDateString && quarter !== 1) {
      setTimeout(() => setSelected({ year: newYear, quarter: `Q${quarter - 1}` }));
      return [];
    }

    const filteredData = rowData.map((item) => {
      const percentage = item[closestQuarterDateString]
        ? (item[closestQuarterDateString] - item[previousQuarterDateString]) /
          item[previousQuarterDateString]
        : null;
      return {
        Index:
          widgetFromJSON.data?.table?.columnsDefs.find(
            (col) => col.field === item.Index,
          )?.headerName || item.Index,
        Current: item[closestQuarterDateString],
        PastQuarter: item[previousQuarterDateString],
        Change:
          (item[closestQuarterDateString] || 0) -
          (item[previousQuarterDateString] || 0),
        Percentage: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].includes(
          percentage,
        )
          ? null
          : percentage,
      };
    });

    return filteredData;
  }, [rowData, selectedYear, selectedQuarter, possibleYears, setSelected]);

  const columnDefs = useMemo(() => {
    if (!tableData?.length) return [];
    return [
      {
        field: "Index",
        pinned: "left",
        headerName: "Index",
      },
      {
        field: "Current",
        type: "numericColumn",
        headerName: "Current Quarter",
        cellStyle: (params) => {
          return params.data.Current > params.data.PastQuarter
            ? { color: "#22C55E" }
            : { color: "#EF4444" };
        },
        valueFormatter: (params) =>
          params.value ? formatNumber(params.value, decimalDigitsToUse) : "-",
      },
      {
        field: "PastQuarter",
        headerName: "Past Quarter",
        type: "numericColumn",
        valueFormatter: (params) => formatNumber(params.value, decimalDigitsToUse),
      },
      {
        field: "Change",
        headerName: "Change",
        type: "numericColumn",
        cellStyle: (params) => {
          return params.value > 0 ? { color: "#22C55E" } : { color: "#EF4444" };
        },
        valueFormatter: (params) => formatNumber(params.value, decimalDigitsToUse),
      },
      {
        field: "Percentage",
        headerName: "Percentage Change",
        type: "numericColumn",
        cellStyle: (params) => {
          return params.value > 0 ? { color: "#22C55E" } : { color: "#EF4444" };
        },
        valueFormatter: (params) =>
          params?.value ? `${formatNumber(params.value, decimalDigitsToUse)}%` : "-",
      },
    ] as ColDef[];
  }, [tableData, decimalDigitsToUse]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  const contextMenuItems = useCallback(
    (params: Parameters<typeof getContextMenuItems>[0]) =>
      getContextMenuItems(params, { widgetId: widget?.id, enableChart: false }),
    [],
  );

  const { renderRow0Params } = useWidgetParamsPositions();

  const yearOptions = useMemo(
    () =>
      [...possibleYears]
        .sort((a, b) => b - a)
        .map((year) => ({ label: year.toString(), value: year })),
    [possibleYears],
  );

  const elementNextToTitle = useMemo(
    () =>
      yearOptions.length > 0 ? (
        <AdvancedSelect
          className="obb-parameter"
          popupWidth={100}
          label={selectedYear ? selectedYear.toString() : "Year"}
          selected={selectedYear || undefined}
          onSelect={(year) => setSelected({ year: Number(year) })}
          values={yearOptions}
        />
      ) : null,
    [selectedYear, setSelected, yearOptions],
  );

  return (
    <DraggableCard
      aiData={queryData?.results}
      aiEnabled={true}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      showActionsSettings={true}
      onSaveSettings={() => {
        updateWidget((prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            decimalDigits: decimalDigitsSettings,
          },
        }));
      }}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={setDecimalDigitsSettings}
        />
      }
      elementNextToTitle={elementNextToTitle}
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(queryData?.results, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(queryData?.results, title, "excel", false);
        },
      }}
      loading={isLoading}
      error={error}
    >
      <div className="grid h-[calc(100%-24px)]">
        <AgGridProvider
          rowData={tableData}
          columnDefs={columnDefs}
          getContextMenuItems={contextMenuItems}
          gridOptions={gridOptions}
        />
      </div>
      <HideOnResize>
        <p className="text-light-300 dark:text-light-600 text-xs mt-2">
          {widget.data?.mainTicker?.currency &&
            `Current Currency: ${widget.data?.mainTicker?.currency}`}
        </p>
      </HideOnResize>
    </DraggableCard>
  );
}
