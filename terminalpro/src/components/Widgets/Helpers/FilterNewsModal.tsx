import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import FilterIcon from "~/components/Icons/Filter";
import Tooltip from "~/components/Tooltip";
import type { Ticker } from "~/lib/state/app";
import { NEWS_TYPES, REGIONS } from "~/seeds/randomSeed";
// @ts-expect-error - ignored for now
import { SelectedTickers } from "./SelectedTickers";

export default function FilterModal({
  selectedEquities,
  handleSelect,
}: {
  selectedEquities: Ticker[];
  handleSelect: (ticker: Ticker, checked: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root>
      <Tooltip message="Filter news">
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
          )}
        >
          <DialogPrimitive.Title className="text-sm font-bold">
            Filter news
          </DialogPrimitive.Title>
          <div className="my-5 grid grid-cols-8 gap-[10px]">
            <label className="col-span-4">
              Keywords
              <input type="text" className="obb-minimal-input" placeholder="Keywords" />
            </label>
            <label className="col-span-2">
              Sector
              <select className="obb-minimal-input">
                <option disabled={true}>Sector</option>
                {NEWS_TYPES.map((newsType) => (
                  <option key={newsType.id}>{newsType.label}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2">
              Region
              <select className="obb-minimal-input">
                <option disabled={true}>Region</option>
                {REGIONS.map((region) => (
                  <option key={region.id}>{region.label}</option>
                ))}
              </select>
            </label>

            <label className="col-span-2">
              Symbol
              <SelectedTickers tickers={selectedEquities} handleSelect={handleSelect} />
            </label>

            <label className="col-span-2">
              Language
              <select className="obb-minimal-input">
                <option disabled={true}>Language</option>
                {REGIONS.map((region) => (
                  <option key={region.id}>{region.label}</option>
                ))}
              </select>
            </label>

            <label className="col-span-4">
              Relevance
              <select className="obb-minimal-input">
                <option disabled={true}>Relevance</option>
                {REGIONS.map((region) => (
                  <option key={region.id}>{region.label}</option>
                ))}
              </select>
            </label>
            <label className="col-span-4">
              Start date
              <input type="date" className="obb-minimal-input" />
            </label>
            <label className="col-span-4">
              End date
              <input type="date" className="obb-minimal-input" />
            </label>
          </div>
          <div className="flex items-center justify-end gap-4">
            <DialogPrimitive.Close className="text-xs">Cancel</DialogPrimitive.Close>
            <button className="obb-btn-tertiary">Create</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
