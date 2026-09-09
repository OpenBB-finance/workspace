import ExcelJS from "exceljs";
import { useState } from "react";
import type { TreeItem } from "react-complex-tree";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import type { WidgetT } from "~/components/types";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { dispatchSaveState } from "~/lib/utils";

// Helper function to sanitize sheet names
function sanitizeSheetName(name: string): string {
  return (
    name
      .replace(/[\\/?*[\]:]/g, "")
      .substring(0, 31)
      .trim() || "Sheet"
  );
}

// Helper function to format parameter value for Excel
function formatParamValue(value: any): string | boolean | number {
  if (value === undefined || value === null || value === "") return "";

  // Handle boolean values
  if (typeof value === "boolean") return value;

  // Handle string values that might be "true" or "false"
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
    return value.trim();
  }

  // Handle numbers
  if (typeof value === "number") return value;

  // Handle arrays by joining with commas
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(",");
  }

  // For objects, just return empty string
  if (typeof value === "object") return "";

  return String(value);
}

// Helper function to format widget parameters for display
function formatWidgetParams(params: Record<string, any>): string {
  if (!params) return "";

  return Object.entries(params)
    .filter(([_, value]) => {
      const formattedValue = formatParamValue(value);
      return formattedValue !== "";
    })
    .map(([key, value]) => `${key}: ${formatParamValue(value)}`)
    .join("\n");
}

// Helper function to get formula format based on parameter style
function getExplicitParamsFormat(
  widget: WidgetT,
  params: Record<string, any>,
  useExplicit: boolean,
): string {
  // Filter out empty values
  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => {
      const formattedValue = formatParamValue(value);
      return formattedValue !== "";
    }),
  );

  // For BYOD with advanced-backend
  if (widget.connectionType === "advanced-backend") {
    if (useExplicit) {
      const numParams = Object.keys(filteredParams).length;
      return `=OBB.WIDGET("${widget.sourceName}","${widget.widgetId}",A1:B${numParams})`;
    }
    // Implicit format - parameters directly in formula
    const paramString = Object.entries(filteredParams)
      .map(([key, value]) => `"${key}","${formatParamValue(value)}"`)
      .join(";");
    return `=OBB.WIDGET("${widget.sourceName}","${widget.widgetId}",{${paramString}})`;
  }

  // For other functions
  if (useExplicit) {
    const numParams = Object.keys(filteredParams).length;
    return `=OBB.${widget.excelDataFunction?.[0]?.replace("OBB.", "").toUpperCase()}(A1:B${numParams})`;
  }
  // Implicit format - parameters directly in formula
  const paramString = Object.entries(filteredParams)
    .map(([key, value]) => `"${key}","${formatParamValue(value)}"`)
    .join(";");
  return `=OBB.${widget.excelDataFunction?.[0]?.replace("OBB.", "").toUpperCase()}({${paramString}})`;
}

