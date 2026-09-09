import type { ReactNode } from "react";

export type SortDir = "asc" | "desc";

export type SortState = { id: string; dir: SortDir };

export type ColumnAlign = "left" | "center" | "right";

/**
 * A column track width. Whether the table HUGS its content or FILLS its
 * container is emergent from the columns — no extra prop:
 * - `number`  -> fixed pixels.
 * - `"auto"`  -> hug: sizes to content (native) / `minWidth` px (virtualized).
 *                A table whose columns are ALL `number`/`auto` hugs its content
 *                (left-aligned, scrolls on overflow) instead of stretching.
 * - `"20%"`   -> proportional share: the column grows to take that share of the
 *                table's free space. ANY `%`/`fill` column makes the table fill
 *                its container; multiple `%` columns scale together.
 * - `"fill"`  -> takes the remaining space (proportional weight 1). Use for a
 *                single stretch column (e.g. a name/description that fills).
 *
 * `minWidth` is the floor for `%`/`fill`/`auto` columns; the table never shrinks
 * below the sum of floors (it scrolls instead).
 */
export type ColumnWidth = number | `${number}%` | "auto" | "fill";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  width: ColumnWidth;
  /**
   * Floor width in px for flexible (`"auto"`/`%`) columns so they never collapse
   * below readability. Adds to the table's min-width, so the table scrolls
   * horizontally instead of squashing the column to nothing.
   */
  minWidth?: number;
  align?: ColumnAlign;
  cell: (row: T) => ReactNode;
  /** Show a clickable sort affordance on the header. Sorting itself is owned by the caller. */
  sortable?: boolean;
  /** When virtualized, cells are wrapped in a truncating span. Set false for non-text cells (tags, custom layouts). */
  truncate?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** Rows, already filtered and sorted by the caller. */
  data: T[];
  getRowId: (row: T) => string;

  // --- Virtualization (opt-in) ---
  /** Window the rows with @tanstack/react-virtual. Requires `maxHeight`. */
  virtualized?: boolean;
  /** Fixed row height in px (no dynamic measuring). Required when virtualized. */
  estimateRowHeight?: number;
  /** Scroll-container height. Only used when virtualized. */
  maxHeight?: number | string;
  overscan?: number;

  // --- Selection (caller owns the Set) ---
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  /** Receives the currently-visible selectable rows. */
  onToggleAll?: (rows: T[], checked: boolean) => void;
  isRowSelectable?: (row: T) => boolean;

  // --- Sorting (controlled; caller applies the comparator) ---
  sortState?: SortState | null;
  onSortChange?: (next: SortState) => void;

  // --- Row actions (revealed on row hover) ---
  renderRowActions?: (row: T) => ReactNode;
  actionsWidth?: number;

  // --- Deep-link highlight (non-virtualized only) ---
  highlightRowId?: string | null;
  onHighlightConsumed?: () => void;

  emptyState?: ReactNode;
  rowClassName?: (row: T) => string;
  /** Vertical gap between rows in px. Defaults to 10 (the `border-spacing-y-2.5` look). */
  rowGap?: number;
  className?: string;
  "data-testid"?: string;
}
