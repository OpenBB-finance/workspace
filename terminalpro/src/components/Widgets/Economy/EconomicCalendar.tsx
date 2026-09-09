import type { ColDef } from "ag-grid-community";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard from "~/components/DraggableCard";
import {
  getContextMenuItems,
  getDateFilterParams,
} from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useEconomyCalendar } from "~/lib/api/sdkComponents";
import type { OBBjectEconomicCalendar } from "~/lib/api/sdkSchemas";
import { getCountryFlag } from "./constants";

function getStartDate(recent: string | null) {
  const dateSwitch = () => {
    switch (recent) {
      case "today":
        return dayjs();
      case "yesterday":
        return dayjs().subtract(1, "day");
      case "tomorrow":
        return dayjs().add(1, "day");
      case "this week":
        return dayjs().subtract(1, "week").endOf("week");
      case "next week":
        return dayjs().add(1, "week").startOf("week");
      case "this month":
        return dayjs().startOf("month");
      case "next month":
        return dayjs().add(1, "month").startOf("month");
      default:
        return dayjs();
    }
  };
  return dateSwitch().format("YYYY-MM-DD");
}

function getEndDate(recent: string | null) {
  const dateSwitch = () => {
    switch (recent) {
      case "today":
        return dayjs().add(1, "day");
      case "yesterday":
        return dayjs();
      case "tomorrow":
        return dayjs().add(2, "day");
      case "this week":
        return dayjs().add(1, "week").startOf("week");
      case "next week":
        return dayjs().add(2, "week").startOf("week");
      case "this month":
        return dayjs().add(1, "month").startOf("month");
      case "next month":
        return dayjs().add(1, "month").endOf("month");
      default:
        return dayjs().add(1, "day");
    }
  };
  return dateSwitch().format("YYYY-MM-DD");
}

