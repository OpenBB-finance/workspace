import { CalendarIcon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import dayjs from "dayjs";
import {
  type ComponentProps,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { formatDate } from "../General/Table/AgGridUtils";
import Tooltip from "../Tooltip";
import { GroupDropdownAnchorContext } from "../Widgets/Helpers/GroupDropdown";
import { Calendar } from "./Calendar";

const DATE_FMT = "MMM DD, YYYY";

type SingleDatePickerProps = {
  triggerClassName?: string;
  defaultDate: string;
  onSave: (date: string) => void;
  toolTipProps?: Omit<ComponentProps<typeof Tooltip>, "children">;
};

export const SingleDatePicker = forwardRef<HTMLButtonElement, SingleDatePickerProps>(
  (
    {
      defaultDate,
      onSave,
      toolTipProps = { hide: true, message: "" },
      triggerClassName = "obb-parameter",
    },
    _ref,
  ) => {
    const [currentDate, setCurrentDate] = useState(
      defaultDate ? dayjs(defaultDate).toDate() : null,
    );
    const [open, setOpen] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const anchorRef = useContext(GroupDropdownAnchorContext);
    const [alignOffset, setAlignOffset] = useState(0);

    const onOpenChange = useCallback(
      (next: boolean) => {
        if (next && anchorRef?.current && triggerRef.current) {
          const a = anchorRef.current.getBoundingClientRect();
          const t = triggerRef.current.getBoundingClientRect();
          setAlignOffset(a.left - t.left);
        }
        setOpen(next);
      },
      [anchorRef],
    );

    const dateButtonContent = useMemo(() => {
      if (!defaultDate) return <span>Pick a date</span>;
      return formatDate(defaultDate, DATE_FMT);
    }, [defaultDate]);

    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Tooltip {...toolTipProps}>
          <Popover.Trigger asChild={true}>
            <Button
              ref={triggerRef}
              id="date"
              variant="outlined"
              size="xs"
              className={cn(
                "flex whitespace-nowrap items-center justify-between px-0.5 gap-0.5 h-[20px] text-xs !border-0",
                !currentDate && "!text-muted-foreground",
                triggerClassName,
              )}
            >
              {dateButtonContent}
              <CalendarIcon className="ml-2 h-4 w-4" />
            </Button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={5}
            alignOffset={alignOffset}
            className={cn(
              "radix-side-top:animate-slide-up radix-side-bottom:animate-slide-down",
              "text-xs z-10 p-0",
              "obb-dropdown-container",
            )}
          >
            <Calendar
              isSingle={true}
              autoFocus={true}
              captionLayout="dropdown"
              mode="single"
              selected={currentDate}
              onSelect={(date) => {
                setCurrentDate(date);
                onSave(date && formatDate(date));
              }}
              defaultMonth={currentDate}
            />
            <Button
              size="xs"
              variant="outlined"
              className="w-fit self-end mr-2.5 mb-2.5"
              disabled={!currentDate}
              onClick={() => {
                setCurrentDate(null);
                onSave("");
              }}
            >
              Clear
            </Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  },
);
