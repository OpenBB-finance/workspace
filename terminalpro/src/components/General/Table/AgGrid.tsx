import type {
  GetMainMenuItemsParams,
  IHeaderParams,
  MenuItemDef,
  WithoutGridCommon,
} from "ag-grid-community";
import "ag-grid-enterprise";
import * as HoverCard from "@radix-ui/react-hover-card";
import { provideGlobalGridOptions } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import clsx from "clsx";
import dayjs from "dayjs";
import {
  lazy,
  memo,
  type MouseEvent as ReactMouseEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useCellOnClickHandler } from "~/components/General/Table/hooks/useCellOnClickHandler";
import Icon from "~/components/Icon";
import type { WidgetColumnDefT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import {
  formatNumber,
  formatNumberMagnitude,
  formatNumberThousands,
  parseMarkdownParams,
} from "~/lib/utils";
import {
  convertToReadableLabel,
  formatDate,
  formatObjectValue,
  isDate,
  isDateTime,
  isLink,
} from "./AgGridUtils";
import CellOnHover, { type CellOnHoverProps } from "./CellRenderers/CellOnHover";
import { getOpenBBChartTheme } from "./Chart/themes";
import type {
  CellHoverCardProps,
  CellOnClickedProps,
  CellRendererProps,
  TriggerElementProps,
} from "./hooks/types";
import { clearCellSelection } from "./utils";

const MarkdownContent = lazy(() =>
  import("~/components/Widgets/custom/Markdown").then((module) => ({
    default: module.MarkdownContent,
  })),
);

export const TOTAL_CELL_LIMIT = 500_000;
const ROW_SELECTION_LIMIT = 10_000;

function checkCellCount(cellCount: number) {
  if (cellCount > TOTAL_CELL_LIMIT) {
    // Show a error message that the selection is limited to
    // and that the user should refine their selection
    toast.error(`Selection range is limited to ${TOTAL_CELL_LIMIT} cells.`, {
      description: (
        <div className="mb-2">
          Your selection contains {formatNumberThousands(cellCount)} cells. Please
          refine your selection to a smaller range to avoid performance issues.
        </div>
      ),
    });
  }

  return cellCount <= TOTAL_CELL_LIMIT;
}

export const CustomHeader = memo(
  (props: IHeaderParams<WithoutGridCommon<AgGridReact> | AgGridReact>) => {
    const colId = props.column?.getColId();
    const colDef = props.column?.getColDef();
    const isRightAligned = useMemo(
      () => colDef?.cellClass === "ag-right-aligned-cell",
      [colDef?.cellClass],
    );
    const [sortState, setSortState] = useState({ prev: null, current: null });
    const refButton = useRef(null);
    const refLabel = useRef<HTMLDivElement>(null);
    const sortUpRef = useRef(null);
    const sortDownRef = useRef(null);
    const clickTimeout = useRef(null);

    const [isFilterActive, setIsFilterActive] = useState(false);

    const onMenuClicked = useCallback(
      (e: ReactMouseEvent) => {
        if (!(props?.showColumnMenuAfterMouseClick && refButton?.current)) return;
        e.stopPropagation();
        e.preventDefault();

        props.showColumnMenuAfterMouseClick(e as any);
      },
      [props?.showColumnMenuAfterMouseClick, refButton?.current, isFilterActive],
    );

    const onSortRequested = useDebouncedCallback(
      (order: "asc" | "desc" | null, event: any) => {
        if (!props?.api || props?.api?.isDestroyed()) return;
        if (order === sortState.current) {
          order = null;
        }
        props.setSort(order, event.shiftKey);
      },
      200,
    );

    const shouldDisplayTooltip = useCallback(() => {
      const elem = refLabel?.current;
      return elem!.scrollWidth > elem!.clientWidth;
    }, [refLabel]);

    useEffect(() => {
      if (
        !(props?.column?.getColDef && props?.api && props?.setTooltip) ||
        props?.api?.isDestroyed()
      )
        return;

      const headerTooltip = colDef?.headerTooltip;
      const tooltipText = headerTooltip ?? props?.displayName;

      props.setTooltip(tooltipText, () =>
        headerTooltip ? true : shouldDisplayTooltip(),
      );
    }, [shouldDisplayTooltip, colDef?.headerTooltip, props?.displayName]);

    useEffect(() => {
      if (!(props.column && props?.api) || props?.api?.isDestroyed()) return;
      props.column.addEventListener("sortChanged", (params) => {
        const newSort = (getSort = params.column.getSort()) =>
          getSort !== undefined ? getSort : null;

        setSortState({
          prev: sortState.current,
          current: newSort(),
        });
      });

      const getSort = props.column.getSort();
      setSortState({
        prev: null,
        current: getSort !== undefined ? getSort : null,
      });
    }, []);

    const onFilterChanged = useCallback(() => {
      const filterActive = props.column.isFilterActive();
      setIsFilterActive(filterActive);
    }, [props.column.isFilterActive]);

    useEffect(() => {
      if (props.column) {
        props.column.addEventListener("filterChanged", onFilterChanged);
      }
      return () => {
        if (props.column) {
          props.column.removeEventListener("filterChanged", onFilterChanged);
        }
      };
    }, []);

    const menu = useMemo(() => {
      if (!props.enableMenu) return null;
      return (
        <div
          key={`${colId}-menu`}
          ref={refButton}
          className={clsx("customHeaderMenuButton", {
            "opacity-0": !isFilterActive,
            "opacity-100": isFilterActive,
            "group-hover/header:opacity-100": !isFilterActive,
          })}
          onClick={onMenuClicked}
        >
          <Icon id="hamburger-icon" className="h-4 w-4" key={`${colId}-menu-icon`} />
        </div>
      );
    }, [isFilterActive, refButton, onMenuClicked]);

    const sort = useMemo(() => {
      if (!props.enableSorting) return null;

      const sortingActive = sortState.current !== null;
      return (
        <div
          key={`${colId}-sort`}
          className={clsx("flex flex-col", {
            "opacity-0 group-hover/header:opacity-100": !sortingActive,
            "opacity-100": sortingActive,
          })}
        >
          <div
            key={`${colId}-sort-up`}
            ref={sortUpRef}
            onClick={(event) => onSortRequested("asc", event)}
            className={`customSortUpLabel ${
              sortState.current === "asc" ? "active" : "inactive"
            }`}
          >
            <Icon
              id="mdi-triangle-down"
              className={clsx("h-2 w-2 rotate-180", {
                "text-light-400 dark:text-light-500": sortState.current !== "asc",
                "text-brand-darker": sortState.current === "asc",
              })}
            />
          </div>
          <div
            key={`${colId}-sort-down`}
            ref={sortDownRef}
            onClick={(event) => onSortRequested("desc", event)}
            className={`customSortDownLabel ${
              sortState.current === "desc" ? "active" : "inactive"
            }`}
          >
            <Icon
              id="mdi-triangle-down"
              className={clsx("h-2 w-2", {
                "text-light-400 dark:text-light-500": sortState.current !== "desc",
                "text-brand-darker": sortState.current === "desc",
              })}
            />
          </div>
        </div>
      );
    }, [sortState.current]);

    const onHeaderClick = useCallback(
      (e: ReactMouseEvent & { target: any }) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimeout.current !== null) {
          if (!props?.api || props?.api?.isDestroyed()) return;
          // Double click detected
          clearTimeout(clickTimeout.current);
          clickTimeout.current = null;

          // Handle double click: select the full column
          const currentSelection = props.api.getCellRanges();
          const column =
            props.api.getAllGridColumns()[
              props.api.getAllGridColumns().indexOf(props.column)
            ];

          if (e.shiftKey && currentSelection.length > 0) {
            const lastRange = currentSelection[currentSelection.length - 1];
            const lastColumn = lastRange.columns[lastRange.columns.length - 1];
            const lastColumnIndex = props.api.getAllGridColumns().indexOf(lastColumn);
            const currentColumnIndex = props.api.getAllGridColumns().indexOf(column);
            const start = Math.min(lastColumnIndex, currentColumnIndex);
            const end = Math.max(lastColumnIndex, currentColumnIndex);
            const columns = props.api.getAllGridColumns().slice(start, end + 1);

            const rowCount = props.api.getDisplayedRowCount();

            props.api.clearCellSelection(); // Clear the selection before adding a new one

            if (!checkCellCount(rowCount * columns.length)) return;

            props.api.addCellRange({
              rowStartIndex: 0,
              rowEndIndex: rowCount - 1,
              columns: columns,
            });
          } else if (currentSelection.some((range) => range.columns.includes(column))) {
            props.api.clearCellSelection();
          } else {
            if (currentSelection) {
              props.api.clearCellSelection();
            }
            const rowCount = props.api.getDisplayedRowCount();

            if (!checkCellCount(rowCount)) return;

            props.api.addCellRange({
              rowStartIndex: 0,
              rowEndIndex: rowCount - 1,
              columns: [column],
            });
          }
        } else {
          // Single click detected, start a timeout to differentiate from double click
          clickTimeout.current = setTimeout(() => {
            clickTimeout.current = null;

            // if the user clicked on the sort icon, we ignore the click
            if (
              !(
                e.target.closest(".customSortUpLabel") ||
                e.target.closest(".customSortDownLabel")
              )
            ) {
              const newSort = ["asc", "desc", null][
                (sortState.current === "asc"
                  ? 1
                  : sortState.current === "desc"
                    ? 2
                    : 0) % 3
              ] as "asc" | "desc" | null;

              // Handle single click: sort the column
              if (props.enableSorting) {
                onSortRequested(newSort, e);
              }
            }
          }, 200); // 200ms delay to wait for potential second click
        }
      },
      [props.column, props.api, sortState.current, onSortRequested],
    );

    useEffect(() => {
      if (!(props.column && props?.api) || props?.api?.isDestroyed()) return;
      const filterActive = props.column.isFilterActive();
      setIsFilterActive(filterActive);
    }, []);

    return (
      <div
        key={`${colId}-header`}
        onClick={onHeaderClick}
        onContextMenu={(e) => onMenuClicked(e)}
        className={clsx(
          "group/header headerWrapper flex w-full items-center justify-between gap-1",
          {
            "justify-end": isRightAligned,
            "justify-between": !isRightAligned,
          },
        )}
      >
        {isRightAligned && menu}
        <div
          className="flex gap-1 overflow-hidden text-ellipsis"
          key={`${colId}-header-label`}
        >
          {isRightAligned && sort}
          <div
            ref={refLabel}
            className="customHeaderLabel font-medium"
            key={`${colId}-header-label-text`}
          >
            {props.displayName}
          </div>
          {!isRightAligned && sort}
        </div>
        {!isRightAligned && menu}
      </div>
    );
  },
);

