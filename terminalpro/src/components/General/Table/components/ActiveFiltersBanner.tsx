import type { GridApi } from "ag-grid-community";
import { useCallback, useEffect, useState } from "react";
import { Tag } from "~/components/ds/atoms/Tag";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";
import { useAgGridContext } from "../hooks";
import { ensureAgGrid } from "../utils";

const OP_LABELS: Record<string, string> = {
  equals: "=",
  notEqual: "≠",
  greaterThan: ">",
  greaterThanOrEqual: "≥",
  lessThan: "<",
  lessThanOrEqual: "≤",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  blank: "is blank",
  notBlank: "is not blank",
  empty: "is empty",
  inRange: "in range",
};

const MAX_SET_VALUES_INLINE = 2;

type ActiveFilter = {
  colId: string;
  headerName: string;
  displayValue: string;
  fullValue: string;
};

function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value);
}

function formatDateString(value: unknown): string {
  if (!value) return "";
  const str = String(value);
  const datePart = str.split(" ")[0];
  return datePart;
}

function formatCondition(c: any, filterType: string): string {
  const op = OP_LABELS[c.type] ?? c.type ?? "";

  if (c.type === "blank" || c.type === "notBlank" || c.type === "empty") {
    return op;
  }

  if (filterType === "date") {
    if (c.type === "inRange") {
      return `${formatDateString(c.dateFrom)} – ${formatDateString(c.dateTo)}`;
    }
    return `${op} ${formatDateString(c.dateFrom)}`.trim();
  }

  if (c.type === "inRange") {
    if (filterType === "number") {
      return `${formatNumber(c.filter)} – ${formatNumber(c.filterTo)}`;
    }
    return `${c.filter} – ${c.filterTo}`;
  }

  const value =
    filterType === "number" ? formatNumber(c.filter) : String(c.filter ?? "");
  if (filterType === "text") return `${op} "${value}"`;
  return `${op} ${value}`.trim();
}

function formatFilterValue(model: any): { display: string; full: string } {
  if (!model) return { display: "", full: "" };

  if (model.filterType === "set" || Array.isArray(model.values)) {
    const values = (model.values ?? []).map((v: unknown) =>
      v === null || v === "" ? "(blank)" : String(v),
    );
    if (values.length === 0) return { display: "(blank)", full: "(blank)" };
    const full = values.join(", ");
    if (values.length <= MAX_SET_VALUES_INLINE) {
      return { display: full, full };
    }
    const shown = values.slice(0, MAX_SET_VALUES_INLINE).join(", ");
    return {
      display: `${shown} +${values.length - MAX_SET_VALUES_INLINE} more`,
      full,
    };
  }

  if (model.conditions && Array.isArray(model.conditions)) {
    const operator = model.operator ?? "AND";
    const parts = model.conditions.map((c: any) =>
      formatCondition(c, model.filterType),
    );
    const joined = parts.join(` ${operator} `);
    return { display: joined, full: joined };
  }

  const single = formatCondition(model, model.filterType);
  return { display: single, full: single };
}

function readActiveFilters(api: GridApi): ActiveFilter[] {
  const filterModel = api.getFilterModel?.() ?? {};
  const entries = Object.entries(filterModel);
  if (entries.length === 0) return [];

  return entries
    .map(([colId, model]): ActiveFilter | null => {
      const column = api.getColumn(colId);
      if (!column) return null;
      const colDef = column.getColDef();
      const headerName =
        (colDef.headerName as string) ?? (colDef.field as string) ?? colId;
      const { display, full } = formatFilterValue(model);
      if (!display) return null;
      return { colId, headerName, displayValue: display, fullValue: full };
    })
    .filter((f): f is ActiveFilter => f !== null);
}

export function ActiveFiltersBanner() {
  const { gridRef, gridState } = useAgGridContext();
  const gridReady = gridState?.gridReady;
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const refresh = useCallback(() => {
    const grid = gridRef.current;
    if (!ensureAgGrid(grid)) return;
    setFilters(readActiveFilters(grid.api));
  }, [gridRef]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!ensureAgGrid(grid)) return;

    refresh();
    grid.api.addEventListener("filterChanged", refresh);
    grid.api.addEventListener("firstDataRendered", refresh);
    grid.api.addEventListener("newColumnsLoaded", refresh);
    grid.api.addEventListener("rowDataUpdated", refresh);

    return () => {
      if (!ensureAgGrid(gridRef.current)) return;
      gridRef.current.api.removeEventListener("filterChanged", refresh);
      gridRef.current.api.removeEventListener("firstDataRendered", refresh);
      gridRef.current.api.removeEventListener("newColumnsLoaded", refresh);
      gridRef.current.api.removeEventListener("rowDataUpdated", refresh);
    };
  }, [gridRef, refresh, gridReady]);

  const clearFilter = useCallback(
    async (colId: string) => {
      const grid = gridRef.current;
      if (!ensureAgGrid(grid)) return;
      await grid.api.setColumnFilterModel(colId, null);
      grid.api.onFilterChanged();
    },
    [gridRef],
  );

  const clearAll = useCallback(() => {
    const grid = gridRef.current;
    if (!ensureAgGrid(grid)) return;
    grid.api.setFilterModel(null);
  }, [gridRef]);

  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 min-h-[32px]",
        "border-b border-general-border-secondary bg-general-bg-secondary",
      )}
      style={{
        borderTopLeftRadius: "var(--ag-wrapper-border-radius, 0)",
        borderTopRightRadius: "var(--ag-wrapper-border-radius, 0)",
      }}
      data-testid="_active-filters-banner"
    >
      <Tooltip message="Active filters">
        <Icon id="filter" className="w-3.5 h-3.5 text-ds-text-caption shrink-0" />
      </Tooltip>

      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {filters.map((f) => (
          <FilterChip key={f.colId} filter={f} onClear={() => clearFilter(f.colId)} />
        ))}
      </div>

      <Tooltip message="Clear all filters">
        <button
          type="button"
          onClick={clearAll}
          aria-label="Clear all filters"
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded shrink-0",
            "text-ds-text-caption hover:text-ds-text-heading",
            "hover:bg-general-bg-secondary-hover transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-link-color",
          )}
          data-testid="_active-filters-clear-all"
        >
          <Icon id="x-close" className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

interface FilterChipProps {
  filter: ActiveFilter;
  onClear: () => void;
}

function FilterChip({ filter, onClear }: FilterChipProps) {
  const truncated = filter.displayValue !== filter.fullValue;
  const label = (
    <Tag
      color="grey"
      className={cn(
        "inline-flex items-center gap-1 max-w-[280px] pl-2 pr-0.5 py-0.5 shrink-0",
      )}
    >
      <span className="truncate">
        <span className="font-medium">{filter.headerName}:</span>{" "}
        <span>{filter.displayValue}</span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${filter.headerName} filter`}
        className={cn(
          "flex items-center justify-center w-4 h-4 rounded-full shrink-0",
          "hover:bg-general-bg-secondary-hover transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-link-color",
        )}
        data-testid={`_active-filter-clear-${filter.colId}`}
      >
        <Icon id="x-close" className="w-3 h-3" />
      </button>
    </Tag>
  );

  if (!truncated) return label;

  return (
    <Tooltip message={`${filter.headerName}: ${filter.fullValue}`}>{label}</Tooltip>
  );
}
