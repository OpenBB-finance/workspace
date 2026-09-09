import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebounceValue } from "usehooks-ts";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { Input } from "~/components/ds/atoms/Input";
import BrandedLogo from "~/components/General/BrandedLogo";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowThemeStore } from "~/lib/state/theme";
import { ensureAgGrid, getWidgetStorage, useAgGridContext } from "../hooks";

export type EnableSettings = {
  enableStats?: boolean;
  enableAdvanced?: boolean;
  enablePagination?: boolean;
  enableFormulas?: boolean;
};

const TableSettings = memo(
  (props: {
    decimalDigitsSettings: number;
    setDecimalDigitsSettings: (val: number) => void;
    enableSettings?: EnableSettings;
    setEnableSettings?: (props: EnableSettings) => void;
  }) => {
    const tablePagination = useShallowThemeStore((state) => state.tablePagination);
    const { decimalDigitsSettings, setDecimalDigitsSettings, setEnableSettings } =
      props;

    const isPivotMode = useWidgetContext(true)?.widget?.storage?.isPivotMode;

    return (
      <>
        {props.enableSettings !== undefined && (
          <>
            <div>
              <div className="mb-1.5 body-xs-bold text-light-900 dark:text-light-50">
                Table Settings
              </div>

              <div className="-ml-0.5 grid grid-cols-3 gap-2 overflow-auto p-0.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-advanced"
                    label="Advanced"
                    checked={props.enableSettings?.enableAdvanced}
                    onCheckedChange={(enableAdvanced: boolean) =>
                      setEnableSettings?.({ enableAdvanced })
                    }
                  />
                  <Checkbox
                    id="enable-pagination"
                    label="Pagination"
                    checked={props.enableSettings?.enablePagination ?? tablePagination}
                    onCheckedChange={(enablePagination: boolean) =>
                      setEnableSettings?.({ enablePagination })
                    }
                  />
                  <Checkbox
                    id="enable-stats"
                    label="Stats"
                    checked={props.enableSettings?.enableStats}
                    onCheckedChange={(enableStats: boolean) =>
                      setEnableSettings?.({ enableStats })
                    }
                  />
                  <Tooltip
                    message="Formulas are not supported in Pivot Mode."
                    position="top"
                    hide={!isPivotMode}
                  >
                    <span className="flex items-center">
                      <Checkbox
                        id="enable-formulas"
                        label="Formulas"
                        disabled={isPivotMode}
                        checked={props.enableSettings?.enableFormulas}
                        onCheckedChange={(enableFormulas: boolean) =>
                          setEnableSettings?.({ enableFormulas })
                        }
                      />
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="obb-divider" />
          </>
        )}

        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={setDecimalDigitsSettings}
        />

        <TableColumnSettings />
      </>
    );
  },
);

