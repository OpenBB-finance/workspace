import type { ColDef } from "ag-grid-community";
import { useCallback, useMemo, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import CellOnHover from "~/components/General/Table/CellRenderers/CellOnHover";
import { AgGridProvider } from "~/components/General/Table/hooks";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { processEconomicOverviewData } from "~/components/Widgets/dataProcessors";
import { useEconomyCountryProfile } from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import { formatNumber, formatNumberThousands } from "~/lib/utils";
import { countryRegions, getCountryFlag } from "./constants";

// Helper function to create select options
const createCountryOptions = () => {
  const regions = [
    {
      label: "G7 Countries",
      value: "united_states,united_kingdom,germany,france,italy,canada,japan",
    },
    { label: "G20 Countries", value: "g20" },
    { label: "BRICS Countries", value: "brazil,russia,india,china,south_africa" },
    { label: "Africa", value: formatRegionValue(countryRegions.Africa) },
    { label: "Europe", value: "europe" },
    { label: "North America", value: "united_states,canada,mexico" },
    {
      label: "Latin America",
      value: formatRegionValue(countryRegions["Latin America"]),
    },
    { label: "Middle East", value: formatRegionValue(countryRegions["Middle East"]) },
    {
      label: "Asia",
      value: formatRegionValue([
        ...countryRegions["Central Asia"],
        ...countryRegions["South Asia"],
        ...countryRegions["Southeast Asia"],
        ...countryRegions["East Asia"],
      ]),
    },
  ] as { label: string; value: string }[];

  const allCountries = regions.reduce((acc, region) => {
    const countries = region.value.split(",");
    for (const country of countries) {
      if (["g20", "europe"].includes(country)) continue;
      acc.add(country);
    }

    return acc;
  }, new Set<string>());

  regions.unshift({
    label: "All Countries",
    value: Array.from(allCountries).join(","),
  });

  return regions;
};

// Helper function to format region values
const formatRegionValue = (regions) => {
  return regions.join(",").replace(/ /g, "_").toLowerCase();
};

export default function EconomicOverview() {
  const { widget, updateWidget } = useWidgetContext();
  const country = widget.storage?.params?.country || "g20";
  const countryOptions = useMemo(createCountryOptions, []);

  const { isLoading, data, dataUpdatedAt, error } = useEconomyCountryProfile(
    {
      queryParams: {
        provider: "econdb",
        country: country,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
    },
  );
  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const rowData = useMemo(() => {
    return processEconomicOverviewData(data)?.rowData;
  }, [data?.results]);

  const columnDefs = useMemo(() => {
    if (!rowData?.length) return [];
    return (
      [
        {
          headerName: "Country",
          field: "country",
          sortable: true,
          filter: "agTextColumnFilter",
          resizable: true,
          valueGetter: (params) =>
            `${params.data.country} ${getCountryFlag(params.data.country)}`,
          cellRenderer: (params) => {
            const country = params.data.country;
            const value = (
              <div className="flex items-center gap-1.5">
                <span>{country}</span>
                <span className="country-flag">{getCountryFlag(country)}</span>
              </div>
            );

            return <CellOnHover value={value} title={country} />;
          },
        },
        {
          headerName: "Population",
          field: "population",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
          cellRenderer: (params) => {
            if (!params.value) return "-";
            return (
              <CellOnHover
                value={formatNumberThousands(params.value)}
                title={params.value}
              />
            );
          },
        },
        {
          headerName: "GDP ($B USD)",
          field: "gdp_usd",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "GDP (% QoQ)",
          field: "gdp_qoq",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "GDP (% YoY)",
          field: "gdp_yoy",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "CPI (% YoY)",
          field: "cpi_yoy",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Core CPI (% YoY)",
          field: "core_yoy",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Retail Sales (% YoY)",
          field: "retail_sales_yoy",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Industrial Production (% YoY)",
          field: "industrial_production_yoy",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Policy Rate (%)",
          field: "policy_rate",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "10 Yr Yield (%)",
          field: "yield_10y",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Govt Debt/GDP (%)",
          field: "govt_debt_gdp",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Current Account/GDP (%)",
          field: "current_account_gdp",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
        {
          headerName: "Jobless Rate (%)",
          field: "jobless_rate",
          sortable: true,
          filter: "agNumberColumnFilter",
          resizable: true,
          type: "numericColumn",
        },
      ] as ColDef[]
    ).map((column) => {
      if (!column?.filterParams) {
        column.filterParams = {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        };
      }
      if (column.type === "numericColumn" && !column.cellRenderer) {
        column.cellRenderer = (params) => {
          let value = params.value;

          if (typeof params.value === "number") {
            value = formatNumber(params.value, decimalDigitsSettings);
          }
          if (!params.value) return "-";
          return <CellOnHover value={value} title={params.value} />;
        };
      }
      return column;
    });
  }, [decimalDigitsSettings, rowData?.length]);

  const exportData = useMemo(() => {
    if (!rowData) return null;
    return rowData.map((item) => ({
      Country: `${item.country} ${getCountryFlag(item.country)}`,
      Population: item.population,
      GDP_USD: item.gdp_usd,
      GDP_QoQ: item.gdp_qoq,
      GDP_YoY: item.gdp_yoy,
      CPI_YoY: item.cpi_yoy,
      Core_CPI_YoY: item.core_yoy,
      Retail_Sales_YoY: item.retail_sales_yoy,
      Industrial_Production_YoY: item.industrial_production_yoy,
      Policy_Rate: item.policy_rate,
      Yield_10y: item.yield_10y,
      Govt_Debt_GDP: item.govt_debt_gdp,
      Current_Account_GDP: item.current_account_gdp,
      Jobless_Rate: item.jobless_rate,
    }));
  }, [rowData]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
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
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(exportData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(exportData, title, "excel", false);
        },
      }}
      elementNextToTitle={
        <NewAdvancedSelect
          selected={country}
          label={
            country
              ? countryOptions.find((option) => option.value === country)?.label
              : "G20 Countries"
          }
          onSelect={(val) => {
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                params: {
                  ...(prev.storage?.params ?? {}),
                  country: val,
                },
              },
            }));
          }}
          values={countryOptions}
        />
      }
    >
      <div className={"h-[calc(100%-5px)] min-h-[100px]"}>
        <AgGridProvider
          rowData={rowData}
          gridOptions={gridOptions}
          getContextMenuItems={contextMenuItems}
          columnDefs={columnDefs}
        />
      </div>
    </DraggableCard>
  );
}