export const colDefFormatter = (
  params: CellRendererProps,
  options: {
    colDef?: WidgetColumnDefT;
    widgetId?: string;
    decimalPlaces?: number;
  } = {},
): CellOnHoverProps => {
  const { colDef, widgetId, decimalPlaces: globalDecimalPlaces = 3 } = options;
  const decimalPlaces = colDef?.decimalPlaces ?? globalDecimalPlaces;
  const { colorValueKey, colorRules } = colDef?.renderFnParams ?? {};

  const hasColorFns = colDef?.renderFn?.some((fn) =>
    ["columnColor", "greenRed"].includes(fn),
  );
  const color = hasColorFns || colorRules?.length > 0;
  const colorValue = color ? params?.data?.[colorValueKey] : undefined;

  const colorProps = { color, colorValue, colorRules };

  if (typeof params.value === "number" && colDef?.cellDataType !== "text") {
    colorProps.colorValue = colorValue ?? params.value;

    let title = params.value.toLocaleString();
    let value = params.value.toString();

    if (!colDef?.formatterFn || colDef?.formatterFn?.includes("int")) {
      value = formatNumber(params.value, decimalPlaces);
    }
    if (!colDef?.formatterFn || colDef?.formatterFn !== "none") {
      title = formatNumberThousands(params.value);
    }
    if (colDef?.formatterFn?.startsWith("normalized")) {
      const [int, decimals = "0"] = (params.value * 100).toString().split(".");
      const maxDecimals = params.value < 0.001 ? 6 : 2;
      value = `${int}.${decimals?.slice(0, Math.max(maxDecimals, decimalPlaces))}`;

      if (value === "0.00") value = "0";
      if (colDef?.formatterFn === "normalizedPercent") {
        value = `${value} %`;
      }
    }
    if (colDef?.formatterFn === "percent") {
      const [int, decimals = "0"] = params.value.toString().split(".");
      value = `${int}.${decimals?.slice(0, Math.max(2, decimalPlaces))} %`;
    }
    if (
      !["normalizedPercent", "percent"].includes(colDef?.formatterFn) &&
      ["income_statement", "balance_sheet", "cash_flow_statement"].includes(widgetId)
    ) {
      if (params.value > 1_000 || params.value < -1_000) {
        value = formatNumberMagnitude(params.value, 0, true, true);
      }
    }

    if (colDef?.prefix) {
      value = `${colDef.prefix}${value}`;
      title = `${colDef.prefix}${title}`;
    }
    if (colDef?.suffix) {
      value = `${value}${colDef.suffix}`;
      title = `${title}${colDef.suffix}`;
    }

    return { value, title, ...colorProps };
  }

  if (colDef?.renderFn?.includes("titleCase")) {
    const titleCase = convertToReadableLabel(params.value)
      .split(" ")
      .map((word: string) =>
        word
          .replace(/(\w{4,})/g, (match) => match.toLowerCase())
          .replace(/(\w{1})/, (match) => match.toUpperCase()),
      )
      .join(" ");
    return { value: titleCase, title: titleCase, ...colorProps };
  }

  if (
    (colDef?.prefix || colDef?.suffix) &&
    params.value !== null &&
    params.value !== undefined
  ) {
    let stringValue = params.value.toString();

    if (colDef?.prefix) {
      stringValue = `${colDef.prefix}${stringValue}`;
    }
    if (colDef?.suffix) {
      stringValue = `${stringValue}${colDef.suffix}`;
    }

    return { value: stringValue, title: stringValue, ...colorProps };
  }

  if (colDef?.cellDataType === "date" && isDate(params.value)) {
    return { value: formatDate(params.value), ...colorProps };
  }

  return { value: params.value, title: params.value, ...colorProps };
};