function TableColumnSettings() {
  const widget = useWidgetContext().widget;
  const { gridRef, columnDefsRef, columnVisibility, setColumnVisibility } =
    useAgGridContext();

  const [state, dispatch] = useStateReducer({
    search: "",
    isLoading: !ensureAgGrid(gridRef.current) || columnDefsRef.current?.length === 0,
    errorMessage: "",
  });
  const [debouncedSearch] = useDebounceValue(state.search, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const period = useMemo(() => {
    const storage = getWidgetStorage(widget);
    return storage?.period;
  }, [widget]);

  useEffect(() => {
    if (ensureAgGrid(gridRef.current)) {
      const visibility = {};
      for (const col of columnDefsRef.current) {
        // @ts-expect-error
        if (col?.children) {
          // @ts-expect-error
          visibility[col.field] = col.children.some((child) =>
            gridRef.current?.api?.getColumn(child.field)?.isVisible(),
          );
        } else {
          visibility[col.field] = gridRef.current?.api
            ?.getColumn(col.field)
            ?.isVisible();
        }
      }
      setColumnVisibility(visibility);
    }
  }, [gridRef.current?.api, columnDefsRef?.current]);

  const setColumnVisibilityCallback = useCallback(
    (colId: string, visibility: boolean) => {
      // Update the local state, not the actual grid
      setColumnVisibility((prev) => ({ ...prev, [colId]: visibility }));
    },
    [setColumnVisibility, columnVisibility],
  );

  const sortedColumnDefs = useMemo(() => {
    // Filter out the "Index" column and sort the rest by year in descending order
    const indexCol = columnDefsRef?.current?.find((col) => col.field === "Index");
    const yearCols = columnDefsRef?.current
      ?.filter((col) => col.field !== "Index" && !col.rowGroup)
      .sort((a, b) => {
        const yearA = Number.parseInt(a.field, 10);
        const yearB = Number.parseInt(b.field, 10);
        return yearB - yearA;
      });

    // If "Index" column exists, place it at the beginning of the array
    return indexCol ? [indexCol, ...yearCols] : yearCols;
  }, [columnDefsRef?.current, period]);

  const filteredColumnDefs = useMemo(() => {
    if (!debouncedSearch) return sortedColumnDefs;

    return sortedColumnDefs?.filter((col) =>
      col.headerName?.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );
  }, [sortedColumnDefs, debouncedSearch]);

  useEffect(() => {
    const isLoading =
      !ensureAgGrid(gridRef.current) || columnDefsRef.current?.length === 0;
    const getErrorMessage = () => {
      return document.getElementById(`widget-error-${widget.id}`)?.textContent;
    };

    let timeout: NodeJS.Timeout;
    if (isLoading) {
      timeout = setTimeout(() => {
        const errorMessage = getErrorMessage();
        dispatch({ isLoading: false, errorMessage });
      }, 1000);
    } else dispatch({ isLoading, errorMessage: getErrorMessage() });

    return () => clearTimeout(timeout);
  }, [gridRef.current?.api?.isDestroyed(), columnDefsRef.current?.length]);

  const isError = Boolean(state.errorMessage);

  return (
    <>
      <div className="obb-divider" />
      <div>
        <div className="mb-1.5 body-xs-bold text-light-900 dark:text-light-50">
          Table Columns
        </div>
        <div className="flex items-center justify-between gap-2">
          <Input
            ref={inputRef}
            prefix={<Icon id="search" />}
            placeholder="Search"
            className="h-8 [&_input]:h-8 flex-1"
            defaultValue={state.search}
            onChange={(search: string) => {
              dispatch({ search });
              if (inputRef.current) {
                inputRef.current.value = search;
              }
            }}
            disabled={state.isLoading || isError}
          />
          <div className="[&_label]:whitespace-nowrap">
            <Checkbox
              id={`all-${widget.id}`}
              checked={Object.values(columnVisibility).every((val) => val)}
              onCheckedChange={(val) => {
                const newVisibility = {};
                for (const field in columnVisibility) {
                  newVisibility[field] = val;
                }
                setColumnVisibility(newVisibility);
              }}
              labelPosition="left"
              label="Select All"
              className="[&_label]:max-w-full! ml-1"
              disabled={state.isLoading || isError}
            />
          </div>
        </div>
      </div>
      <div className="-ml-0.5 flex h-[192px] max-h-[192px] flex-col gap-2 overflow-y-auto">
        {isError ? (
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-light-400 dark:text-dark-400 body-xs">
              {state.errorMessage}
            </p>
          </div>
        ) : state.isLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <BrandedLogo />
            <p className="text-light-400 dark:text-dark-400 body-xs">Loading...</p>
          </div>
        ) : (
          filteredColumnDefs?.map((col) => (
            <div
              key={col.field}
              className="flex items-center justify-between gap-2 dark:bg-dark-800 rounded-sm p-2.5 bg-light-50"
            >
              <div className="line-clamp-1 break-words flex-1" title={col.headerName}>
                {col.headerName}
              </div>
              <Checkbox
                id={col.field + widget.id}
                checked={columnVisibility[col.field]}
                onCheckedChange={(val) => {
                  // @ts-expect-error
                  if (col?.children?.length > 0) {
                    // @ts-expect-error
                    for (const child of col.children) {
                      setColumnVisibilityCallback(child.field, Boolean(val));
                    }
                  }
                  setColumnVisibilityCallback(col.field, Boolean(val));
                }}
              />
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default TableSettings;
