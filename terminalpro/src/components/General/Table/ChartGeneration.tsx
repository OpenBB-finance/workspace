import type {
  CellSelectionChangedEvent,
  GetContextMenuItemsParams,
} from "ag-grid-community";
import { type MouseEvent as ReactMouseEvent, useCallback, useRef } from "react";
import { toast } from "sonner";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useTutorialStore } from "~/lib/state/tutorial";
import { cn } from "~/lib/utils";
import { checkCellRange, getContextMenuItems } from "./AgGridUtils";
import { ensureAgGrid, useAgGridContext } from "./hooks";

const chartCellLimit =
  Number(import.meta.env.VITE_CHART_FROM_TABLE_CELL_LIMIT) || 200000;

export default function ChartGeneration({
  params,
}: {
  params?: CellSelectionChangedEvent;
}) {
  const { isPreview } = useWidgetContext();
  const { gridRef } = useAgGridContext();
  const { currentTutorial, currentStep, goToStep } = useTutorialStore();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!params?.api || params?.api?.isDestroyed()) return;
      if (currentTutorial === "table_charting" && currentStep === 2) {
        setTimeout(() => {
          goToStep(3);
        }, 500);
      }
      let column = null;
      const cellRangeParams = params.api.getCellRanges();
      const rowModelType = params.api.getGridOption("rowModelType");
      const specificRangeParams = cellRangeParams[cellRangeParams.length - 1];
      const { startColumn, endRow, columns } = specificRangeParams;

      let rowNode = params.api.getRowNode(endRow.rowIndex.toString())?.data || null;

      // @ts-expect-error
      if (startColumn?.colId === columns[0]?.colId) {
        column = columns[columns.length - 1];
      } else {
        column = columns[0];
      }

      const rowNodes = [];
      if (rowModelType === "serverSide" && !rowNode) {
        gridRef.current.api.forEachNode((node) => {
          if (node.data)
            rowNodes.push(
              Object.fromEntries(
                Object.entries(node.data).filter(
                  ([_key, value]) => typeof value !== "object",
                ),
              ),
            );
        });
      }

      if (!rowNode && rowNodes.length > 0) {
        rowNode = rowNodes[rowNodes.length - 1];
      }

      const value = rowNode?.[column.colId];

      const moveEvent = {
        source: "ui" as const,
        x: event.clientX,
        y: event.clientY,
        preventDefault: () => {},
      };

      const contextParams = gridRef?.current as unknown as GetContextMenuItemsParams;

      params.api.updateGridOptions({
        getContextMenuItems: () => {
          const menus = getContextMenuItems(contextParams);

          const chartMenu = menus.find((menu: any) => menu?.name === "Chart") as any;

          return chartMenu.subMenu;
        },
      });

      params.api.showContextMenu({ rowNode, column, value, ...moveEvent });

      setTimeout(() => {
        params.api.updateGridOptions({
          getContextMenuItems: () => getContextMenuItems(contextParams),
        });
      }, 100);
    },
    [params, currentTutorial, currentStep, goToStep, gridRef],
  );

  const {
    pulseAnimationButtonsAlreadyClicked,
    setPulseAnimationButtonsAlreadyClicked,
  } = useShallowThemeStore((state) => ({
    pulseAnimationButtonsAlreadyClicked: state.pulseAnimationButtonsAlreadyClicked,
    setPulseAnimationButtonsAlreadyClicked:
      state.setPulseAnimationButtonsAlreadyClicked,
  }));

  const checkIfParamsValid = useCallback(() => {
    if (!ensureAgGrid(params)) return false;
    if (!params?.api?.getCellRanges?.()?.length) return false;
    const { totalSeries } = checkCellRange(params);
    if (totalSeries === 0) return false;
    return true;
  }, [params]);

  const areParamsValid = checkIfParamsValid();

  return (
    <Tooltip
      message={
        isPreview
          ? "Chart generation is not available in preview mode"
          : "Select the data you are interested in charting in advance"
      }
    >
      <button
        onClick={(e) => {
          setPulseAnimationButtonsAlreadyClicked(true);
          if (areParamsValid) {
            const { totalSelectedCells } = checkCellRange(params);
            if (totalSelectedCells > chartCellLimit) {
              toast.warning("Too many cells selected", {
                description: `Maximum number of cells for charting is ${chartCellLimit}. You have selected ${totalSelectedCells} cells. Please select a smaller range.`,
              });
              return;
            }
            onClick(e);
          } else {
            toast.warning("Need to select data", {
              description:
                "Before charting, click and drag over the data you are interested in visualizing",
            });
          }
        }}
        disabled={!areParamsValid || isPreview}
        ref={buttonRef}
        className={cn(
          "rounded-[2px] p-0.5 disabled:cursor-not-allowed disabled:text-light-300 dark:disabled:text-[#46464F]",
          {
            "bg-brand-main text-white": areParamsValid && !isPreview,
            "pulse-box-shadow-blue":
              !pulseAnimationButtonsAlreadyClicked && areParamsValid,
          },
          "_chart-dropdown",
        )}
      >
        <Icon id="chart-icon" className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