function getCellRenderer(
  params: CellRendererProps,
  widgetId: string,
  decimalPlaces: number,
) {
  const widgetColDefs = params?.widgetColDefs ?? {};
  const colField = params?.data?.Index ?? params.colDef?.colId ?? params.colDef?.field;

  const colDef = widgetColDefs?.[colField] ?? {};
  const chartDataType = colDef?.chartDataType ?? params?.colDef?.chartDataType;
  const cellDataType = colDef?.cellDataType ?? params?.colDef?.cellDataType;
  const isDateField =
    (colField?.toString()?.includes("date") || cellDataType === "date") &&
    chartDataType !== "series";

  if (params.value === null || params.value === undefined) return "-";

  function getElementProps() {
    const value = params.value?.value ?? params.value;
    const defaultProps: CellOnHoverProps = { value };

    if (widgetId === "eod_price" && colField === "date") return defaultProps;

    if (isDateField && isDateTime(value)) {
      const dateObj = dayjs(value);

      if (dateObj.format("HH:mm:ss").includes("00:00:00")) {
        defaultProps.value = dateObj.format("YYYY-MM-DD");
      }

      return defaultProps;
    }

    if (isDateField && isDate(value)) {
      let date = dayjs(value);

      if (colDef?.formatterFn === "dateToYear") {
        const { calendar_year, period } = params.data ?? {};
        const year = calendar_year ? calendar_year : date.year();

        if (period) {
          const quarter = Number.parseInt(period.replace("Q", ""), 10);
          date = dayjs().year(year).quarter(quarter);
        }

        return { value: date.format("YYYY-MM-DD") };
      }

      if (typeof params.value === "number") return defaultProps;

      return { value: formatDate(value) };
    }

    if (typeof value === "boolean") {
      return { value: value.toString() };
    }

    if (
      typeof value === "object" ||
      ((isDateField || cellDataType === "text") &&
        !(colDef?.formatterFn || colDef?.renderFn))
    ) {
      return { value: formatObjectValue(value) };
    }

    return colDefFormatter({ ...params, value }, { widgetId, decimalPlaces, colDef });
  }

  if (typeof params.value === "string" && isLink(params.value)) {
    return (
      <CellOnHover
        value={
          <a
            href={params.value}
            target="_blank"
            rel="noreferrer"
            className="obb-hyper-link underline-offset-2"
          >
            Open link
          </a>
        }
        title={params.value}
      />
    );
  }

  return <CellOnHover {...getElementProps()} />;
}

