import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import type {
  ColumnAlign,
  ColumnWidth,
  DataTableColumn,
  DataTableProps,
  SortState,
} from "./types";

const SELECT_WIDTH = 44;
const DEFAULT_ACTIONS_WIDTH = 96;
const DEFAULT_ROW_GAP = 10;
// A hugging `"auto"` column can't content-measure in a flex row (each row would
// size independently and misalign), so it falls back to this px width.
const GRID_HUG_WIDTH = 160;

function isFlex(width: ColumnWidth): boolean {
  return width === "fill" || (typeof width === "string" && width.endsWith("%"));
}

// Every column is a flex track. This is why fixed px, proportional `%`, and
// `fill` columns coexist in one row without the CSS table-layout overflow that
// `px + %` hits in a real `<table>`. `minWidth` is the shrink floor.
function flexSizing(width: ColumnWidth, minWidth?: number): CSSProperties {
  if (width === "fill") return { flex: "1 1 0%" };
  // Percent = proportional share: grow by the number so flexible columns split
  // the free space in proportion (e.g. 13% : 19% : ...), filling the width.
  if (typeof width === "string" && width.endsWith("%")) {
    const weight = Number.parseFloat(width) || 1;
    return { flex: `${weight} 1 0%` };
  }
  if (width === "auto") return { flex: `0 0 ${minWidth ?? GRID_HUG_WIDTH}px` };
  if (typeof width === "number") return { flex: `0 0 ${width}px` };
  return { flex: "0 0 auto" };
}

// Floor each column contributes to the table's min/hug width.
function trackFloor(col: { width: ColumnWidth; minWidth?: number }): number {
  if (typeof col.width === "number") return col.width;
  if (col.width === "auto") return col.minWidth ?? GRID_HUG_WIDTH;
  return col.minWidth ?? 0; // fill / %
}

function cellStyle(
  width: ColumnWidth,
  align: ColumnAlign,
  minWidth?: number,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent:
      align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
    minWidth: minWidth ?? 0,
    ...flexSizing(width, minWidth),
  };
}

function nextSort(id: string, current?: SortState | null): SortState {
  if (current?.id === id) return { id, dir: current.dir === "asc" ? "desc" : "asc" };
  return { id, dir: "asc" };
}

