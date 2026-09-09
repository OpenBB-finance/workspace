import { CalendarIcon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import dayjs from "dayjs";
import { forwardRef, useEffect, useMemo } from "react";
import { type DateRange, rangeIncludesDate } from "react-day-picker";
import { useStateReducer } from "~/hooks/useStateReducer";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { useWidgetContext } from "../Widget.context";
import { Calendar, type CalendarProps } from "./Calendar";

const DATE_FMT = "MMM DD, YYYY";
const formatLocalDate = (date: dayjs.ConfigType, template = "YYYY-MM-DD") =>
  dayjs(date).format(template);

type DatePickerProps = CalendarProps & { weekOnly?: boolean };

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  (props, _ref) => {
    const { weekOnly, ...calendarProps } = props;
    const { widget, updateWidget } = useWidgetContext();

    const [state, dispatch] = useStateReducer({
      open: false,
      dateRange: undefined as DateRange | undefined,
    });

    const rangeButtonContent = useMemo(() => {
      const { from, to } = state.dateRange || {};

      if (!(from && to)) return <span>Pick a date</span>;
      if (!to) return <>{formatLocalDate(from, DATE_FMT)}</>;

      return (
        <span className="whitespace-nowrap">{`${formatLocalDate(from, DATE_FMT)} - ${formatLocalDate(to, DATE_FMT)}`}</span>
      );
    }, [state.dateRange]);

    useEffect(() => {
      const { start_date, end_date } = widget?.storage?.params || {};

      dispatch({
        dateRange: {
          from: start_date && dayjs(start_date).toDate(),
          to: end_date && dayjs(end_date).toDate(),
        },
      });
    }, [widget?.storage?.params?.start_date, widget?.storage?.params?.end_date]);

    return (
      <Popover.Root open={state.open} onOpenChange={(open) => dispatch({ open })}>
        <Popover.Trigger asChild={true}>
          <Button
            id="date"
            variant="outlined"
            size="xs"
            className={cn(
              "obb-parameter font-normal! whitespace-nowrap justify-start text-left h-5",
              !state.dateRange && "text-muted-foreground",
            )}
          >
            {rangeButtonContent}
            <CalendarIcon className="ml-2 h-4 w-4" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={5}
            className={cn(
              "radix-side-top:animate-slide-up radix-side-bottom:animate-slide-down",
              "z-10 text-xs p-0",
              "obb-dropdown-container",
            )}
          >
            <Calendar
              autoFocus={true}
              captionLayout="dropdown"
              mode="range"
              defaultMonth={state.dateRange?.from}
              // @ts-expect-error
              selected={state.dateRange}
              // @ts-expect-error
              onSelect={(dateRange) => dispatch({ dateRange })}
              numberOfMonths={2}
              {...(weekOnly && {
                modifiers: {
                  selected: state.dateRange,
                  range_start: state.dateRange?.from,
                  range_end: state.dateRange?.to,
                  range_middle: (date: Date) =>
                    state.dateRange
                      ? rangeIncludesDate(state.dateRange, date, true)
                      : false,
                },
                onDayClick: (day, modifiers) => {
                  if (modifiers.selected) {
                    dispatch({ dateRange: undefined }); // clear the selection if the day is already selected
                    return;
                  }
                  dispatch({
                    dateRange: {
                      from: dayjs(day).startOf("week").day(1).toDate(),
                      to: dayjs(day).endOf("week").day(5).toDate(),
                    },
                  });
                },
              })}
              {...calendarProps}
            />
            <Button
              size="xs"
              className="w-fit self-end mr-2.5 mb-2.5"
              onClick={() => {
                const { from, to } = state.dateRange || {};

                updateWidget((prev) => ({
                  ...prev,
                  storage: {
                    ...(prev?.storage || {}),
                    params: {
                      ...(prev?.storage?.params || {}),
                      start_date: from && formatLocalDate(from),
                      end_date: to && formatLocalDate(to),
                    },
                  },
                }));
                dispatch({ open: false });
              }}
            >
              Save
            </Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  },
);