export const CustomCellRenderer = (params: CellRendererProps) => {
  const decimalPlacesToUse = params?.decimalPlacesToUse ?? 2;
  const colField = params?.colDef?.colId ?? params?.colDef?.field;

  const {
    widgetId: wId,
    storage: { selectedGroup, decimalDigits },
  } = useWidgetContext().widget;
  const widgetId = selectedGroup || wId;

  const decimalPlaces = decimalDigits ?? decimalPlacesToUse;

  return useMemo(() => {
    if (colField === "Index" && params?.transpose) {
      return params.valueFormatted;
    }

    return getCellRenderer(params, widgetId, decimalPlaces);
  }, [params.value, params.data, colField, widgetId, decimalPlaces]);
};

export function TriggerElement(params: TriggerElementProps) {
  const colField = params.colDef?.colId ?? params.colDef?.field;
  const colDef = params?.widgetColDefs?.[colField] ?? {};
  const hasCellOnClick = colDef?.renderFn?.includes("cellOnClick");

  const Component = hasCellOnClick ? CellOnClickRenderer : CustomCellRenderer;

  return <Component {...(params as CellOnClickedProps)} />;
}

export function HoverCardCellRenderer(params: CellHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { value, markDownContent } = useMemo(() => {
    const { title, markdown, cellField = "value" } = params?.hoverCard ?? {};
    const isObject = typeof params.value === "object";
    const paramsKey = isObject ? "value" : "data";

    const defaultMarkdown = Object.entries((isObject && params.value) ?? {}).reduce(
      (acc, [key, value]) => {
        if (key === cellField) return acc;
        const label = convertToReadableLabel(key);
        acc += `- **${label}**: ${value ?? "-"}\n\n`;
        return acc;
      },
      title ? `## ${title}\n` : "",
    );

    const paramValues = { ...params[paramsKey], title };
    let markDownContent = parseMarkdownParams(
      markdown ?? defaultMarkdown,
      paramValues,
    )?.parsedValue;

    if (title && !markdown?.includes("{title}")) {
      markDownContent = `## ${title}\n${markDownContent}`;
    }

    const fieldValue = isObject ? params.value?.[cellField] : params.value;

    return { value: fieldValue ?? null, markDownContent };
  }, [params.value, params.hoverCard, params.data]);

  const hoverElements = useMemo(
    () => (
      <Suspense fallback={null}>
        <MarkdownContent content={markDownContent} />
      </Suspense>
    ),
    [markDownContent],
  );

  const triggerElement = <TriggerElement {...params} value={value} />;

  if (!markDownContent) return triggerElement;

  return (
    <span className="flex items-center w-full gap-1">
      <HoverCard.Root open={isOpen} openDelay={300} onOpenChange={setIsOpen}>
        <HoverCard.Trigger
          onClick={() => setIsOpen(true)}
          className="cursor-pointer flex items-center
          justify-center relative w-full no-underline whitespace-nowrap"
        >
          {triggerElement}
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            side="right"
            align="start"
            sideOffset={10}
            updatePositionStrategy="always"
            className="max-w-[400px] max-h-[300px] overflow-y-auto bottom-full mb-2 prose break-words
            prose-sm z-60 flex animate-fade-in flex-col
            gap-1 rounded bg-light-50 p-1.5 text-light-600
            text-xs dark:prose-invert font-medium dark:text-light-300
            prose-p:my-1 shadow dark:bg-dark-750 dark:shadow-[0_2px_10px_0_rgba(0,0,0,0.80)]
            prose-headings:mt-1"
          >
            {hoverElements}
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </span>
  );
}

