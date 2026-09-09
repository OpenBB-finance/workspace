import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import FilterIcon from "~/components/Icons/Filter";
import SquareCheckIcon from "~/components/Icons/SquareCheck";
import Tooltip from "~/components/Tooltip";
import { useAppStore, type Widget } from "~/lib/state/app";
import { INDICES } from "~/seeds/randomSeed";

export default function FilterMarketOverviewModal({ widget }: { widget: Widget }) {
  const { updateWidget } = useAppStore();
  const { id } = useParams();
  return (
    <DialogPrimitive.Root>
      <Tooltip message="Filter indices">
        <DialogPrimitive.Trigger>
          <FilterIcon className="w-4" />
        </DialogPrimitive.Trigger>
      </Tooltip>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="obb-modal-overlay" />
        <DialogPrimitive.Content
          className={clsx(
            "DialogContent fixed z-40 overflow-hidden rounded p-6 text-xs",
            "min-h-[246px] w-[95vw] max-w-2xl md:w-full",
            "left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%]",
            "bg-white text-black dark:bg-[#151518] dark:text-white",
            "focus-visible:ring-brand-main text-black focus:outline-hidden focus-visible:ring-3 focus-visible:ring-opacity-75",
            "flex flex-col",
          )}
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-sm font-bold">
              Filter Indices
              <span className="ml-1 text-[8px] font-normal">
                (click to hide/show indice)
              </span>
            </DialogPrimitive.Title>
            <button
              className="obb-btn"
              onClick={() => {
                if (!id) return;
                updateWidget(id, {
                  ...widget,
                  data: {
                    ...widget.data,
                    securities: INDICES as any,
                  },
                });
              }}
            >
              Reset
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {widget.data?.securities?.map((element) => (
              <button
                key={element.label}
                className="flex items-center gap-1"
                onClick={() => {
                  if (!id) return;
                  updateWidget(id, {
                    ...widget,
                    data: {
                      ...widget.data,
                      securities: widget.data.securities.map((security) =>
                        security.label === element.label
                          ? { ...security, active: !security.active }
                          : security,
                      ),
                    },
                  });
                }}
              >
                <SquareCheckIcon showCheck={element.active} className="mr-1 w-3" />
                {element.label}
              </button>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-end gap-4">
            <DialogPrimitive.Close className="text-xs">Cancel</DialogPrimitive.Close>
            <DialogPrimitive.Close className="obb-btn-tertiary">
              Filter
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
