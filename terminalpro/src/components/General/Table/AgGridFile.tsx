import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { get } from "lodash";
import Papa, { type ParseConfig } from "papaparse";
import { useCallback, useEffect, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useJsonData } from "~/lib/api";
import type { Widget } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, formatNumberNoMagnitude, magnitudeRegex, numberRegex } from "~/lib/utils";
import { getColumnDefs, getContextMenuItems, onPivotModeChanged } from "./AgGridUtils";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "./Chart/hooks/useChartOptions";
import { AgGridProvider, getSideBarOptions, useAgGridContext } from "./hooks";
import type { AgGridEvents } from "./hooks/types";
import { useColumnVisibility } from "./hooks/useColumnVisibility";
import { useCopilotFilteredWidgetData } from "./hooks/useCopilotFilteredData";
import TableSettings, { type EnableSettings } from "./SubMenus/TableSettings";
import { getTableData } from "./utils";

async function getCSVData(data: string, resolve: (value: object[]) => void) {
  const config = {
    transformHeader(header, index) {
      const newHeader = header.trim();
      if (newHeader === "") {
        return `Column ${index + 1}`;
      }
      return newHeader;
    },
    complete: (result: { data: object[] }) => {
      // Check if the CSV has a single column
      const isSingleColumn =
        result.data.length > 0 && Object.keys(result.data[0]).length === 1;

      // This filter prevents Papa Parse from adding an extra blank row to the end
      const final = result.data.filter((value) => {
        // If it's a single-column CSV, just check if the value is not an empty string
        if (isSingleColumn) {
          return Object.values(value)[0] !== "";
        }
        // Otherwise, apply the original filter logic
        return !(Object.keys(value).length < 2 && Object.values(value)[0] !== "");
      });
      resolve(final);
    },
    header: true,
    dynamicTyping: true,
  } as ParseConfig;
  Papa.parse(data, config);
}

async function getExcelWorkBook(
  arrayBuffer: ArrayBuffer,
  resolve: (args: { workbook: ExcelJS.Workbook; sheets: Sheet[] }) => void,
  reject: (reason?: any) => void,
) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheets = workbook.worksheets
      .filter((sheet) => sheet.name !== "EPMFormattingSheet")
      .map((sheet) => ({
        name: sheet.name,
        id: sheet.id,
      }));

    resolve({ workbook, sheets });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    reject(new Error("Error processing Excel file"));
  }
}

function getCellValue(cell: ExcelJS.Cell) {
  let value = cell?.result ? cell?.result : cell?.value;

  // cool regex to match things like integers, decimals, scientific notation
  if (typeof value === "string") {
    if (value.match(numberRegex)) {
      value = Number.parseFloat(value);
    } else if (value.match(magnitudeRegex)) {
      value = formatNumberNoMagnitude(value);
    }
  }

  if (value instanceof Date) {
    value = dayjs(value).format("YYYY-MM-DD");
  }

  // @ts-expect-error
  if (cell?.result?.error) return null;

  return cell?.formula ? cell?.result : value;
}

