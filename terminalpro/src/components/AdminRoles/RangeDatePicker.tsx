import { CalendarIcon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "../ds/atoms/Button";
import { cn } from "../ds/utils";
import { formatDate } from "../General/Table/AgGridUtils";
import { Calendar } from "../ui/Calendar";

interface RangeDatePickerProps {
  onRangeSelect: (range: DateRange | undefined) => void;
}

const DATE_FMT = "MMM DD, YYYY";

export const RangeDatePicker = ({ onRangeSelect }: RangeDatePickerProps) => {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>();

  const rangeButtonContent = useMemo(() => {
    const { from, to } = dateRange || {};

    if (!(from || to)) return <span>Filter by date</span>;
    if (!to) return <>{formatDate(from, DATE_FMT)}</>;

    return <>{`${formatDate(from, DATE_FMT)} - ${formatDate(to, DATE_FMT)}`}</>;
  }, [dateRange]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild={true}>
        <Button
          size="sm"
          variant="secondary"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            "body-xs-regular h-[35.33px] flex items-center justify-between rounded-sm border [&>span]:line-clamp-1 transition border-general-border-secondary bg-input-field-bg text-ds-text-heading data-[placeholder]:text-ds-text-caption hover:enabled:text-ds-text-heading hover:enabled:bg-input-field-bg-hover hover:enabled:border-general-border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-general-border-primary disabled:cursor-not-allowed disabled:border-general-border-disabled disabled:bg-input-field-bg-disabled disabled:text-general-label-disabled disabled:data-[placeholder]:text-general-label-disabled gap-2 p-2",
          )}
        >
          {rangeButtonContent}
          <CalendarIcon className="ml-auto h-4 w-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className={cn(
            "radix-side-top:animate-slide-up radix-side-bottom:animate-slide-down",
            "z-10 text-xs p-0",
            "obb-dropdown-container _dropdown-container",
          )}
        >
          <Calendar
            initialFocus={true}
            captionLayout="dropdown"
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={(range) => {
              setDateRange(range);
              onRangeSelect(range);
            }}
            numberOfMonths={2}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
