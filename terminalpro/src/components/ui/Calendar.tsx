import type * as React from "react";
import { DayPicker, type SelectProps } from "react-day-picker";
import { cn } from "~/lib/utils";
import { Select } from "../ds/atoms/Select";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  isSingle?: boolean;
};

// Calculate dynamic date range: 30 years back and 5 years forward from current date
const currentYear = new Date().getFullYear();
const MAX_DATE = new Date(currentYear + 5, 11, 31);
const MIN_DATE = new Date(currentYear - 90, 0, 1);

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  isSingle = false,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      startMonth={MIN_DATE}
      endMonth={MAX_DATE}
      showOutsideDays={showOutsideDays}
      className={cn("p-2 [&_table]:border-separate!", className)}
      classNames={{
        weekday: "text-dark-50 font-normal",
        months: "flex", // first:[&>.rdp-month]:mr-4",
        month_grid: "p-1",
        disabled: "bg-light-50! text-light-200! dark:text-dark-500! dark:bg-dark-700!",
        month_caption: "text-center",
        dropdown: "obb-minimal-input h-6 p-0.5",
        // Year sizes to its content so it never clips; the month takes the rest
        // and clamps instead (a fixed % split can't fit "September" and a
        // 4-digit year in the ~200px popover). `px-6` clears the absolutely
        // positioned prev/next buttons.
        dropdowns: "grid grid-cols-[minmax(0,1fr)_auto] gap-1 px-6",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium hidden",
        head_row: "flex",
        nav: "space-x-1 flex items-center",
        table: "w-full border-separate! border-spacing-1",
        row: "flex w-full",
        day: "bg-light-100 dark:bg-dark-500 min-w-6 size-6 rounded !p-0",
        selected: "bg-light-300! dark:bg-dark-300!",
        day_button: "w-full h-full",
        hidden: "bg-light-50! text-light-200! dark:text-dark-500! dark:bg-dark-700!",
        outside: "bg-light-50! text-light-200! dark:text-dark-500! dark:bg-dark-700!",
        button_next: cn(
          "obb-minimal-input",
          "flex items-center justify-center h-6 w-2 absolute right-3 top-[9px]",
        ),
        button_previous: cn(
          "obb-minimal-input",
          "flex items-center justify-center h-6 w-2 absolute left-3 top-[9px]",
        ),
        chevron: "shrink-0 fill-light-400 size-2",
        ...classNames,
      }}
      /*components={{
        Chevron: (props) => (
          <Button variant="outlined" size="xs" className="size-6" {...props}>
            {props.orientation === "left" ? (
              <Icon name="chevron-left" className="size-4" {...props} />
            ) : (
              <Icon name="chevron-right" className="size-4" {...props} />
            )}
          </Button>
        ),
      }}*/
      components={isSingle ? { Select: SelectComponent } : undefined}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

const SelectComponent = ({
  value,
  onChange,
  children,
  ...selectProps
}: SelectProps) => {
  // @ts-expect-error
  const options = children?.map((child: any) => ({
    label: child.props.children,
    value: child.props.value,
  }));

  return (
    <Select
      {...selectProps}
      // The caption row is h-6 / text-xs; `md`'s gap-2 is too loose for it.
      // (Its padding is moot — `dropdown`'s p-0.5 below wins the twMerge.)
      size="xs"
      className={cn(selectProps.className, "[&_svg]:size-3")}
      // @ts-expect-error
      value={value}
      onValueChange={(newValue) => {
        const syntheticEvent = {
          target: {
            value: newValue,
          },
        } as React.ChangeEvent<HTMLSelectElement>;

        onChange?.(syntheticEvent);
      }}
      options={options}
    />
  );
};

export { Calendar };