async function getExcelData(
  workbook: ExcelJS.Workbook,
  currentSheet: Sheet,
  setData: (value: object[]) => void,
  reject?: (reason?: any) => void,
) {
  try {
    const worksheet = workbook.getWorksheet(currentSheet.id);
    let headerRow: ExcelJS.Row | null = null;
    let headerRowNumber = 0;
    const hasValue = new Set<string>();

    const result = [];
    worksheet.eachRow((row, rowNumber) => {
      // Find the header row
      if (!headerRow) {
        const headers = [];
        row.eachCell((cell) => {
          const result = cell.result ? cell.result : cell.value;

          if (![null, undefined].some((value) => value === result)) {
            headers.push(result);
          }
        });

        if (headers.length > 1) {
          headerRow = row;
          headerRowNumber = rowNumber + 1;

          const firstRowData = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const colName = getCellValue(cell);

            const key: string = JSON.stringify(
              colName ? colName : `Column ${colNumber}`,
            );

            const nextRow = worksheet.getRow(rowNumber + 1);
            const nextCell = nextRow.getCell(colNumber);
            const newValue = getCellValue(nextCell);

            worksheet
              .getColumn(colNumber)
              .eachCell(
                { includeEmpty: true },
                (cell, _colNumber) => getCellValue(cell) && hasValue.add(key),
              );

            if (newValue !== undefined) firstRowData[key] = newValue;
          });

          result.push(firstRowData);
          return;
        }
      }
      if (rowNumber <= headerRowNumber) return;

      const obj: Record<string, any> = {};

      if (!headerRow) return;

      row.eachCell((cell, colNumber) => {
        const headerCell = headerRow.findCell(colNumber);
        const colName = getCellValue(headerCell);

        const key: string = JSON.stringify(colName ? colName : `Column ${colNumber}`);

        obj[key] = getCellValue(cell);
      });

      result.push(obj);
    });

    for (const [key, value] of Object.entries(result[0] || {})) {
      if (!hasValue.has(key)) {
        delete result[0][key];
      }
    }

    setData(result);
  } catch (error) {
    console.error("Error processing Excel file:", error);
    reject?.(`Error processing Excel file: ${error?.message}`);
  }
}