function SortIcon({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  return (
    <Icon
      id="chevron-down"
      className={cn(
        "size-3 shrink-0 transition-all",
        active
          ? cn("opacity-100", dir === "asc" && "rotate-180")
          : "opacity-0 group-hover/header:opacity-40",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Row — memoized so a single selection toggle re-renders only the toggled row
// ---------------------------------------------------------------------------

interface RowProps<T> {
  row: T;
  rowId: string;
  columns: DataTableColumn<T>[];
  /** Windowed (absolutely positioned) vs. normal document flow. */
  virtualized: boolean;
  rowHeight?: number;
  rowGap: number;
  virtualStart?: number;
  hasSelect: boolean;
  isSelected: boolean;
  isSelectable: boolean;
  onToggleRow?: (id: string, checked: boolean) => void;
  hasActions: boolean;
  actionsWidth: number;
  renderRowActions?: (row: T) => ReactNode;
  isHighlighted: boolean;
  onHighlightConsumed?: () => void;
  rowClassName?: string;
}

function DataTableRowInner<T>(props: RowProps<T>) {
  const {
    row,
    rowId,
    columns,
    virtualized,
    rowHeight,
    rowGap,
    virtualStart,
    hasSelect,
    isSelected,
    isSelectable,
    onToggleRow,
    hasActions,
    actionsWidth,
    renderRowActions,
    isHighlighted,
    onHighlightConsumed,
    rowClassName,
  } = props;

  const rowRef = useRef<HTMLTableRowElement>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!isHighlighted) return;
    // Delay past any expand animation so the row is at its final position.
    const scrollT = window.setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(true);
    }, 250);
    const doneT = window.setTimeout(() => {
      setFlash(false);
      onHighlightConsumed?.();
    }, 2250);
    return () => {
      window.clearTimeout(scrollT);
      window.clearTimeout(doneT);
    };
  }, [isHighlighted, onHighlightConsumed]);

  const cellBg = isSelected
    ? "bg-general-bg-secondary"
    : "bg-table-cell-bg group-hover:bg-table-cell-bg-hover";
  const cellBase = "px-3 py-3 body-xs-regular text-ds-text-body";
  const cellRole = virtualized ? "gridcell" : "cell";

  // Windowed rows are absolutely positioned within the virtualizer canvas;
  // non-virtualized rows flow normally (the tbody spaces them with a flex gap).
  const rowStyle: CSSProperties = virtualized
    ? {
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: (rowHeight ?? 0) - rowGap,
        transform: `translateY(${virtualStart ?? 0}px)`,
      }
    : { display: "flex", width: "100%" };

  const firstIsData = !hasSelect;
  const lastIsData = !hasActions;

  return (
    <tr
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group [&>td]:transition-colors [&>td]:duration-150",
        flash && "[&>td]:!bg-brand-main/[0.08] dark:[&>td]:!bg-brand-lighter/[0.08]",
        rowClassName,
      )}
    >
      {hasSelect && (
        <td
          role={cellRole}
          style={cellStyle(SELECT_WIDTH, "left")}
          className={cn(cellBase, cellBg, "rounded-l pl-4")}
        >
          <Checkbox
            checked={isSelected}
            disabled={!isSelectable}
            onCheckedChange={(checked) => onToggleRow?.(rowId, checked === true)}
            className={cn(!isSelectable && "cursor-not-allowed opacity-50")}
          />
        </td>
      )}

      {columns.map((col, i) => {
        const align = col.align ?? "left";
        const isFirst = firstIsData && i === 0;
        const isLast = lastIsData && i === columns.length - 1;
        return (
          <td
            key={col.id}
            role={cellRole}
            style={cellStyle(col.width, align, col.minWidth)}
            className={cn(
              cellBase,
              cellBg,
              isFirst && "rounded-l",
              isLast && "rounded-r",
              col.cellClassName,
            )}
          >
            {col.truncate !== false ? (
              <span className="truncate">{col.cell(row)}</span>
            ) : (
              col.cell(row)
            )}
          </td>
        );
      })}

      {hasActions && (
        <td
          role={cellRole}
          style={cellStyle(actionsWidth, "right")}
          className={cn(cellBase, cellBg, "rounded-r pr-4")}
        >
          <div className="flex items-center justify-end gap-2">
            {renderRowActions?.(row)}
          </div>
        </td>
      )}
    </tr>
  );
}

