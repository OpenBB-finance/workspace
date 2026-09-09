import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import {
  getColumnDefs,
  getContextMenuItems,
} from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks/useTableContext";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { processCountryIndicatorsData } from "~/components/Widgets/dataProcessors";
import { useEconomyIndicators } from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  countryData,
  countryOptions,
  transformOptions,
  transformOptionsMap,
} from "./constants";

export default function CountryIndicators() {
  const { widget, updateWidget } = useWidgetContext();

  const selectedCountry = widget.storage?.params?.country || "US";
  const transform = widget.storage?.params?.transform || null;

  const { isLoading, data, dataUpdatedAt, error } = useEconomyIndicators(
    {
      queryParams: {
        provider: "econdb",
        symbol: "main",
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

  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const rowData = useMemo(
    () => processCountryIndicatorsData(data)?.rowData,
    [data?.results],
  );

  // Dynamically generate column definitions based on unique dates
  const columnDefs = useMemo(() => {
    const coldefs = getColumnDefs(rowData, {
      // @ts-expect-error - ignored for now
      widgetId: "country_indicators",
      external: false,
      data: {
        table: {
          transpose: false,
          columnsDefs: [
            { headerName: "Index", field: "Index", hide: true },
            { headerName: "Indicator", field: "indicator", hide: true },
            {
              headerName: "Name",
              field: "full_indicator_name",
              chartDataType: "category",
            },
            { headerName: "Units", field: "units", chartDataType: "excluded" },
            {
              headerName: "parent",
              field: "parent",
              hide: true,
              chartDataType: "excluded",
            },
          ],
        },
      },
    });

    for (const col of coldefs) {
      if (col.field.includes("-")) {
        const date = dayjs(col.field);
        col.headerName = `${date.year()} Q${date.quarter()}`;
      }
    }
    return coldefs;
  }, [rowData]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
      enableCharts: true,
      treeData: true,
      getDataPath: (data: any) => {
        return data.parent;
      },
      autoGroupColumnDef: {
        headerName: "Symbol",
        cellRendererParams: {
          suppressCount: true,
        },
      },
    };
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

  const elementNextToTitle = useMemo(() => <IndicatorsSelect />, []);

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
          setDecimalDigits={setDecimalDigitsSettings}
        />
      }
      error={rowData?.length === 0 ? "No data found" : error}
      elementNextToTitle={elementNextToTitle}
    >
      <div className={"h-[calc(100%-5px)] min-h-[100px]"}>
        <AgGridProvider
          rowData={rowData}
          gridOptions={gridOptions}
          groupDisplayType={"singleColumn"}
          getContextMenuItems={contextMenuItems}
          columnDefs={columnDefs}
        />
      </div>
    </DraggableCard>
  );
}

function IndicatorsSelect() {
  const updateWidget = useWidgetContext().updateWidget;
  const { transform = null, country = "US" } =
    useWidgetContext()?.widget?.storage?.params || {};

  return (
    <>
      <NewAdvancedSelect
        selected={country}
        label={countryData?.[country]?.label || "United States"}
        forceSearch={true}
        onSelect={(val) => {
          updateWidget((prev) => ({
            ...prev,
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
      <NewAdvancedSelect
        selected={transform || null}
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
    </>
  );
}