export default function AgGridFile() {
  const { widget, updateWidget } = useWidgetContext();
  const gridRef = useAgGridContext()?.gridRef;
  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);

  const chartView = widget.storage?.chartView?.enabled;
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;
  const currentSheet = widget?.storage?.currentSheet as Sheet;
  const fileType = getFileType(widget.endpoint.url);

  // API Loading information
  const [state, dispatch] = useStateReducer<AgGridFileState>({
    sheetData: null,
    decimalDigitsSettings: decimalDigitsToUse,
    enableSettings: {
      enableStats: !!widget.storage?.enableStats,
      enableAdvanced: !!widget.storage?.enableAdvanced,
      enablePagination: widget.storage?.enablePagination,
      enableFormulas: !!widget.storage?.enableFormulas,
    },
  });

  const setCurrentSheet = useCallback(
    (sheet: Sheet) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          currentSheet: sheet,
        },
      }));
    },
    [updateWidget],
  );

  const { isLoading, error, data, dataUpdatedAt } = useJsonData<
    { workbook: ExcelJS.Workbook; sheets: Sheet[] } | object[]
  >(
    {
      url: widget.endpoint.url,
      addBearerToken: true,
      responseCb: async (response, resolve, reject) => {
        if (fileType === FileType.xls) {
          return reject(
            new Error("XLS files are not supported. Please convert to XLSX format."),
          );
        }
        if (fileType === FileType.json) {
          const data = await response.json();
          const dataKey = widget?.data?.dataKey;
          const results = get(data, dataKey, data);

          return resolve(Array.isArray(results) ? results : [results]);
        }
        if (fileType === FileType.csv) {
          return getCSVData(await response.text(), resolve);
        }

        if (fileType === FileType.xlsx) {
          return getExcelWorkBook(await response.arrayBuffer(), resolve, reject);
        }

        reject("Unsupported file type");
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  useEffect(() => {
    if (!isExcelFile(data)) return;
    const { workbook, sheets } = data;

    const tempSheet =
      sheets.find((sheet) => sheet.name === currentSheet?.name) ?? sheets[0];

    getExcelData(workbook, tempSheet, (value) => dispatch({ sheetData: value }));
  }, [data, currentSheet, dispatch]);

  const rowData = useMemo(() => {
    const finalData = isExcelFile(data) ? state.sheetData : data;
    if (!finalData) return [];

    return getTableData(finalData, { external: true } as Widget);
  }, [data, state.sheetData]);

  const columnDefs = useMemo(() => {
    if (rowData) {
      const fakeWidget = {
        external: true,
        storage: { enableAdvanced: state.enableSettings.enableAdvanced },
      };
      return getColumnDefs(rowData, fakeWidget, decimalDigitsToUse).map((column) => {
        // Need to remove quotes from the column header name
        column.headerName = column.headerName?.replace(/"/g, "");
        return column;
      });
    }
    return [];
  }, [rowData, decimalDigitsToUse, state.enableSettings.enableAdvanced]);

  const handleSave = useColumnVisibility(
    state.decimalDigitsSettings,
    state.enableSettings,
  );

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: widget?.id }),
    [],
  );

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();
  useCopilotFilteredWidgetData(rowData, dataUpdatedAt, fileType);

  const gridOptions = useMemo(() => {
    const sideBar = getSideBarOptions(widget.storage);

    return {
      statusBar: widget.storage.enableStats
        ? {
            statusPanels: [
              {
                statusPanel: "agAggregationComponent",
                statusPanelParams: {
                  aggFuncs: ["count", "sum", "min", "max", "avg", "ma20"],
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
    widget.storage.enableStats,
    widget.storage.enableAdvanced,
    widget.storage.enableFormulas,
    widget.storage.openedToolPanel,
    widget.storage.isPivotMode,
  ]);

  const onColumnPivotModeChanged = useCallback(
    (event: AgGridEvents) => onPivotModeChanged(event, updateWidget),
    [updateWidget],
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settings={dropdownSettings}
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
      elementRightNextToTitle={
        isExcelFile(data) && (
          <NewAdvancedSelect
            values={data.sheets.map((sheet) => ({
              label: sheet.name,
              value: sheet.id.toString(),
            }))}
            selected={currentSheet?.id.toString()}
            onSelect={(value) => {
              const sheet = data.sheets.find((sheet) => sheet.id.toString() === value);
              if (sheet) {
                setCurrentSheet(sheet);
              }
            }}
            label={currentSheet?.name ?? "Sheet"}
          />
        )
      }
      loading={isLoading}
      exportFns={{
        csvFunction: (title = "report") => {
          gridRef.current?.api.exportDataAsCsv({
            fileName: `${title}.csv`,
          });
        },
        excelFunction: (title = "report") => {
          gridRef.current?.api.exportDataAsExcel({
            fileName: `${title}.xlsx`,
          });
        },
      }}
      extraNavbarElements={!!widget?.storage?.chartView && <ChartViewButton />}
      error={error || rowData?.length === 0}
      errorMessage={error?.message}
      extraSettings={[
        {
          icon: "uil-arrows-resize",
          id: "autosize-columns",
          label: "Autosize columns",
          onClick: () => gridRef.current?.api?.autoSizeAllColumns(),
        },
        {
          icon: "radix-icons-reset",
          id: "reset-columns",
          label: "Reset columns",
          onClick: () => {
            gridRef.current?.api?.resetColumnState();
            gridRef.current?.api?.resetColumnGroupState();
            gridRef.current?.api?.autoSizeAllColumns();
          },
        },
        ...(chartView ? ChartToolPanelActions : []),
      ]}
    >
      {chartView && <ChartViewElement />}

      <div
        className={cn("grid", {
          "h-[calc(100%-5px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridProvider
          columnDefs={columnDefs}
          rowData={rowData}
          getContextMenuItems={contextMenuItems}
          paginationPageSizeSelector={[100, 500, 1000, 5000]}
          gridOptions={gridOptions}
          onColumnPivotModeChanged={onColumnPivotModeChanged}
          {...agChartViewProps}
        />
      </div>
    </DraggableCard>
  );
}

const dropdownSettings = {
  showSettings: true,
  showFunctions: false,
  showShare: true,
  showDuplicate: true,
  showExport: true,
  showMaximize: true,
  showMove: true,
};

type Sheet = {
  name: string;
  id: number;
};

enum FileType {
  json = "json",
  xlsx = "xlsx",
  csv = "csv",
  xls = "xls",
}

type AgGridFileState = {
  sheetData: object[] | null;
  decimalDigitsSettings: number;
  enableSettings?: EnableSettings;
};

function getFileType<T extends string>(url: T): FileType {
  const extension = url.split(".").pop() as keyof typeof FileType;

  return FileType[extension];
}

function isExcelFile(
  data: any,
): data is { workbook: ExcelJS.Workbook; sheets: Sheet[] } {
  return data?.workbook instanceof ExcelJS.Workbook;
}