const DataTableRow = memo(DataTableRowInner) as typeof DataTableRowInner;

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    data,
    getRowId,
    virtualized = false,
    estimateRowHeight,
    maxHeight,
    overscan = 10,
    selectedIds,
    onToggleRow,
    onToggleAll,
    isRowSelectable,
    sortState,
    onSortChange,
    renderRowActions,
    actionsWidth = DEFAULT_ACTIONS_WIDTH,
    highlightRowId,
    onHighlightConsumed,
    emptyState,
    rowClassName,
    rowGap = DEFAULT_ROW_GAP,
    className,
  } = props;

  const hasSelect = !!(selectedIds && onToggleRow);
  const hasActions = !!renderRowActions;
  // Any flexible column (`"fill"` or a `%`) makes the table span its container
  // so those columns can take up the width; an all-fixed table hugs instead.
  const hasFlex = useMemo(() => columns.some((c) => isFlex(c.width)), [columns]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const selectableRows = useMemo(
    () => (isRowSelectable ? data.filter(isRowSelectable) : data),
    [data, isRowSelectable],
  );

  const selectedSelectableCount = useMemo(() => {
    if (!selectedIds) return 0;
    let count = 0;
    for (const row of selectableRows) if (selectedIds.has(getRowId(row))) count++;
    return count;
  }, [selectableRows, selectedIds, getRowId]);

  const headerCheckState: boolean | "indeterminate" =
    selectedSelectableCount === 0
      ? false
      : selectedSelectableCount === selectableRows.length
        ? true
        : "indeterminate";

  const rowVirtualizer = useVirtualizer({
    count: virtualized ? data.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight ?? 48,
    overscan,
    getItemKey: (index) => getRowId(data[index]),
  });

  const handleSort = useCallback(
    (id: string) => onSortChange?.(nextSort(id, sortState)),
    [onSortChange, sortState],
  );

  // Floor width so columns never collapse. Also the exact table width when the
  // table hugs (no flexible column): every track resolves to a concrete px floor.
  const minTableWidth = useMemo(() => {
    let w = (hasSelect ? SELECT_WIDTH : 0) + (hasActions ? actionsWidth : 0);
    for (const col of columns) w += trackFloor(col);
    return w;
  }, [columns, hasSelect, hasActions, actionsWidth]);

  const headerCellBase =
    "bg-table-header-bg body-xs-medium text-ds-text-heading whitespace-nowrap";

  const renderRow = (row: T, virtualStart?: number) => {
    const id = getRowId(row);
    return (
      <DataTableRow
        key={id}
        row={row}
        rowId={id}
        columns={columns}
        virtualized={virtualized}
        rowHeight={estimateRowHeight}
        rowGap={rowGap}
        virtualStart={virtualStart}
        hasSelect={hasSelect}
        isSelected={!!selectedIds?.has(id)}
        isSelectable={isRowSelectable ? isRowSelectable(row) : true}
        onToggleRow={onToggleRow}
        hasActions={hasActions}
        actionsWidth={actionsWidth}
        renderRowActions={renderRowActions}
        isHighlighted={!virtualized && highlightRowId === id}
        onHighlightConsumed={onHighlightConsumed}
        rowClassName={rowClassName?.(row)}
      />
    );
  };

  return (
    <div
      className={cn("w-full", virtualized && "flex h-full min-h-0 flex-col", className)}
    >
      <div
        ref={scrollRef}
        className={virtualized ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto"}
        style={virtualized && maxHeight != null ? { maxHeight } : undefined}
      >
        {/* One flex layout for both modes. Fill: span the container so flexible
            columns absorb the slack. Hug (no flexible column): width = the sum of
            tracks, so the table sizes to content and scrolls instead of stretching. */}
        <table
          role={virtualized ? "grid" : "table"}
          style={{
            display: "grid",
            minWidth: minTableWidth,
            width: hasFlex ? "100%" : minTableWidth,
          }}
        >
          <thead
            className={virtualized ? "sticky top-0 z-10" : undefined}
            style={{ display: "grid" }}
          >
            <tr className="h-[38px]" style={{ display: "flex", width: "100%" }}>
              {hasSelect && (
                <th
                  role="columnheader"
                  style={cellStyle(SELECT_WIDTH, "left")}
                  className={cn(headerCellBase, "rounded-l pl-4")}
                >
                  <Checkbox
                    checked={headerCheckState}
                    disabled={selectableRows.length === 0}
                    onCheckedChange={(checked) =>
                      onToggleAll?.(selectableRows, checked === true)
                    }
                    className={cn(
                      selectableRows.length === 0 && "cursor-not-allowed opacity-50",
                    )}
                  />
                </th>
              )}

              {columns.map((col, i) => {
                const align = col.align ?? "left";
                const isFirst = !hasSelect && i === 0;
                const isLast = !hasActions && i === columns.length - 1;
                const active = sortState?.id === col.id;
                return (
                  <th
                    key={col.id}
                    role="columnheader"
                    aria-sort={
                      col.sortable
                        ? active
                          ? sortState?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    style={cellStyle(col.width, align, col.minWidth)}
                    className={cn(
                      headerCellBase,
                      "px-3 py-1",
                      isFirst && "rounded-l pl-4",
                      isLast && "rounded-r pr-4",
                      col.headerClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        className={cn(
                          "group/header inline-flex items-center gap-1 select-none",
                          align === "right" && "flex-row-reverse",
                          align === "center" && "mx-auto",
                        )}
                      >
                        <span>{col.header}</span>
                        <SortIcon active={!!active} dir={sortState?.dir} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}

              {hasActions && (
                <th
                  role="columnheader"
                  style={cellStyle(actionsWidth, "right")}
                  className={cn(headerCellBase, "rounded-r pr-4")}
                />
              )}
            </tr>
          </thead>

          <tbody
            style={
              virtualized
                ? {
                    display: "grid",
                    // `+ rowGap` reserves a leading gap between the sticky header
                    // and the first row (matching the non-virtualized spacing).
                    height: rowVirtualizer.getTotalSize() + rowGap,
                    position: "relative",
                  }
                : {
                    display: "flex",
                    flexDirection: "column",
                    gap: rowGap,
                    paddingTop: rowGap,
                  }
            }
          >
            {virtualized
              ? rowVirtualizer
                  .getVirtualItems()
                  .map((virtualRow) =>
                    renderRow(data[virtualRow.index], virtualRow.start + rowGap),
                  )
              : data.map((row) => renderRow(row))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && emptyState}
    </div>
  );
}
