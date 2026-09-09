import { useCallback, useMemo } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard from "~/components/DraggableCard";
import {
  getColumnDefs,
  getContextMenuItems,
  isDateorYearField,
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
  getSideBarOptions,
  useColumnVisibility,
} from "~/components/General/Table/hooks";
import { useCopilotFilteredWidgetData } from "~/components/General/Table/hooks/useCopilotFilteredData";
import TableSettings, {
  type EnableSettings,
} from "~/components/General/Table/SubMenus/TableSettings";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, parseValue } from "~/lib/utils";

type CopilotTableState = {
  decimalDigitsSettings: number;
  enableSettings: EnableSettings;
};

export default function CopilotTable() {
  const widget = useWidgetContext()?.widget;
  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const chartView = widget.storage?.chartView?.enabled;

  const [state, dispatch] = useStateReducer<CopilotTableState>({
    decimalDigitsSettings: decimalDigitsToUse,
    enableSettings: {
      enableStats: !!widget.storage?.enableStats,
      enableAdvanced: !!widget.storage?.enableAdvanced,
      enablePagination: widget.storage?.enablePagination,
      enableFormulas: !!widget.storage?.enableFormulas,
    },
  });

  const rowData = useMemo(() => {
    return widget.storage.rowsData.map((row) => {
      return Object.keys(row).reduce((acc, key) => {
        if (isDateorYearField(key)) {
          acc[key] = row[key];
          return acc;
        }

        acc[key] = parseValue(row[key]);
        return acc;
      }, {});
    });
  }, [widget.storage.rowsData]);

  const columnDefs = useMemo(() => {
    return getColumnDefs(rowData, {
      data: { table: { columnsDefs: widget?.storage?.columnDefs } },
      storage: widget?.storage,
    });
  }, [rowData, widget?.storage?.enableAdvanced]);

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: widget?.id }),
    [],
  );
  const gridOptions = useMemo(() => {
    const sideBar = getSideBarOptions(widget.storage);
    return {
      statusBar: widget.storage?.enableStats
        ? {
            statusPanels: [
              {
                statusPanel: "agAggregationComponent",
                statusPanelParams: {
                  aggFuncs: ["count", "sum", "min", "max", "avg"],
                },
              },
              {
                statusPanel: "agTotalRowCountComponent",
              },
            ],
          }
        : undefined,
      sideBar,
    };
  }, [
    widget.storage?.enableStats,
    widget.storage?.enableAdvanced,
    widget.storage?.enableFormulas,
    widget.storage?.openedToolPanel,
    widget.storage?.isPivotMode,
  ]);

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();
  useCopilotFilteredWidgetData(rowData);

  const handleSave = useColumnVisibility(
    state.decimalDigitsSettings,
    state.enableSettings,
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={state.decimalDigitsSettings}
          setDecimalDigitsSettings={(decimalDigitsSettings) =>
            dispatch({ decimalDigitsSettings })
          }
          enableSettings={state.enableSettings}
          setEnableSettings={(enabled) =>
            dispatch({ enableSettings: (prev) => ({ ...prev, ...enabled }) })
          }
        />
      }
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(widget.storage.rowsData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(widget.storage.rowsData, title, "excel", false);
        },
      }}
      extraNavbarElements={!!widget?.storage?.chartView && <ChartViewButton />}
      extraSettings={chartView ? ChartToolPanelActions : []}
      settings={{
        showDuplicate: true,
        showExport: true,
        showMove: true,
        showCopyToClipboard: true,
        showMetadata: true,
        showSettings: true,
      }}
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
          columnDefs={columnDefs}
          getContextMenuItems={contextMenuItems}
          gridOptions={gridOptions}
          {...agChartViewProps}
        />
      </div>
    </DraggableCard>
  );
}
