import type { ColDef } from "ag-grid-community";
import { useCallback } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import type { EnableSettings } from "../SubMenus/TableSettings";
import { ensureAgGrid } from "../utils";
import { useAgGridContext } from "./useTableContext";

export function useColumnVisibility(
  decimalDigitsSettings: number,
  enableSettings?: EnableSettings,
) {
  const { widget, updateWidget } = useWidgetContext();
  const { gridRef, columnDefsRef, columnVisibility } = useAgGridContext();

  const handleSave = useCallback(() => {
    if (!ensureAgGrid(gridRef?.current)) return;

    const localColDefs = gridRef.current.api.getColumnDefs() as ColDef[];
    if (!localColDefs?.length) return;

    const updateVisibility = { false: [], true: [] };

    for (const col of localColDefs) {
      // @ts-expect-error
      if (col?.children) {
        // @ts-expect-error
        for (const child of col.children) {
          if (!(child?.colId && col?.field)) continue;
          child.hide = !columnVisibility[col.field];

          const key = child.hide ? "false" : "true";
          updateVisibility[key].push(child.colId);
        }
      } else {
        if (!col.colId) continue; // Skip if no colId
        col.hide = !columnVisibility[col.field];
        const key = col.hide ? "false" : "true";
        updateVisibility[key].push(col.colId);
      }
    }

    // Apply the changes from the local state to the actual grid
    for (const [visible, columns] of Object.entries(updateVisibility)) {
      // Filter out any undefined or null colIds as an extra safety measure
      const validColumns = columns.filter(Boolean);
      if (validColumns.length) {
        gridRef.current.api.setColumnsVisible(validColumns, visible === "true");
      }
    }

    /* if (
      widget?.storage?.decimalDigits === decimalDigitsSettings &&
      widget?.storage?.enableStats === enableStats
    )
      return;*/
    const { enableStats, enableAdvanced, enablePagination, enableFormulas } =
      enableSettings || {};
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        decimalDigits: decimalDigitsSettings,
        ...(enableStats !== undefined && { enableStats }),
        ...(enableAdvanced !== undefined && { enableAdvanced }),
        ...(enablePagination !== undefined && { enablePagination }),
        ...(enableFormulas !== undefined && { enableFormulas }),
      },
    }));
  }, [
    gridRef?.current,
    columnVisibility,
    widget,
    updateWidget,
    decimalDigitsSettings,
    columnDefsRef?.current,
    enableSettings,
  ]);

  return handleSave;
}