export default function EconomicCalendar() {
  const { widget, updateWidget } = useWidgetContext();

  const { isLoading, data, dataUpdatedAt, error } = useEconomyCalendar(
    {
      queryParams: {
        provider: "tradingeconomics",
        ...(widget.storage?.countries && {
          country: widget.storage?.countries,
        }),
        ...(widget.storage?.category && {
          group: widget.storage?.category,
        }),
        ...(widget.storage?.importance && {
          importance: widget.storage?.importance,
        }),
        start_date: getStartDate(widget.storage?.recent),
        end_date: getEndDate(widget.storage?.recent),
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      retry: 1,
    },
  );

  const tableData = useMemo(() => {
    if (!data?.results) return [];
    return processEconomicCalendarData(data, widget)?.rowData;
  }, [data?.results, widget.storage?.timezone]);

  const columnDefs = useMemo(() => {
    if (!tableData?.length) return null;
    return (
      [
        {
          headerName: "Date",
          field: "date",
          sortable: true,
          cellDataType: "date",
          filter: "agDateColumnFilter",
          width: 100,
          minWidth: 100,
          resizable: true,
          valueFormatter: (params) => {
            return dayjs(params.value).format("YYYY-MM-DD");
          },
          filterParams: getDateFilterParams(),
        },
        {
          headerName: "Time",
          field: "hours",
          sortable: true,
          filter: true,
          resizable: true,
          width: 80,
          minWidth: 80,
        },
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
            return (
              <div className="flex items-center gap-1.5">
                <span>{country}</span>
                <span className="country-flag">{getCountryFlag(country)}</span>
              </div>
            );
          },
        },
        {
          headerName: "Impact",
          field: "impact",
          sortable: true,
          filter: "agTextColumnFilter",
          resizable: true,
          cellRenderer: (params) => {
            //const filledStarSvg = <Icon id="star-fill-icon" className="h-4 w-4" />;
            //const emptyStarSvg = <Icon id="star-outline-icon" className="h-4 w-4" />;
            const filledStar = <span>★</span>;
            const emptyStar = <span>☆</span>;
            return (
              <span className="flex items-center gap-1">
                {params.value >= 1 ? filledStar : emptyStar}
                {params.value >= 2 ? filledStar : emptyStar}
                {params.value >= 3 ? filledStar : emptyStar}
              </span>
            );
          },
        },
        {
          headerName: "Event",
          field: "event",
          sortable: true,
          filter: "agTextColumnFilter",
          resizable: true,
          cellRenderer: (params) => {
            return (
              <span>
                {params.value}
                {params.data.eventMonth && (
                  <span className="uppercase text-light-400">
                    {" "}
                    ({params.data.eventMonth})
                  </span>
                )}
              </span>
            );
          },
        },
        {
          headerName: "Actual",
          field: "actual",
          sortable: false,
          filter: "agTextColumnFilter",
          resizable: true,
        },
        {
          headerName: "Previous",
          field: "previous",
          sortable: false,
          filter: "agTextColumnFilter",
          resizable: true,
        },
        {
          headerName: "Consensus",
          field: "consensus",
          sortable: false,
          filter: "agTextColumnFilter",
          resizable: true,
        },
        {
          headerName: "Forecast",
          field: "forecast",
          sortable: false,
          filter: "agTextColumnFilter",
          resizable: true,
        },
      ] as ColDef[]
    ).map((column) => {
      if (!column?.filterParams) {
        column.filterParams = {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        };
      }
      return column;
    });
  }, [tableData?.length]);

  const exportData = useMemo(() => {
    if (!tableData) return null;
    return tableData.map((item) => ({
      Date: dayjs(item.date).format("YYYY-MM-DD"),
      Hours: item.hours,
      Country: `${item.country} ${getCountryFlag(item.country)}`,
      Impact: { 1: "Low", 2: "Medium", 3: "High" }[item.impact] ?? "Low",
      Event: `${item.event} ${item.eventMonth ? `(${item.eventMonth})` : ""}`,
      Actual: item.actual,
      Previous: item.previous,
      Consensus: item.consensus,
      Forecast: item.forecast,
    }));
  }, [tableData]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  const contextMenuItems = useCallback(
    (params) =>
      getContextMenuItems(params, { widgetId: widget?.id, enableChart: false }),
    [],
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={tableData}
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      error={tableData?.length === 0 ? "No data found" : error}
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(exportData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(exportData, title, "excel", false);
        },
      }}
      elementNextToTitle={
        <>
          <NewAdvancedSelect
            selected={widget.storage?.countries ?? null}
            label="Countries"
            onSelect={(val) => {
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  countries: val,
                  params: {
                    ...(prev.storage?.params || {}),
                    country: val,
                  },
                },
              }));
            }}
            values={[
              {
                label: "All countries",
                value: null,
              },
              {
                label: "G7 Countries",
                value: "united states,united kingdom,germany,france,italy,canada,japan",
              },
              {
                label: "G20 Countries",
                value:
                  "argentina,australia,brazil,canada,china,france,germany,india,indonesia,italy,japan,mexico,russia,saudi arabia,south africa,south korea,turkey,united kingdom,united states",
              },
              {
                label: "BRICS Countries",
                value: "brazil,russia,india,china,south africa",
              },
              {
                label: "Asia",
                value:
                  "japan,china,india,south korea,israel,singapore,indonesia,saudi arabia,united arab emirates,taiwan,kazakhstan,kyrgyzstan,georgia,hong kong,sri lanka,malaysia,myanmar,philippines,pakistan,bangladesh,nepal,bhutan,maldives",
              },
              {
                label: "Europe",
                value:
                  "germany,united kingdom,france,italy,spain,netherlands,switzerland,poland,sweden,belgium,austria,norway,denmark,finland,ireland,portugal,czech republic,romania,greece,hungary,slovakia,luxembourg,bulgaria,croatia,lithuania,slovenia,latvia,estonia,euro area",
              },
              {
                label: "North America",
                value:
                  "united states,canada,mexico,dominican republic,costa rica,el salvador",
              },
              {
                label: "South America",
                value:
                  "brazil,argentina,colombia,chile,peru,venezuela,ecuador,bolivia,paraguay,uruguay,guyana,suriname",
              },
              {
                label: "Africa",
                value:
                  "south africa,egypt,nigeria,algeria,angola,morocco,tunisia,tanzania,kenya,uganda,ghana,ethiopia,zimbabwe,burundi,rwanda,mozambique,mauritius",
              },
              {
                label: "Middle East",
                value:
                  "saudi arabia,united arab emirates,israel,qatar,kuwait,bahrain,oman,jordan,lebanon,iraq,iran",
              },
              {
                label: "South Asia",
                value: "india,pakistan,bangladesh,sri lanka,nepal,bhutan,maldives",
              },
              {
                label: "United States",
                value: "united states",
              },
              {
                label: "United Kingdom",
                value: "united kingdom",
              },
              {
                label: "Germany",
                value: "germany",
              },
              {
                label: "France",
                value: "france",
              },
              // ... add more as needed
            ]}
          />
          <NewAdvancedSelect
            selected={widget.storage?.recent ?? null}
            label="Recent"
            onSelect={(val) => {
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  recent: val,
                },
              }));
            }}
            values={[
              {
                label: "All events",
                value: null,
              },
              {
                label: "Today",
                value: "today",
              },
              {
                label: "Yesterday",
                value: "yesterday",
              },
              {
                label: "Tomorrow",
                value: "tomorrow",
              },
              {
                label: "This week",
                value: "this week",
              },
              {
                label: "Next week",
                value: "next week",
              },
              {
                label: "This month",
                value: "this month",
              },
              {
                label: "Next month",
                value: "next month",
              },
            ]}
          />
          <NewAdvancedSelect
            selected={widget.storage?.importance ?? null}
            label="Importance"
            onSelect={(val) => {
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  importance: val,
                  params: {
                    ...(prev.storage?.params || {}),
                    importance: val,
                  },
                },
              }));
            }}
            values={[
              {
                label: "All events",
                value: null,
              },
              {
                label: "High",
                value: "high",
              },
              {
                label: "Medium",
                value: "medium",
              },
              {
                label: "Low",
                value: "low",
              },
            ]}
          />
          <NewAdvancedSelect
            selected={widget.storage?.category ?? null}
            label="Category"
            onSelect={(val) => {
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  category: val,
                  params: {
                    ...(prev.storage?.params || {}),
                    group: val,
                  },
                },
              }));
            }}
            values={[
              {
                label: "All events",
                value: null,
              },
              {
                label: "Interest rate",
                value: "interest rate",
              },
              {
                label: "Inflation",
                value: "inflation",
              },
              {
                label: "Bonds",
                value: "bonds",
              },
              {
                label: "Consumer",
                value: "consumer",
              },
              {
                label: "GDP",
                value: "gdp",
              },
              {
                label: "Government",
                value: "government",
              },
              {
                label: "Housing",
                value: "housing",
              },
              {
                label: "Labour",
                value: "labour",
              },
              {
                label: "Markets",
                value: "markets",
              },
              {
                label: "Money",
                value: "money",
              },
              {
                label: "Prices",
                value: "prices",
              },
              {
                label: "Trade",
                value: "trade",
              },
              {
                label: "Business",
                value: "business",
              },
            ]}
          />
          <NewAdvancedSelect
            selected={widget.storage?.timezone ?? null}
            label="Timezone"
            onSelect={(val) => {
              updateWidget((prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  timezone: val,
                },
              }));
            }}
            values={
              TIMEZONE_OPTIONS.some(
                (option) => option.value === widget.storage?.timezone,
              ) || !widget.storage?.timezone
                ? TIMEZONE_OPTIONS
                : [
                    ...TIMEZONE_OPTIONS,
                    {
                      label: widget.storage?.timezone,
                      value: widget.storage?.timezone,
                    },
                  ]
            }
          />
        </>
      }
    >
      <div className={"h-[calc(100%-5px)] min-h-[100px]"}>
        <AgGridProvider
          enableCharts={false}
          rowData={tableData}
          gridOptions={gridOptions}
          getContextMenuItems={contextMenuItems}
          columnDefs={columnDefs}
        />
      </div>
    </DraggableCard>
  );
}

const TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "Eastern Time - EST", value: "America/New_York" },
  { label: "Central Time - CST", value: "America/Chicago" },
  { label: "Mountain Time - MST", value: "America/Denver" },
  { label: "Pacific Time - PST", value: "America/Los_Angeles" },
  { label: "London - GMT", value: "Europe/London" },
  { label: "Berlin - CET", value: "Europe/Berlin" },
  { label: "Moscow - MSK", value: "Europe/Moscow" },
  { label: "Tokyo - JST", value: "Asia/Tokyo" },
  { label: "Sydney - AEDT", value: "Australia/Sydney" },
];

export function processEconomicCalendarData(
  queryData: OBBjectEconomicCalendar,
  widget: WidgetT,
) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const timezone = widget.storage?.timezone || "America/New_York";

  const rowData = data.map((item) => ({
    date: dayjs(item.date).tz(timezone).format("YYYY-MM-DD"),
    hours: dayjs(item.date).tz(timezone).format("hh:mm A"),
    country: item.country,
    impact: { Low: 1, Medium: 2, High: 3 }[item.importance] ?? "Low",
    event: item.event,
    eventMonth: dayjs(item.ReferenceDate).isValid()
      ? dayjs(item.ReferenceDate)?.tz(timezone).format("MMM")
      : "",
    actual: item.actual,
    previous: item.previous,
    consensus: item.consensus,
    forecast: item.forecast,
  }));

  return { rowData };
}