export function CellOnClickRenderer(params: CellOnClickedProps) {
  const handleCellOnClick = useCellOnClickHandler();

  const handleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      handleCellOnClick(params);
    },
    [handleCellOnClick, params],
  );

  return (
    <div
      onClick={handleClick}
      data-cell-on-click-renderer="true"
      className="cursor-pointer w-full h-full"
    >
      <CustomCellRenderer {...params} />
    </div>
  );
}

export function getMainMenuItems(params: GetMainMenuItemsParams<AgGridReact>) {
  // you don't need to switch, we switch below to just demonstrate some different options
  // you have on how to build up the menu to return
  const colDef = params.column?.getColDef();
  const actualWidth = params.column.getActualWidth();

  const resetColumns = {
    name: "Reset Columns",
    action: () => {
      params.api?.resetColumnState();
      params.api?.resetColumnGroupState();
      params.api?.autoSizeAllColumns();
    },
  } as MenuItemDef;
  const columnToHide = params.defaultItems.map((item) => {
    // override Reset Columns with our own version
    if (typeof item === "string" && item === "resetColumns") {
      return resetColumns;
    }
    return item;
  });

  const hideColumn = {
    name: "Hide Column",
    action: () => {
      params.api.setColumnsVisible([colDef.field], false);
    },
  } as MenuItemDef;

  const minimizeColumn = {
    name: "Minimize Column",
    action: () => {
      params.api.setColumnWidths([{ key: colDef.field, newWidth: 150 }]);
    },
  } as MenuItemDef;

  const indexToInsert = 4;
  columnToHide.splice(indexToInsert, 0, hideColumn);
  if (actualWidth > 200) columnToHide.splice(indexToInsert, 0, minimizeColumn);

  return columnToHide;
}