// Helper function to format date for display
function formatDateForDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Helper function to format date for filename
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Helper function to get widget export data
async function getWidgetExportData(widget: WidgetT): Promise<any> {
  try {
    // console.log("Processing widget:", {
    //   name: widget.name,
    //   connectionType: widget.connectionType,
    //   sourceName: widget.sourceName,
    //   widgetId: widget.widgetId,
    //   hasExcelDataFunction: !!widget.excelDataFunction,
    //   hasExportFns: !!widget.exportFns,
    //   hasData: !!widget.data,
    //   params: widget.storage?.params,
    //   endpoint: widget.endpoint,
    // });

    // For advanced-backend widgets
    if (widget.connectionType === "advanced-backend") {
      // Use the widget's endpoint directly
      let endpoint = widget.endpoint?.url;
      if (!endpoint) {
        console.warn("No endpoint found for widget:", widget.name);
        return null;
      }

      // Filter out empty arrays and undefined/null values from parameters
      const filteredParams = Object.fromEntries(
        Object.entries({
          ...(widget.endpoint?.query || {}),
          ...(widget.storage?.params || {}),
        }).filter(([_, value]) => {
          // Skip empty arrays
          if (Array.isArray(value) && value.length === 0) return false;
          // Skip undefined, null, or empty strings
          if (value === undefined || value === null || value === "") return false;
          return true;
        }),
      );

      // Handle GET parameters by appending them to the URL
      if (widget.endpoint?.method === "GET" || !widget.endpoint?.method) {
        const queryString = new URLSearchParams(
          Object.entries(filteredParams).reduce(
            (acc, [key, value]) => {
              // Handle array values by joining them with commas
              if (Array.isArray(value)) {
                acc[key] = value.join(",");
              } else {
                acc[key] = String(value);
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
        ).toString();

        if (queryString) {
          endpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${queryString}`;
        }
      }

      // console.log(`Fetching advanced-backend widget data from: ${endpoint}`, {
      //   widgetName: widget.name,
      //   sourceName: widget.sourceName,
      //   widgetId: widget.widgetId,
      //   params: filteredParams,
      //   method: widget.endpoint?.method || "GET",
      //   headers: widget.endpoint?.headers,
      // });

      try {
        const response = await fetch(endpoint, {
          method: widget.endpoint?.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...(widget.endpoint?.headers || {}),
          },
          body:
            widget.endpoint?.method === "POST"
              ? JSON.stringify(filteredParams)
              : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Advanced-backend API error:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            endpoint,
            widget: widget.name,
          });
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`,
          );
        }

        const data = await response.json();
        // Use dataKey > results > root data
        let finalData: any;
        if (widget.dataKey && data[widget.dataKey] !== undefined) {
          finalData = data[widget.dataKey];
        } else if (data.results !== undefined) {
          finalData = data.results;
        } else {
          finalData = data;
        }

        // Check if the data is empty (null, undefined, empty array, or empty object)
        const isEmpty =
          finalData === null ||
          finalData === undefined ||
          (Array.isArray(finalData) && finalData.length === 0) ||
          (typeof finalData === "object" && Object.keys(finalData).length === 0);

        if (isEmpty) {
          // console.log("No data available for widget:", {
          //   widget: widget.name,
          //   endpoint,
          //   params: filteredParams,
          // });
          // Return a special object indicating no data but preserving parameters
          return {
            _noData: true,
            parameters: filteredParams,
            message: "No data available for the specified parameters",
          };
        }

        // console.log("Advanced-backend API response:", {
        //   widget: widget.name,
        //   dataKeys:
        //     finalData && typeof finalData === "object" ? Object.keys(finalData) : [],
        //   dataPreview: `${JSON.stringify(finalData).substring(0, 200)}...`,
        // });
        return finalData;
      } catch (error) {
        console.error("Advanced-backend fetch error:", {
          widget: widget.name,
          error: error instanceof Error ? error.message : String(error),
          endpoint,
        });
        throw error;
      }
    }

    // For regular widgets with excelDataFunction
    if (widget.excelDataFunction) {
      const functionName = widget.excelDataFunction[0].replace("OBB.", "");
      // Use the pro endpoint for Excel functions
      const endpoint = `/pro/excel/${functionName.toLowerCase()}`;
      // console.log(`Fetching regular widget data from: ${endpoint}`, {
      //   widgetName: widget.name,
      //   functionName,
      //   params: widget.storage?.params,
      // });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(widget.endpoint?.query || {}),
            ...(widget.storage?.params || {}),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Regular widget API error:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            endpoint,
            widget: widget.name,
          });
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`,
          );
        }

        const data = await response.json();
        // Use dataKey > results > root data
        let finalData: any;
        if (widget.dataKey && data[widget.dataKey] !== undefined) {
          finalData = data[widget.dataKey];
        } else if (data.results !== undefined) {
          finalData = data.results;
        } else {
          finalData = data;
        }
        // console.log("Regular widget API response:", {
        //   widget: widget.name,
        //   dataKeys:
        //     finalData && typeof finalData === "object" ? Object.keys(finalData) : [],
        //   dataPreview: `${JSON.stringify(finalData).substring(0, 200)}...`,
        // });
        return finalData;
      } catch (error) {
        console.error("Regular widget fetch error:", {
          widget: widget.name,
          error: error instanceof Error ? error.message : String(error),
          endpoint,
        });
        throw error;
      }
    }

    // For widgets with data directly available
    if (widget.data) {
      // console.log("Using widget's direct data:", {
      //   widget: widget.name,
      //   dataKeys: Object.keys(widget.data),
      //   dataPreview: `${JSON.stringify(widget.data).substring(0, 200)}...`,
      // });
      return widget.data;
    }

    console.warn("No export method found for widget:", {
      widgetName: widget.name,
      connectionType: widget.connectionType,
      hasExcelDataFunction: !!widget.excelDataFunction,
      hasData: !!widget.data,
      endpoint: widget.endpoint?.url,
    });
    return null;
  } catch (error) {
    console.error(`Error getting export data for widget ${widget.name}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      widget: {
        name: widget.name,
        connectionType: widget.connectionType,
        sourceName: widget.sourceName,
        widgetId: widget.widgetId,
        endpoint: widget.endpoint?.url,
      },
    });
    throw error;
  }
}

// Helper function to add data to Excel sheet
function addDataToSheet(sheet: ExcelJS.Worksheet, data: any, startRow = 1) {
  if (!data) return;

  // Handle special case for no data
  if (data._noData === true) {
    // Skip parameter addition since they're already added in the main export logic
    // Just add the message about no data
    const messageRow = startRow;
    sheet.getCell(`A${messageRow}`).value = data.message;
    sheet.getCell(`A${messageRow}`).font = {
      italic: true,
      color: { argb: "FF808080" },
    };
    return;
  }

  // Handle different data structures
  if (Array.isArray(data)) {
    // If data is an array, treat it as rows
    if (data.length === 0) return;

    // Check if this is parameter data (array of [key, value] pairs)
    if (data[0] && Array.isArray(data[0]) && data[0].length === 2) {
      // This is parameter data, add it directly
      data.forEach(([key, value], index) => {
        sheet.getCell(startRow + index, 1).value = key;
        sheet.getCell(startRow + index, 2).value = value as ExcelJS.CellValue;
      });
      // Set both parameter columns to width 30
      sheet.getColumn(1).width = 30;
      sheet.getColumn(2).width = 30;
      return;
    }

    // Get headers from first row if it's an array of objects
    const headers = typeof data[0] === "object" ? Object.keys(data[0]) : ["Value"];

    // Add headers
    headers.forEach((header, colIndex) => {
      const cell = sheet.getCell(startRow, colIndex + 1);
      cell.value = header as ExcelJS.CellValue;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });

    // Add data rows
    data.forEach((row, rowIndex) => {
      if (typeof row === "object") {
        headers.forEach((header, colIndex) => {
          sheet.getCell(startRow + rowIndex + 1, colIndex + 1).value = row[
            header
          ] as ExcelJS.CellValue;
        });
      } else {
        sheet.getCell(startRow + rowIndex + 1, 1).value = row as ExcelJS.CellValue;
      }
    });

    // Set all data columns to width 30
    headers.forEach((_, colIndex) => {
      sheet.getColumn(colIndex + 1).width = 30;
    });
  } else if (typeof data === "object") {
    // If data is an object, create a key-value table
    const entries = Object.entries(data);
    if (entries.length === 0) return;

    // Add data rows directly without headers
    entries.forEach(([key, value], index) => {
      sheet.getCell(startRow + index, 1).value = key;
      sheet.getCell(startRow + index, 2).value =
        typeof value === "object"
          ? JSON.stringify(value)
          : (value as ExcelJS.CellValue);
    });

    // Set both columns to width 30
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 30;
  }
}

