import * as Progress from "@radix-ui/react-progress";
import type { ColDef } from "ag-grid-community";
import clsx from "clsx";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import {
  determineFilterType,
  getContextMenuItems,
} from "~/components/General/Table/AgGridUtils";
import {
  AgGridProvider,
  useAgExportFuncs,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { HoverPopover } from "~/components/HoverPopover";
import { useWidgetContext } from "~/components/Widget.context";
import { useProPriceTargetByAnalyst } from "~/lib/api/sdkComponents";
import type { BenzingaAnalystSearchData as BenzingaAnalystSearch } from "~/lib/api/sdkSchemas";
import { cn, formatNumber } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

const SmartScoreGauge = ({ score }) => {
  return (
    <div className="dark:bg-[#2A2A31] text-light-900 dark:text-light-50 bg-light-50 flex items-center justify-between flex-col rounded gap-1 mb-2 h-20 py-2">
      <p className="body-xs-bold">Smart score</p>
      <div className="space-y-2 w-full flex items-center justify-center flex-col">
        <Progress.Root
          className="relative overflow-hidden rounded-full bg-light-200 dark:bg-dark-400 w-[80%] h-4"
          style={{
            // Fix overflow clipping in Safari
            // https://gist.github.com/domske/b66047671c780a238b51c51ffde8d3a0
            transform: "translateZ(0)",
          }}
          value={score}
        >
          <Progress.Indicator
            className={clsx(
              "w-full h-full transition-transform duration-[660ms] ease-[cubic-bezier(0.65, 0, 0.35, 1)]",
              {
                "bg-[#DC2626]": score < 25,
                "bg-[#F97316]": score >= 25 && score < 50,
                "bg-[#FFED00]": score >= 50 && score < 75,
                "bg-[#22C55E]": score >= 75,
              },
            )}
            style={{
              transform: `translateX(-${
                100 - (score < 0 ? 0 : score > 100 ? 100 : score)
              }%)`,
            }}
          />
        </Progress.Root>
        <span>{score.toFixed(0)}%</span>
      </div>
    </div>
  );
};

function AnalystScore({ data }: { data: BenzingaAnalystSearch }) {
  if (!data) return null;

  const triggerClassName = cn("rounded-[12px] px-1.5 text-xs h-[18px]", {
    "bg-[#EF44444D] text-[#DC2626] dark:bg-[#EF44444D] dark:text-[#FCA5A5]":
      data.smart_score >= 0 && data.smart_score < 25,
    "bg-[#FB923C4D] text-[#EA580C] dark:bg-[#FB923C4D] dark:text-[#FDBA74]":
      data.smart_score >= 25 && data.smart_score < 50,
    "bg-[#DFD1104D] text-[#998E00] dark:bg-[#B3A9184D] dark:text-[#FFF466]":
      data.smart_score >= 50 && data.smart_score < 75,
    "bg-[#6EE99B4D] text-[#16A34A] dark:bg-[#22C55E4D] dark:text-[#86EFAC]":
      data.smart_score >= 75 && data.smart_score <= 100,
  });

  const popoverContent = (
    <>
      <SmartScoreGauge score={data.smart_score} />
      <div className="space-y-2">
        {[
          { title: "Firm Name", value: data.firm_name },
          {
            title: "Overall Avg Return",
            value: `${(data.overall_average_return * 100)?.toFixed(2) ?? "N/A"}%`,
          },
          {
            title: "Overall Avg Return Percentile",
            value: `${(data.overall_avg_return_percentile * 100)?.toFixed(2) ?? "N/A"}%`,
          },
          { title: "Total Ratings", value: data.total_ratings?.toString() ?? "N/A" },
          {
            title: "Overall Success Rate",
            value: `${(data.overall_success_rate * 100)?.toFixed(2) ?? "N/A"}%`,
          },
        ].map((item) => (
          <p key={item.title}>
            <strong>{item.title}:</strong> {item.value}
          </p>
        ))}
      </div>
    </>
  );

  return (
    <HoverPopover
      trigger={`${data.smart_score.toFixed(0)}%`}
      content={popoverContent}
      triggerClassName={triggerClassName}
    />
  );
}

export default function PriceTargetByAnalyst() {
  const widget = useWidgetContext()?.widget;

  const { data, isLoading, error, dataUpdatedAt } = useProPriceTargetByAnalyst(
    {
      queryParams: {
        provider: "pro",
        symbol: widget.data?.mainTicker?.symbol,
      },
    },
    {
      enabled: widget.data?.mainTicker?.symbol !== undefined,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const tableData = useMemo(() => {
    if (!data?.results?.length) return null;
    return data.results;
  }, [data?.results]);

  const gridRef = useAgGridContext()?.gridRef;

  const columnDefs = useMemo(() => {
    if (!tableData) return null;
    return (
      [
        {
          headerName: "Date",
          field: "published_date",
          minWidth: 80,
          width: 90,
          sortable: true,
          filter: "agDateColumnFilter",
          resizable: true,
          flex: 1,
          valueFormatter: (params) => dayjs(params.value).format("YYYY-MM-DD"),
        },
        {
          headerName: "Analyst Name",
          field: "analyst_name",
          minWidth: 200,
          sortable: true,
          resizable: true,
          flex: 1,
          cellRenderer: (params) => (
            <span className="inline-flex items-center justify-between w-full gap-1">
              {params.value}{" "}
              <AnalystScore data={params.data.analyst_data as BenzingaAnalystSearch} />
            </span>
          ),
        },
        {
          headerName: "Firm Name",
          field: "analyst_firm",
          minWidth: 120,
          sortable: true,
          resizable: true,
          flex: 1,
        },
        {
          headerName: "Adjusted Price Target",
          field: "adj_price_target",
          minWidth: 120,
          width: 120,
          sortable: true,
          valueFormatter: (params) => params.value,
          type: "numericColumn",
          filter: "agNumberColumnFilter",
          resizable: true,
          flex: 1,
          cellRenderer: (params) => {
            if (!(params.data.price_target_previous && params.data.price_target))
              return <span>{params.value}</span>;
            return (
              <span
                className={clsx({
                  "text-[#22C55E] dark:text-[#4ADE80]":
                    params.data.price_target > params.data.price_target_previous,
                  "text-[#DC2626] dark:text-[#EF4444]":
                    params.data.price_target < params.data.price_target_previous,
                })}
              >
                {formatNumber(params.value, 2)}
              </span>
            ); // No class change if equal or no previous price target
          },
        },
        {
          headerName: "Adjusted Previous Price Target",
          field: "previous_adj_price_target",
          minWidth: 180,
          sortable: true,
          valueFormatter: (params) => formatNumber(params.value, 2),
          type: "numericColumn",
          filter: "agNumberColumnFilter",
          resizable: true,
          flex: 1,
        },
        {
          headerName: "Rating Change",
          field: "action",
          minWidth: 120,
          sortable: true,
          resizable: true,
          flex: 1,
        },
        {
          headerName: "Current Rating",
          field: "rating_current",
          minWidth: 120,
          sortable: true,
          resizable: true,
          flex: 1,
        },
        {
          headerName: "Previous Rating",
          field: "rating_previous",
          minWidth: 120,
          sortable: true,
          resizable: true,
          flex: 1,
        },
        {
          headerName: "Analyst Data",
          field: "analyst_data",
          hide: true,
          chartDataType: "excluded",
          valueFormatter: (params) => {
            return params.value?.name_full;
          },
        },
      ] as ColDef[]
    ).map((column) => {
      if (!column?.filterParams) {
        column.filterParams = {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        };
      }
      if (!column?.filter) {
        column.filter = determineFilterType(
          column.cellDataType as any,
          column.field,
          tableData?.find((item) => item[column.field])?.[column.field],
        );
      }
      return column;
    }) as ColDef[];
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

  const memoizedAgGrid = useMemo(() => {
    if (!tableData) return null;
    return (
      <AgGridProvider
        enableCharts={false}
        getContextMenuItems={contextMenuItems}
        extraClassName="row-span-3"
        rowData={tableData}
        gridOptions={gridOptions}
        columnDefs={columnDefs}
      />
    );
  }, [tableData, columnDefs]);

  const exportFns = useAgExportFuncs();
  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" />,
    [],
  );

  return (
    <DraggableCard
      aiData={tableData}
      aiEnabled={true}
      extraClassName="space-y-2"
      lastUpdated={dataUpdatedAt}
      exportFns={exportFns}
      elementRightNextToTitle={elementRightNextToTitle}
      loading={isLoading}
      error={error}
    >
      <div className="grid h-[calc(100%-24px)]">{memoizedAgGrid}</div>
      <HideOnResize>
        <p className="text-light-300 dark:text-light-600 text-xs">
          {widget.data?.mainTicker?.currency &&
            `Current Currency: ${widget.data?.mainTicker?.currency}`}
        </p>
      </HideOnResize>
    </DraggableCard>
  );
}