export function setGlobalGridOptions() {
  return provideGlobalGridOptions({
    paginationPageSize: 100,
    cellSelection: true,
    rowSelection: { enableClickSelection: true, mode: "singleRow", checkboxes: false },
    enableCharts: true,
    rowBuffer: 10,
    suppressAnimationFrame: true,
    rowHeight: 32,
    headerHeight: 32,
    getMainMenuItems: getMainMenuItems,
    animateRows: false,
    tooltipShowDelay: 1000,
    getChartToolbarItems: (_) => [],
    columnMenu: "legacy",
    suppressColumnMoveAnimation: true,
    maintainColumnOrder: true,
    suppressFieldDotNotation: true,
    suppressMoveWhenColumnDragging: true,
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true,
      suppressAutoSize: true,
      minWidth: 50,
      cellRenderer: TriggerElement,
      filterParams: {
        buttons: ["apply", "clear", "reset", "cancel"],
        closeOnApply: true,
        maxNumConditions: 5,
      },
    },
    components: {
      agColumnHeader: CustomHeader,
    },
    onCellClicked: (params) => {
      clearCellSelection(params);
    },
    onCellDoubleClicked: (params) => {
      if (params?.node) {
        const allColumns = params.api
          .getAllDisplayedColumns()
          // @ts-expect-error - colId property exists but not in types
          .map((col) => col.colId);
        params.api.addCellRange({
          rowStartIndex: params.node.rowIndex,
          rowEndIndex: params.node.rowIndex,
          columns: allColumns,
        });
      }
    },
    postProcessPopup: (params) => {
      // check callback is for menu
      if (params.type !== "columnMenu") {
        return;
      }
    },
    customChartThemes: {
      "openbb-dark": getOpenBBChartTheme("dark"),
      "openbb-light": getOpenBBChartTheme("light"),
    },
  });
}

/*const CustomDate = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  const [label, setLabel] = useState('');

  useImperativeHandle(ref, () => ({
    //*********************************************************************************
    //          METHODS REQUIRED BY AG-GRID
    //*********************************************************************************
    getDate() {
      //ag-grid will call us here when in need to check what the current date value is hold by this
      //component.
      return new Date(inputRef.current.value);
    },

    setDate(date: any) {
      //ag-grid will call us here when it needs this component to update the date that it holds.
      console.log('setDate', date);
      inputRef.current = date;
    }
  }
  ))


  useEffect(() => {
    if (inputRef.current) {
      const isInRange = document.querySelector('.ag-picker-field-display') !== null;
      if (isInRange) {
        const isToHidden = document.querySelector('.ag-filter-to.ag-hidden') !== null;
        if (!isToHidden)
          setLabel(!inputRef.current.closest(".ag-filter-to") ? 'Start:' : 'End:');
      } else {
        setLabel('');
      }
    }
  }, []);

  return (
    <div>
      {label}
      <input
        type="date"
        onFocus={() => inputRef.current.showPicker()}
        className="ag-input-field-input ag-picker-field"
        ref={inputRef}
      />
    </div>
  );
});*/