// Add this helper function to ensure widget data is loaded
async function ensureWidgetDataLoaded(widget: WidgetT): Promise<boolean> {
  // If widget already has data, return true
  if (widget.data) {
    // console.log("Widget already has data:", {
    //   widgetName: widget.name,
    //   hasData: true,
    // });
    return true;
  }

  // For advanced-backend widgets, try to fetch the data
  if (widget.connectionType === "advanced-backend" && widget.endpoint?.url) {
    // console.log("Fetching data for widget:", {
    //   widgetName: widget.name,
    //   endpoint: widget.endpoint.url,
    // });

    try {
      // Get the latest parameters
      const params = {
        ...(widget.endpoint?.query || {}),
        ...(widget.storage?.params || {}),
        ...(widget.params || {}),
      };

      // Filter out empty values
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, value]) => {
          const formattedValue = formatParamValue(value);
          return (
            formattedValue !== "" &&
            formattedValue !== '""' &&
            formattedValue !== '""' &&
            formattedValue !== "null" &&
            formattedValue !== "undefined"
          );
        }),
      );

      // Handle GET parameters
      let endpoint = widget.endpoint.url;
      if (widget.endpoint?.method === "GET" || !widget.endpoint?.method) {
        const queryString = new URLSearchParams(
          Object.entries(filteredParams).reduce(
            (acc, [key, value]) => {
              if (Array.isArray(value)) {
                acc[key] = value.join(",");
              } else {
                acc[key] = String(value);
              }
              return acc;
            },
            {} as Record<string, string>,
          ),
        ).toString();

        if (queryString) {
          endpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${queryString}`;
        }
      }

      const response = await fetch(endpoint, {
        method: widget.endpoint?.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(widget.endpoint?.headers || {}),
        },
        body:
          widget.endpoint?.method === "POST"
            ? JSON.stringify(filteredParams)
            : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Update widget data
      widget.data =
        widget.dataKey && data[widget.dataKey] !== undefined
          ? data[widget.dataKey]
          : data.results !== undefined
            ? data.results
            : data;

      // console.log("Successfully loaded widget data:", {
      //   widgetName: widget.name,
      //   hasData: true,
      //   dataKeys: Object.keys(widget.data || {}),
      // });

      return true;
    } catch (error) {
      console.error("Failed to load widget data:", {
        widgetName: widget.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // For widgets with excelDataFunction
  if (widget.excelDataFunction) {
    try {
      const functionName = widget.excelDataFunction[0].replace("OBB.", "");
      const endpoint = `/pro/excel/${functionName.toLowerCase()}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(widget.endpoint?.query || {}),
          ...(widget.storage?.params || {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      widget.data =
        widget.dataKey && data[widget.dataKey] !== undefined
          ? data[widget.dataKey]
          : data.results !== undefined
            ? data.results
            : data;

      // console.log("Successfully loaded widget data via excel function:", {
      //   widgetName: widget.name,
      //   hasData: true,
      //   dataKeys: Object.keys(widget.data || {}),
      // });

      return true;
    } catch (error) {
      console.error("Failed to load widget data via excel function:", {
        widgetName: widget.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  console.warn("No data loading method available for widget:", {
    widgetName: widget.name,
    connectionType: widget.connectionType,
    hasExcelDataFunction: !!widget.excelDataFunction,
  });
  return false;
}

// Update the WidgetProgress interface
interface WidgetProgress {
  name: string;
  status: "loading" | "success" | "error";
  phase: "preparing" | "loading" | "exporting" | "complete";
  error?: string;
  phaseTransitioned?: boolean;
}

// Update the ExportProgressDialog component
function ExportProgressDialog({
  open,
  currentWidget,
  processedWidgets,
}: {
  open: boolean;
  currentWidget: string | null;
  processedWidgets: WidgetProgress[];
}) {
  const getPhaseMessage = () => {
    if (!currentWidget) return "";

    // Find the current widget's status
    const currentWidgetStatus = processedWidgets.find((w) => w.name === currentWidget);
    if (!currentWidgetStatus) return "";

    // Just return the widget name
    return currentWidget;
  };

  // Helper function to get current phase
  const getCurrentPhase = () => {
    if (!processedWidgets.length) return "preparing";

    // If any widget is in exporting phase, we're in export phase
    if (
      processedWidgets.some((w) => w.phase === "exporting" || w.phase === "complete")
    ) {
      return "exporting";
    }

    // If any widget is in loading phase, we're in loading phase
    if (processedWidgets.some((w) => w.phase === "loading")) {
      return "loading";
    }

    return "preparing";
  };

  const currentPhase = getCurrentPhase();
  const phaseMessage = getPhaseMessage();

  // Helper function to determine if a phase has started
  const hasPhaseStarted = (phase: string) => {
    switch (phase) {
      case "preparing":
        return true; // Always show preparing phase
      case "loading":
        return processedWidgets.some(
          (w) =>
            w.phase === "loading" || w.phase === "exporting" || w.phase === "complete",
        );
      case "exporting":
        return processedWidgets.some(
          (w) => w.phase === "exporting" || w.phase === "complete",
        );
      default:
        return false;
    }
  };

  // Helper function to get phase status
  const getPhaseStatus = (phase: string) => {
    switch (phase) {
      case "preparing":
        return currentPhase === "preparing" ? "In Progress" : "Complete";
      case "loading": {
        if (currentPhase === "preparing") return "Pending";
        if (currentPhase === "loading") return "In Progress";
        return "Complete";
      }
      case "exporting": {
        if (currentPhase === "preparing" || currentPhase === "loading")
          return "Pending";
        if (currentPhase === "exporting") return "In Progress";
        return "Complete";
      }
      default:
        return "Pending";
    }
  };

  return (
    <BaseDialog open={open} onClose={() => {}}>
      <DialogTitle>Exporting to Excel</DialogTitle>

      <div className="flex flex-col gap-4 py-2">
        {/* Phase Headers */}
        <div className="space-y-4">
          {hasPhaseStarted("preparing") && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="font-bold text-sm text-light-700 dark:text-light-300 w-8">
                  1.
                </div>
                <div className="font-bold text-sm text-light-700 dark:text-light-300">
                  Preparation
                </div>
                <div className="text-sm text-light-600 dark:text-light-400">
                  ({getPhaseStatus("preparing")})
                </div>
              </div>
              {currentPhase === "preparing" && phaseMessage && (
                <div className="text-sm text-light-600 dark:text-light-400 pl-10">
                  {phaseMessage}
                </div>
              )}
            </div>
          )}
          {hasPhaseStarted("loading") && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="font-bold text-sm text-light-700 dark:text-light-300 w-8">
                  2.
                </div>
                <div className="font-bold text-sm text-light-700 dark:text-light-300">
                  Loading
                </div>
                <div className="text-sm text-light-600 dark:text-light-400">
                  ({getPhaseStatus("loading")})
                </div>
              </div>
              {currentPhase === "loading" && phaseMessage && (
                <div className="text-sm text-light-600 dark:text-light-400 pl-10">
                  {phaseMessage}
                </div>
              )}
            </div>
          )}
          {hasPhaseStarted("exporting") && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="font-bold text-sm text-light-700 dark:text-light-300 w-8">
                  3.
                </div>
                <div className="font-bold text-sm text-light-700 dark:text-light-300">
                  Exporting
                </div>
                <div className="text-sm text-light-600 dark:text-light-400">
                  ({getPhaseStatus("exporting")})
                </div>
              </div>
              {currentPhase === "exporting" && phaseMessage && (
                <div className="text-sm text-light-600 dark:text-light-400 pl-10">
                  {phaseMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* List of processed widgets */}
        {processedWidgets.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-light-700 dark:text-light-300">
              Widgets
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {processedWidgets.map((widget, index) => (
                <div
                  key={`${widget.name}-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="flex items-center justify-center w-3 h-3">
                    {widget.status === "success" && (
                      <span className="text-green-500">✓</span>
                    )}
                    {widget.status === "error" && (
                      <span className="text-red-500">✕</span>
                    )}
                  </div>
                  <span
                    className={`${
                      widget.status === "error"
                        ? "text-red-500"
                        : "text-light-600 dark:text-light-200"
                    }`}
                  >
                    {widget.name}
                    {widget.error && (
                      <span className="text-xs text-red-500 ml-2">
                        ({widget.error})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseDialog>
  );
}

// Add back the delay helper function with 200ms default
const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ExcelExportDialog() {
  const { excelExportPopup, setExcelExportPopup, excelExportItem, setExcelExportItem } =
    useShallowThemeStore((state) => ({
      excelExportPopup: state.excelExportPopup,
      setExcelExportPopup: state.setExcelExportPopup,
      excelExportItem: state.excelExportItem,
      setExcelExportItem: state.setExcelExportItem,
    }));

  const { getTabById } = useShallowAppStore((s) => ({
    getTabById: s.getTabById,
  }));

  const { saveDashboards } = useAppStore((state) => ({
    saveDashboards: state.saveDashboards,
  }));

  const [isGenerating, setIsGenerating] = useState(false);
  const [exportType, setExportType] = useState<
    "static" | "dynamic" | "dynamic-explicit"
  >("static");
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [currentWidget, setCurrentWidget] = useState<string | null>(null);
  const [processedWidgets, setProcessedWidgets] = useState<WidgetProgress[]>([]);

  const handleGenerateExcel = async (item: TreeItem<any> & { index: string }) => {
    let exportSuccess = false;
    try {
      setIsGenerating(true);
      const tab = getTabById(item.index);
      // Get all widgets from the dashboard
      let allWidgets: any[] = [];

      if (tab?.data?.widgets) {
        // Get all widgets that are advanced-backend widgets with chartView
        allWidgets = tab.data.widgets.filter(
          (widget) =>
            widget.connectionType === "advanced-backend" &&
            widget.storage?.params &&
            widget?.storage?.chartView,
        );
      }

      if (allWidgets.length === 0) {
        toast.error(
          "No advanced-backend widgets with chart view found in this dashboard",
        );
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "OpenBB Workspace";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties.date1904 = false;

      // Add a dashboard info sheet
      const infoSheet = workbook.addWorksheet("Dashboard Info");

      // Title
      infoSheet.getCell("A1").value = "Dashboard Information";
      infoSheet.getCell("A1").font = { bold: true, size: 14 };

      // Basic Info
      infoSheet.getCell("A3").value = "Name";
      infoSheet.getCell("B3").value = item.data.name;
      infoSheet.getCell("A4").value = "Export Date";
      const exportDate = new Date();
      infoSheet.getCell("B4").value = formatDateForDisplay(exportDate);

      // Check if any widgets are in non-default tabs
      const hasNonDefaultTabs = allWidgets.some(
        (widget) => widget.innerTab && widget.innerTab !== "overview",
      );

      // Get unique tabs including Overview if there are multiple tabs
      const uniqueTabs = Array.from(
        new Set(
          allWidgets
            .map((widget) => widget.innerTab)
            .filter((tab): tab is string => !!tab),
        ),
      );
      const hasMultipleTabs = uniqueTabs.length > 1;

      // Widgets Table Header
      const headers =
        hasNonDefaultTabs || hasMultipleTabs
          ? [
              "Tab",
              "Widget Title",
              "Parameters",
              "Description",
              "Backend Name",
              "Category",
              "Subcategory",
              "Source",
            ]
          : [
              "Widget Title",
              "Parameters",
              "Description",
              "Backend Name",
              "Category",
              "Subcategory",
              "Source",
            ];

      // Add headers starting at row 6
      headers.forEach((header, index) => {
        const cell = infoSheet.getCell(6, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
        };
      });

      // Add widget data
      let currentRow = 7;
      for (const widget of allWidgets) {
        const baseRow = [
          widget.name || "",
          formatWidgetParams(widget.storage?.params || {}),
          widget.description || "",
          widget.sourceName || "",
          widget.category || "",
          widget.subCategory || "",
          widget.source?.[0] || "",
        ];

        const row =
          hasNonDefaultTabs || hasMultipleTabs
            ? [widget.innerTab || (hasMultipleTabs ? "Overview" : ""), ...baseRow]
            : baseRow;

        row.forEach((value, index) => {
          const cell = infoSheet.getCell(currentRow, index + 1);
          cell.value = String(value);
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
            bottom: { style: "thin" },
          };
          cell.alignment = { wrapText: true };
        });

        currentRow++;
      }

      // Set column widths
      if (hasNonDefaultTabs || hasMultipleTabs) {
        infoSheet.getColumn("A").width = 20; // Tab
        infoSheet.getColumn("B").width = 30; // Widget Title
        infoSheet.getColumn("C").width = 40; // Parameters
        infoSheet.getColumn("D").width = 40; // Description
        infoSheet.getColumn("E").width = 15; // Backend Name
        infoSheet.getColumn("F").width = 15; // Category
        infoSheet.getColumn("G").width = 15; // Subcategory
        infoSheet.getColumn("H").width = 20; // Source
      } else {
        infoSheet.getColumn("A").width = 30; // Widget Title
        infoSheet.getColumn("B").width = 40; // Parameters
        infoSheet.getColumn("C").width = 40; // Description
        infoSheet.getColumn("D").width = 15; // Backend Name
        infoSheet.getColumn("E").width = 15; // Category
        infoSheet.getColumn("F").width = 15; // Subcategory
        infoSheet.getColumn("G").width = 20; // Source
      }

      // Freeze the header row
      infoSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6 }];

      // Sort the info sheet
      infoSheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: currentRow - 1, column: headers.length },
      };

      // Create a sheet for each widget
      for (const widget of allWidgets) {
        if (
          !(
            widget.connectionType === "advanced-backend" &&
            widget.storage?.params &&
            widget?.storage?.chartView
          )
        ) {
          continue;
        }

        try {
          // Include tab name in sheet name if there are multiple tabs or if it's not Overview
          const tabSuffix =
            hasMultipleTabs || (widget.innerTab && widget.innerTab !== "overview")
              ? `${widget.innerTab || "Overview"} - `
              : "";
          const sheetName = sanitizeSheetName(`${tabSuffix}${widget.name || "Widget"}`);
          const sheet = workbook.addWorksheet(sheetName);

          if (exportType === "dynamic-explicit" && widget.storage?.params) {
            const params = widget.storage.params;
            // Filter out empty values before creating the sheet
            const filteredParams = Object.fromEntries(
              Object.entries(params).filter(([_, value]) => {
                const formattedValue = formatParamValue(value);
                return (
                  formattedValue !== "" &&
                  formattedValue !== '""' &&
                  formattedValue !== '""'
                );
              }),
            );

            let currentRow = 1;

            // Add parameters directly without headers
            const paramData = Object.entries(filteredParams).map(([key, value]) => [
              key,
              formatParamValue(value),
            ]);

            // Add parameter rows
            paramData.forEach((row, rowIndex) => {
              row.forEach((cell, colIndex) => {
                const excelCell = sheet.getCell(currentRow + rowIndex, colIndex + 1);
                excelCell.value = cell as ExcelJS.CellValue;
              });
            });

            // Set parameter columns to width 20
            sheet.getColumn(1).width = 20;
            sheet.getColumn(2).width = 20;

            // Update current row to be right after parameters (no extra row)
            currentRow += paramData.length;

            // Add formula in the next row (creating exactly one empty row)
            const formula = getExplicitParamsFormat(widget, filteredParams, true);
            const cell = sheet.getCell(`A${currentRow + 1}`);
            cell.value = formula;
            cell.font = { name: "Consolas", size: 11 };
            cell.alignment = { wrapText: true };

            // Move to next row for data (after formula)
            currentRow += 2;

            // For dynamic-explicit, we need to determine the number of columns based on the data structure
            // The formula will return data in a specific format based on the widget type
            // We'll set a reasonable number of columns to width 20
            // Most widgets will return data in a table format with multiple columns
            for (let i = 1; i <= 20; i++) {
              sheet.getColumn(i).width = 20;
            }
          } else {
            // Implicit formula format with parameters directly in the formula
            const params = widget.storage?.params || {};
            const formula = getExplicitParamsFormat(widget, params, false);

            const cell = sheet.getCell("A1");
            cell.value = formula;
            cell.font = { name: "Consolas", size: 11 };
            cell.alignment = { wrapText: true };

            // For dynamic implicit, we need to determine the number of columns based on the data structure
            // The formula will return data in a specific format based on the widget type
            // We'll set a reasonable number of columns to width 20
            // Most widgets will return data in a table format with multiple columns
            for (let i = 1; i <= 20; i++) {
              sheet.getColumn(i).width = 20;
            }
          }
        } catch (error) {
          console.error("Error processing widget:", widget.name, error);
        }
      }

      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = formatDateForFilename(new Date());
      a.download = `OBB - ${sanitizeSheetName(item.data.name || "dashboard")} - ${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      exportSuccess = true;
      toast.success("Excel file exported successfully", {
        description: (
          <>
            Note: The OpenBB Add-in for Excel is required to get updated data. More
            information can be found in the{" "}
            <a
              href="https://docs.openbb.co/excel"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Excel add-in docs
            </a>
            .
          </>
        ),
      });
      setExcelExportPopup(false);
      setExcelExportItem(null);
    } catch (error) {
      if (!exportSuccess) {
        console.error("Error exporting to Excel:", error);
        toast.error("Failed to export dashboard to Excel");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateStaticExcel = async (item: TreeItem<any> & { index: string }) => {
    let exportSuccess = false;
    try {
      setIsGenerating(true);
      setShowProgressDialog(true);
      setCurrentWidget(null);
      setProcessedWidgets([]);

      const tab = getTabById(item.index);
      let allWidgets: any[] = [];

      if (tab?.data?.widgets) {
        // Log the tab data to see what we're working with
        // console.log("Tab data for export:", {
        //   tabId: item.index,
        //   tabName: item.data.name,
        //   widgetsCount: tab.data.widgets.length,
        //   widgets: tab.data.widgets.map((w: any) => ({
        //     name: w.name,
        //     hasParams: !!w.storage?.params,
        //     paramKeys: w.storage?.params ? Object.keys(w.storage.params) : [],
        //     connectionType: w.connectionType,
        //     sourceName: w.sourceName,
        //     hasData: !!w.data,
        //   })),
        // });

        allWidgets = tab.data.widgets.filter(
          (widget) =>
            widget.connectionType === "advanced-backend" &&
            widget.storage?.params &&
            widget?.storage?.chartView,
        );

        // First phase: Prepare widgets
        // console.log("Preparing widgets for export...");
        for (const widget of allWidgets) {
          const widgetName = widget.name || "Unknown Widget";
          setCurrentWidget(widgetName);

          setProcessedWidgets((prev) => [
            ...prev,
            {
              name: widgetName,
              status: "loading",
              phase: "preparing",
              phaseTransitioned: false,
            },
          ]);
        }

        // Add delay between preparing and loading phases
        await delay();

        // Second phase: Load data for all widgets
        // console.log("Loading data for all widgets...");
        for (const widget of allWidgets) {
          const widgetName = widget.name || "Unknown Widget";
          setCurrentWidget(widgetName);

          // Update to loading phase
          setProcessedWidgets((prev) =>
            prev.map((w) =>
              w.name === widgetName
                ? {
                    ...w,
                    status: "loading",
                    phase: "loading",
                    phaseTransitioned: false,
                  }
                : w,
            ),
          );

          try {
            const dataLoaded = await ensureWidgetDataLoaded(widget);
            // Update status but keep in loading phase
            setProcessedWidgets((prev) =>
              prev.map((w) =>
                w.name === widgetName
                  ? {
                      ...w,
                      status: dataLoaded ? "success" : "error",
                      phase: "loading",
                      phaseTransitioned: false,
                      error: dataLoaded ? undefined : "Failed to load data",
                    }
                  : w,
              ),
            );

            if (!dataLoaded) {
              console.warn("Failed to load data for widget:", widgetName);
            }
          } catch (error) {
            setProcessedWidgets((prev) =>
              prev.map((w) =>
                w.name === widgetName
                  ? {
                      ...w,
                      status: "error",
                      phase: "loading",
                      phaseTransitioned: false,
                      error: error instanceof Error ? error.message : "Unknown error",
                    }
                  : w,
              ),
            );
          }
        }

        // Add delay between loading and exporting phases
        await delay();

        // Third phase: Export widgets
        // console.log("Starting export phase...");

        // First mark all widgets as transitioned to export phase
        setProcessedWidgets((prev) =>
          prev.map((w) =>
            w.status === "success"
              ? { ...w, phase: "exporting", phaseTransitioned: true }
              : w,
          ),
        );

        for (const widget of allWidgets) {
          const widgetName = widget.name || "Unknown Widget";

          // Only proceed with export if the widget successfully loaded data
          const widgetStatus = processedWidgets.find((w) => w.name === widgetName);
          if (widgetStatus?.status !== "success") {
            continue;
          }

          setCurrentWidget(widgetName);

          try {
            // ... existing widget export code ...

            // Update widget status to complete
            setProcessedWidgets((prev) =>
              prev.map((w) =>
                w.name === widgetName
                  ? { ...w, status: "success", phase: "complete" }
                  : w,
              ),
            );
          } catch (error) {
            setProcessedWidgets((prev) =>
              prev.map((w) =>
                w.name === widgetName
                  ? {
                      ...w,
                      status: "error",
                      phase: "exporting",
                      error: error instanceof Error ? error.message : "Unknown error",
                    }
                  : w,
              ),
            );
          }
        }
      }

      if (allWidgets.length === 0) {
        toast.error(
          "No advanced-backend widgets with chart view found in this dashboard",
        );
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "OpenBB Workspace";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties.date1904 = false;

      // Add a dashboard info sheet (same as dynamic export)
      const infoSheet = workbook.addWorksheet("Dashboard Info");

      // Title
      infoSheet.getCell("A1").value = "Dashboard Information";
      infoSheet.getCell("A1").font = { bold: true, size: 14 };

      // Basic Info
      infoSheet.getCell("A3").value = "Name";
      infoSheet.getCell("B3").value = item.data.name;
      infoSheet.getCell("A4").value = "Export Date";
      const exportDate = new Date();
      infoSheet.getCell("B4").value = formatDateForDisplay(exportDate);

      // Check if any widgets are in non-default tabs
      const hasNonDefaultTabs = allWidgets.some(
        (widget) => widget.innerTab && widget.innerTab !== "overview",
      );

      // Get unique tabs including Overview if there are multiple tabs
      const uniqueTabs = Array.from(
        new Set(
          allWidgets
            .map((widget) => widget.innerTab)
            .filter((tab): tab is string => !!tab),
        ),
      );
      const hasMultipleTabs = uniqueTabs.length > 1;

      // Widgets Table Header
      const headers =
        hasNonDefaultTabs || hasMultipleTabs
          ? [
              "Tab",
              "Widget Title",
              "Parameters",
              "Description",
              "Backend Name",
              "Category",
              "Subcategory",
              "Source",
            ]
          : [
              "Widget Title",
              "Parameters",
              "Description",
              "Backend Name",
              "Category",
              "Subcategory",
              "Source",
            ];

      // Add headers starting at row 6
      headers.forEach((header, index) => {
        const cell = infoSheet.getCell(6, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
        };
      });

      // Add widget data
      let currentRow = 7;
      for (const widget of allWidgets) {
        const baseRow = [
          widget.name || "",
          formatWidgetParams(widget.storage?.params || {}),
          widget.description || "",
          widget.sourceName || "",
          widget.category || "",
          widget.subCategory || "",
          widget.source?.[0] || "",
        ];

        const row =
          hasNonDefaultTabs || hasMultipleTabs
            ? [widget.innerTab || (hasMultipleTabs ? "Overview" : ""), ...baseRow]
            : baseRow;

        row.forEach((value, index) => {
          const cell = infoSheet.getCell(currentRow, index + 1);
          cell.value = String(value);
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
            bottom: { style: "thin" },
          };
          cell.alignment = { wrapText: true };
        });

        currentRow++;
      }

      // Set column widths
      if (hasNonDefaultTabs || hasMultipleTabs) {
        infoSheet.getColumn("A").width = 20;
        infoSheet.getColumn("B").width = 30;
        infoSheet.getColumn("C").width = 40;
        infoSheet.getColumn("D").width = 40;
        infoSheet.getColumn("E").width = 15;
        infoSheet.getColumn("F").width = 15;
        infoSheet.getColumn("G").width = 15;
        infoSheet.getColumn("H").width = 20;
      } else {
        infoSheet.getColumn("A").width = 30;
        infoSheet.getColumn("B").width = 40;
        infoSheet.getColumn("C").width = 40;
        infoSheet.getColumn("D").width = 15;
        infoSheet.getColumn("E").width = 15;
        infoSheet.getColumn("F").width = 15;
        infoSheet.getColumn("G").width = 20;
      }

      // Freeze the header row
      infoSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6 }];

      // Sort the info sheet
      infoSheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: currentRow - 1, column: headers.length },
      };

      // Create a sheet for each widget with static data
      for (const widget of allWidgets) {
        if (
          !(
            widget.connectionType === "advanced-backend" &&
            widget.storage?.params &&
            widget?.storage?.chartView
          )
        ) {
          continue;
        }
        try {
          setCurrentWidget(widget.name || "Unknown Widget");

          // Get the latest parameters for this widget
          // const latestParams = getLatestWidgetParams(widget);

          // Log the widget state before processing
          // console.log("Processing widget for export:", {
          //   widgetName: widget.name,
          //   connectionType: widget.connectionType,
          //   sourceName: widget.sourceName,
          //   latestParams,
          //   originalStorageParams: widget.storage?.params,
          //   hasChartView: !!widget?.storage?.chartView,
          // });

          const tabSuffix =
            hasMultipleTabs || (widget.innerTab && widget.innerTab !== "overview")
              ? `${widget.innerTab || "Overview"} - `
              : "";
          const sheetName = sanitizeSheetName(`${tabSuffix}${widget.name || "Widget"}`);
          const sheet = workbook.addWorksheet(sheetName);

          let currentRow = 1;

          // Add parameters section if they exist
          if (widget.storage?.params) {
            const params = widget.storage.params;
            // Filter out empty values and metadata objects
            const filteredParams = Object.fromEntries(
              Object.entries(params).filter(([_, value]) => {
                // Skip if value is a metadata object (has value property)
                if (typeof value === "object" && value !== null && "value" in value) {
                  return false;
                }
                const formattedValue = formatParamValue(value);
                return (
                  formattedValue !== "" &&
                  formattedValue !== '""' &&
                  formattedValue !== '""'
                );
              }),
            );

            // Add parameters directly without headers
            const paramData = Object.entries(filteredParams).map(([key, value]) => [
              key,
              formatParamValue(value),
            ]);

            // Add parameter rows
            paramData.forEach((row, rowIndex) => {
              row.forEach((cell, colIndex) => {
                const excelCell = sheet.getCell(currentRow + rowIndex, colIndex + 1);
                excelCell.value = cell as ExcelJS.CellValue;
              });
            });

            // Update current row to be right after parameters (no extra row)
            currentRow += paramData.length;

            // Add an empty row before data
            currentRow += 1;
          }

          // Get and add widget data
          try {
            // console.log("Starting to process widget data:", {
            //   widget: widget.name,
            //   hasParams: !!widget.storage?.params,
            //   currentRow,
            // });

            const data = await getWidgetExportData(widget);
            // console.log("Widget data retrieved:", {
            //   widget: widget.name,
            //   hasData: !!data,
            //   dataType: data ? typeof data : "null",
            //   isArray: Array.isArray(data),
            //   isSuccess: data?.success,
            // });

            // Add the data to the sheet (without Data header)
            if (data) {
              if (data.success) {
                // If the widget handled its own export, just add a note
                sheet.getCell(`A${currentRow}`).value =
                  "Data exported to separate file";
                sheet.getCell(`A${currentRow}`).font = {
                  italic: true,
                  color: { argb: "FF808080" },
                };
              } else {
                // console.log("Adding data to sheet:", {
                //   widget: widget.name,
                //   currentRow,
                //   dataPreview: `${JSON.stringify(data).substring(0, 200)}...`,
                // });
                addDataToSheet(sheet, data, currentRow);
              }
            } else {
              sheet.getCell(`A${currentRow}`).value =
                "No data available for this widget";
              sheet.getCell(`A${currentRow}`).font = {
                italic: true,
                color: { argb: "FF808080" },
              };
            }
          } catch (error) {
            console.error(`Error processing data for widget ${widget.name}:`, {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              widget: {
                name: widget.name,
                connectionType: widget.connectionType,
                sourceName: widget.sourceName,
                widgetId: widget.widgetId,
                endpoint: widget.endpoint?.url,
              },
            });
            sheet.getCell(`A${currentRow}`).value =
              `Error processing widget data: ${error instanceof Error ? error.message : String(error)}`;
            sheet.getCell(`A${currentRow}`).font = { color: { argb: "FFFF0000" } };
          }
        } catch (error) {
          console.error("Error processing widget:", {
            widgetName: widget.name,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            widgetState: {
              connectionType: widget.connectionType,
              sourceName: widget.sourceName,
              hasParams: !!widget.storage?.params,
              paramKeys: widget.storage?.params
                ? Object.keys(widget.storage.params)
                : [],
            },
          });
        }
      }

      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = formatDateForFilename(new Date());
      a.download = `OBB - ${sanitizeSheetName(item.data.name || "dashboard")} - ${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      exportSuccess = true;
      toast.success("Excel file exported successfully", {
        description: (
          <>
            Note: The OpenBB Add-in for Excel is required to get updated data. More
            information can be found in the{" "}
            <a
              href="https://docs.openbb.co/excel"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Excel add-in docs
            </a>
            .
          </>
        ),
      });
      setExcelExportPopup(false);
      setExcelExportItem(null);
    } catch (error) {
      if (!exportSuccess) {
        console.error("Error exporting to Excel:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          tabInfo: item
            ? {
                id: item.index,
                name: item.data.name,
              }
            : null,
        });
        toast.error("Failed to export dashboard to Excel");
      }
    } finally {
      setIsGenerating(false);
      setShowProgressDialog(false);
      setCurrentWidget(null);
      setProcessedWidgets([]);
    }
  };

  const handleDownload = async () => {
    if (!excelExportItem) {
      toast.error("No dashboard selected");
      return;
    }

    try {
      // Save the dashboard first
      await dispatchSaveState();
      await saveDashboards();

      if (exportType === "static") {
        await handleGenerateStaticExcel(excelExportItem);
      } else {
        await handleGenerateExcel(excelExportItem);
      }
    } catch (error) {
      console.error("Error saving dashboard before export:", error);
      toast.error("Failed to save dashboard before export");
    }
  };

  return (
    <>
      <BaseDialog
        open={excelExportPopup}
        onClose={() => {
          setExcelExportPopup(false);
          setExcelExportItem(null);
        }}
      >
        <DialogTitle>Export dashboard to Excel</DialogTitle>
        <DialogDescription>
          Choose the type of export you want to generate.
        </DialogDescription>

        <div className="flex flex-col gap-2 py-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="exportType"
              value="static"
              checked={exportType === "static"}
              onChange={(_e) => setExportType("static")}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-light-600 dark:text-light-200">
              Static data
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="exportType"
              value="dynamic"
              checked={exportType === "dynamic"}
              onChange={(_e) => setExportType("dynamic")}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-light-600 dark:text-light-200">
              Dynamic data
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="exportType"
              value="dynamic-explicit"
              checked={exportType === "dynamic-explicit"}
              onChange={(_e) => setExportType("dynamic-explicit")}
              className="text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-light-600 dark:text-light-200">
              Dynamic data with explicit parameters
            </span>
          </label>
        </div>

        {currentWidget && (
          <div className="text-sm text-light-600 dark:text-light-200 mb-4">
            Processing widget: {currentWidget}
          </div>
        )}

        <DialogFooter className="flex gap-2 items-center">
          <DialogClose asChild={true}>
            <Button type="button" variant="outlined" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" loading={isGenerating} onClick={handleDownload}>
            {isGenerating ? "Exporting..." : "Download"}
          </Button>
        </DialogFooter>
      </BaseDialog>

      <ExportProgressDialog
        open={showProgressDialog}
        currentWidget={currentWidget}
        processedWidgets={processedWidgets}
      />
    </>
  );
}
