import type { ColDef, GetRowIdParams, GridReadyEvent } from "ag-grid-community";
import dayjs from "dayjs";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import {
  getContextMenuItems,
  getDateFilterParams,
} from "~/components/General/Table/AgGridUtils";
import CellOnHover, {
  type CellOnHoverProps,
} from "~/components/General/Table/CellRenderers/CellOnHover";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { useWidgetContext } from "~/components/Widget.context";
import {
  fetchEquityFundamentalTranscript,
  useEquityFundamentalHistoricalEps,
} from "~/lib/api/sdkComponents";
import { formatNumber } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

const EarningsTranscriptDialog = lazy(() =>
  import("./EarningsTranscript").then((module) => ({
    default: module.EarningsTranscriptDialog,
  })),
);

export default function CompanyEvents() {
  const { widget } = useWidgetContext();
  const { gridRef } = useAgGridContext();

  const hasMockData = widget?.storage?.mockData;

  const { isLoading, data, dataUpdatedAt, error } = useEquityFundamentalHistoricalEps(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: !hasMockData,
      staleTime: 1000 * 60 * 5,
    },
  );

  const tableData = useMemo(() => {
    const removeDuplicates = (arr: any[]) => {
      return arr.filter((v, i, a) => a.findIndex((t) => t.date === v.date) === i);
    };

    const sourceData = hasMockData ? widget.storage.mockData : data?.results;

    return removeDuplicates(
      sourceData
        ?.filter((item) => {
          return item.eps_estimated || item.revenue_estimated;
        })
        .map((item) => ({
          date: item.date,
          eps: item.eps_actual,
          epsEstimated: item.eps_estimated,
          revenue: item.revenue_actual,
          revenueEstimated: item.revenue_estimated,
          fiscalDateEnding: item.period_ending,
          transcriptData: null,
        })) ?? [],
    );
  }, [data, hasMockData, widget?.storage?.mockData]);

  const columnDefs = useMemo(() => {
    if (!tableData) return null;
    return (
      [
        {
          headerName: "Date",
          field: "date",
          type: "numericColumn",
          sortable: true,
          resizable: true,
          cellDataType: "date",
          filter: "agDateColumnFilter",
          filterParams: getDateFilterParams(),
          valueFormatter: (params) => params.value,
        },
        {
          headerName: "EPS",
          field: "eps",
          type: "numericColumn",
          sortable: true,
          filter: true,
          resizable: true,
          chartDataType: "series",
          valueFormatter: (params) => params.value,
          cellRenderer: (params: any) => {
            if (!params.value) return "-";
            const eps = formatNumber(params.value, 4);
            const epsEstimated = params.data?.epsEstimated;
            const options = { colorValue: params.value } as CellOnHoverProps;

            if (eps && epsEstimated) {
              options.color = true;
              options.colorValue = params.value - epsEstimated;
            }

            return (
              <CellOnHover value={eps} title={params.value?.toString()} {...options} />
            );
          },
        },
        {
          headerName: "EPS Est.",
          field: "epsEstimated",
          type: "numericColumn",
          sortable: true,
          filter: true,
          resizable: true,
          chartDataType: "series",
          cellRenderer: (params: any) => {
            if (!params.value) return "-";
            const epsEstimated = formatNumber(params.value, 4);
            return (
              <CellOnHover
                value={epsEstimated}
                title={params.value.toLocaleString()}
                colorValue={params.value}
              />
            );
          },
        },
        {
          headerName: "Revenue",
          field: "revenue",
          type: "numericColumn",
          sortable: true,
          filter: true,
          resizable: true,
          chartDataType: "series",
          valueFormatter: (params) => params.value,
          cellRenderer: (params: any) => {
            if (!params.value) return "-";
            const revenueFormatted = formatNumber(params.value);
            const revenueEstimated = params.data?.revenueEstimated;
            const options = { colorValue: params.value } as CellOnHoverProps;

            if (params.value && revenueEstimated) {
              options.color = true;
              options.colorValue = params.value - revenueEstimated;
            }

            return (
              <CellOnHover
                value={revenueFormatted}
                title={params.value.toLocaleString()}
                {...options}
              />
            );
          },
        },
        {
          headerName: "Revenue Est.",
          field: "revenueEstimated",
          type: "numericColumn",
          sortable: true,
          filter: true,
          resizable: true,
          chartDataType: "series",
        },
        ...(hasMockData
          ? []
          : [
              {
                headerName: "Transcript",
                field: "transcript",
                chartDataType: "excluded",
                cellRenderer: (params: any) => {
                  if (!params.data?.date) return null;
                  if (dayjs(params.data.date).year() < 2007) return null;
                  if (!params.data.transcriptData) return null;
                  return (
                    <Suspense fallback={null}>
                      <EarningsTranscriptDialog
                        mainTicker={widget.data?.mainTicker}
                        earnings_date={params.data.date}
                        transcriptData={params.data.transcriptData}
                      />
                    </Suspense>
                  );
                },
              } as ColDef,
            ]),
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
  }, [tableData, hasMockData]);

  const populateTranscriptData = useCallback(
    async (params: GridReadyEvent, dates: string[], symbol: string) => {
      const uniqueYears = Array.from(
        new Set(dates.map((date) => dayjs(date).year())),
      ).sort((a, b) => b - a);

      if (dayjs().quarter() >= 2 && !uniqueYears.includes(dayjs().year() + 1)) {
        uniqueYears.unshift(dayjs().year() + 1);
      }
      const abortController = new AbortController();
      for (const year of uniqueYears) {
        fetchEquityFundamentalTranscript(
          {
            queryParams: {
              provider: "fmp",
              symbol: symbol,
              year: year,
            },
          },
          abortController.signal,
        )
          .then((transcripts) => {
            if (transcripts?.results?.length) {
              for (const transcript of transcripts.results) {
                const transcriptDate = dayjs(transcript.date).tz("America/New_York");
                for (const date of dates) {
                  if (!ensureAgGrid(params as any)) {
                    abortController.abort();
                    break;
                  }
                  const rowNode = params.api.getRowNode(date);

                  if (
                    transcriptDate.isSame(rowNode.data.date, "day") ||
                    transcriptDate.isSame(rowNode.data.date, "week")
                  ) {
                    rowNode.data.transcriptData = transcript;
                    if (!ensureAgGrid(params as any)) {
                      abortController.abort();
                      break;
                    }
                    params.api.applyTransactionAsync({ update: [rowNode.data] });
                    params.api.refreshCells({ force: true, rowNodes: [rowNode] });
                  }
                }
              }
            }
          })
          .catch((_error) => null);
      }
    },
    [],
  );

  const getRowId = useCallback((params: GetRowIdParams) => {
    return params.data.date;
  }, []);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: widget?.id }),
    [],
  );

  useEffect(() => {
    if (ensureAgGrid(gridRef?.current) && tableData?.length && !hasMockData) {
      gridRef.current.api?.refreshCells({ force: true });
      populateTranscriptData(
        gridRef.current as unknown as GridReadyEvent,
        tableData
          ?.map((item) => item.date)
          .filter((date) => dayjs(date).year() > dayjs().year() - 12) ?? [],
        widget.data?.mainTicker?.symbol,
      );
    }
  }, [tableData, hasMockData]);

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      if (!hasMockData) {
        populateTranscriptData(
          params,
          tableData
            ?.map((item) => item.date)
            .filter((date) => dayjs(date).year() > dayjs().year() - 12) ?? [],
          widget.data?.mainTicker?.symbol,
        );
      }
    },
    [tableData, widget.data?.mainTicker?.symbol, hasMockData],
  );

  return (
    <DraggableCard
      title={widget.name}
      aiData={hasMockData ? widget.storage.mockData : data?.results}
      aiEnabled={true}
      lastUpdated={dataUpdatedAt}
      loading={!hasMockData && isLoading}
      error={tableData?.length === 0 ? "No data" : error}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
    >
      <div className={"grid h-[calc(100%-18px)]"}>
        {tableData?.length > 0 && (
          <AgGridProvider
            getContextMenuItems={contextMenuItems}
            rowData={tableData}
            getRowId={getRowId}
            gridOptions={gridOptions}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
          />
        )}
      </div>
      <HideOnResize>
        <p className="text-light-300 dark:text-light-600 text-xs">
          {widget.data?.mainTicker?.currency &&
            `Current Currency: ${widget.data?.mainTicker?.currency}`}
        </p>
      </HideOnResize>
    </DraggableCard>
  );
}
