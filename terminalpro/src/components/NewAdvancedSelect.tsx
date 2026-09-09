import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type ForwardedRef,
  forwardRef,
  type MutableRefObject,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedCallback } from "use-debounce";
import { useStateReducer } from "~/hooks/useStateReducer";
import { cn } from "~/lib/utils";
import { Input } from "./ds/atoms/Input";
import Icon from "./Icon";
import ChevronDownIcon from "./Icons/ChevronDown";
import Tooltip from "./Tooltip";
import { GroupDropdownAnchorContext } from "./Widgets/Helpers/GroupDropdown";

type ValueType = string | number | boolean;

function isMultiSelect(selected: unknown): selected is ValueType[] {
  return Array.isArray(selected);
}

export type TSelectValues = {
  label: string;
  value: ValueType;
  extraInfo?: { description: string; rightOfDescription: string };
};

type AdvancedSelectProps<SelectedType = ValueType | ValueType[]> = {
  className?: string;
  label: string;
  values: TSelectValues[];
  contentClassName?: string;
  onSelect: (selected: SelectedType) => void;
  selected: SelectedType;
  withSearch?: boolean;
  forceSearch?: boolean;
  forceExtraInfo?: boolean;
  toolTipMessage?: string | ReactNode;
  listWidth?: number | string;
  popupWidth?: number;
  onOpenChange?: (open: boolean) => void;
};

type ElementRefsType = { div?: HTMLDivElement | null; span?: HTMLSpanElement | null };

function VirtualizedSelectList({
  items,
  showExtraInfo,
  handleSetSelected,
  refs,
  width,
  popupWidth,
  onWidthChange,
}: {
  items: (TSelectValues & { selected: boolean })[];
  showExtraInfo: boolean;
  handleSetSelected: (value: TSelectValues & { selected: boolean }) => void;
  refs: MutableRefObject<Record<number, ElementRefsType>>;
  width: number | string;
  popupWidth?: number;
  onWidthChange: (width: number | string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<Record<number, number>>({});
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 10,
    getItemKey: (index) => `${items[index]?.label}-${items[index]?.value}`,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const visibleStart = virtualItems[0]?.index ?? -1;
  const visibleEnd = virtualItems[virtualItems.length - 1]?.index ?? -1;

  useEffect(() => {
    if (visibleStart === -1) return;

    let newWidth: number | null = null;
    for (let i = visibleStart; i <= visibleEnd; i++) {
      if (widthsRef.current[i]) continue;

      const current = refs.current[i];
      const spanWidth = current?.span?.getBoundingClientRect()?.width || 0;
      const divWidth = current?.div?.getBoundingClientRect()?.width || 0;
      const w = Math.ceil(Math.max(spanWidth + 30, divWidth, 100));

      if (w) {
        widthsRef.current[i] = w;
        newWidth = Math.min(
          (popupWidth || 525) - 20,
          Math.max(...Object.values(widthsRef.current), showExtraInfo ? 300 : 190),
        );
      }
    }
    if (newWidth) {
      onWidthChangeRef.current(newWidth);
    }
  }, [visibleStart, visibleEnd, items.length, showExtraInfo, popupWidth, refs]);

  return (
    <div
      ref={scrollRef}
      style={{
        maxHeight: 300,
        minWidth: popupWidth ? undefined : "8rem",
        width,
        overflow: "auto",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <Row
              index={virtualRow.index}
              item={items[virtualRow.index]}
              showExtraInfo={showExtraInfo}
              handleSetSelected={handleSetSelected}
              refs={refs}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const DISABLE_VALUES: ValueType[] = [
  "Loading...",
  "Failed to fetch options",
  "Invalid endpoint options",
];

const Row = memo(
  ({
    index,
    item,
    showExtraInfo,
    handleSetSelected,
    refs,
  }: {
    index: number;
    item: TSelectValues & { selected: boolean };
    showExtraInfo: boolean;
    handleSetSelected: (value: TSelectValues & { selected: boolean }) => void;
    refs: MutableRefObject<Record<number, ElementRefsType>>;
  }) => {
    const [isSelected, setIsSelected] = useState(item.selected);

    useEffect(() => {
      setIsSelected(item.selected);
    }, [item.selected]);

    return (
      <div
        ref={(el) =>
          (refs.current[index] = { ...(refs.current[index] || {}), div: el })
        }
        onClick={() => {
          if (DISABLE_VALUES.includes(item.value)) return;
          handleSetSelected({ ...item, selected: !isSelected });
          setIsSelected((prev) => !prev);
        }}
        className="w-full whitespace-nowrap p-1 rounded
          cursor-pointer text-left text-xs text-light-900 hover:bg-[#CCDEEE]
          dark:text-white dark:hover:bg-[#36363F] flex justify-between items-center gap-2"
      >
        <span
          ref={(el) =>
            (refs.current[index] = { ...(refs.current[index] || {}), span: el })
          }
          className={cn({ "inline-flex gap-2 items-center": showExtraInfo })}
        >
          {item.label}
          {showExtraInfo && isSelected && (
            <Icon id="checkmark-icon" className="min-w-3 min-h-3 h-3 w-3" />
          )}
        </span>
        {!showExtraInfo && isSelected && (
          <Icon id="checkmark-icon" className="min-w-3 min-h-3 h-3 w-3" />
        )}
        {showExtraInfo && item.extraInfo && (
          <span className="uppercase tracking-wide flex gap-1">
            <span className="text-light-500 dark:text-[#8A8A90]">
              {item.extraInfo.description}
            </span>
            <span className="text-light-900 dark:text-white">
              {item.extraInfo.rightOfDescription}
            </span>
          </span>
        )}
      </div>
    );
  },
);

export const AdvancedSelect = forwardRef<HTMLInputElement, AdvancedSelectProps>(
  (props, _ref) => {
    const {
      values = [],
      onSelect,
      label,
      selected,
      toolTipMessage,
      contentClassName = "",
      withSearch = true,
      forceSearch = false,
      forceExtraInfo = false,
      listWidth = "100%",
      popupWidth,
      className = "obb-parameter",
      onOpenChange: onOpenChangeProp,
    } = props;

    const inputRef = useRef<HTMLInputElement>(null);
    const valuesRef = useRef<TSelectValues[]>(values);
    const elementRefs = useRef<Record<number, ElementRefsType>>({});

    const isMulti = useMemo(() => isMultiSelect(selected), [selected]);

    const [state, dispatch] = useStateReducer({
      input: "",
      selected,
      pending: null as number | null,
      open: false,
    });

    const handleOnSelect = useCallback(
      (sel: ValueType | ValueType[]) => {
        onSelect(sel);
        dispatch({ pending: null });
      },
      [onSelect],
    );

    const debouncedonSelect = useDebouncedCallback(handleOnSelect, isMulti ? 600 : 300);

    const handleSetSelected = useCallback(
      (value: TSelectValues & { selected: boolean }, clear = false) =>
        dispatch({
          pending: Date.now(),
          selected: (prev) => {
            if (isMultiSelect(prev)) {
              if (clear) return [];
              return value.selected
                ? [...prev, value.value]
                : prev.filter((v) => v !== value.value);
            }
            if (clear) return undefined;
            return value.selected ? value.value : undefined;
          },
          input: "",
        }),
      [],
    );

    useEffect(() => {
      if (state.pending) return;
      dispatch({ selected });
    }, [selected, state.pending]);

    useEffect(() => {
      const valueSet = new Set(values?.map((v) => v.value) || []);
      const isLoading = DISABLE_VALUES.some((v) => valueSet.has(v));
      const currentValues = new Set(valuesRef.current.map((v) => v.value));
      const hasLoading = DISABLE_VALUES.some((v) => currentValues.has(v));

      if (isLoading || hasLoading) {
        if (!(hasLoading && !isLoading)) return;
        valuesRef.current = values;
        elementRefs.current = {};
        return;
      }

      // Option refreshes should not publish a cleared value. Dependent endpoint
      // params are reset by the group cascade logic, not by dropdown loading.
      if (valueSet.isSubsetOf(currentValues)) return;
      valuesRef.current = values;
      elementRefs.current = {};
    }, [values, valuesRef, state.pending, elementRefs]);

    useEffect(() => {
      if (state.pending) {
        debouncedonSelect(state.selected);
        if (!isMulti) dispatch({ open: false });
      }
    }, [state.pending]);

    const { filterValues, hasExtra } = useMemo(() => {
      let newValues = values.map((v) => ({
        ...v,
        selected: isMulti
          ? // @ts-ignore
            selected.includes(v.value)
          : selected === v.value,
      }));

      if (state.input) {
        const input = state.input.toLowerCase();
        newValues = newValues.filter((category) => {
          if (input) {
            const { label: name, extraInfo } = category;
            const { description = "", rightOfDescription = "" } = extraInfo || {};

            return [name, description, rightOfDescription].some((value) =>
              value?.toString()?.toLowerCase()?.includes(input),
            );
          }
          return true;
        });
      }

      const hasExtra = newValues.some((v) => v.extraInfo);
      if (newValues.length > 10)
        return {
          filterValues: newValues.sort((a, b) => {
            if (a.selected) return -1;
            if (b.selected) return 1;
            return 0;
          }),
          hasExtra,
        };

      return { filterValues: newValues, hasExtra };
    }, [values, selected, state.input]);

    const localSelected = state.pending ? state.selected : selected;

    const selectedLabel = useMemo(() => {
      if (!isMulti) {
        const selectedValue = values.find((v) => v.value === localSelected);
        return selectedValue?.label || label;
      }

      // For multi-select, show count or all selected labels
      // @ts-expect-error
      const selectedValues = values.filter((v) => localSelected.includes(v.value));
      if (selectedValues.length > 1) return `${label} (${selectedValues.length})`;

      return selectedValues?.[0]?.label || label;
    }, [values, localSelected, label]);

    const showSearch = forceSearch || (isMulti && withSearch);
    const showExtraInfo = (forceExtraInfo || isMulti) && hasExtra;

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.value = state.input;
      }
    }, [inputRef.current, state.input]);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const anchorRef = useContext(GroupDropdownAnchorContext);
    const [alignOffset, setAlignOffset] = useState(0);

    const onOpenChange = useCallback(
      (open: boolean) => {
        if (open && anchorRef?.current && triggerRef.current) {
          const a = anchorRef.current.getBoundingClientRect();
          const t = triggerRef.current.getBoundingClientRect();
          setAlignOffset(a.left - t.left);
        }
        dispatch({ open, ...(!open && { input: "" }) });
      },
      [anchorRef],
    );

    const [finalWidth, setFinalWidth] = useState<number | string>(
      showExtraInfo ? popupWidth || 300 : listWidth,
    );

    return (
      <DropdownMenuPrimitive.Root open={state.open} onOpenChange={onOpenChange}>
        <DropdownMenuPrimitive.Trigger
          ref={triggerRef}
          className={cn(
            className,
            "flex items-center justify-between gap-1 h-[20px] text-xs cursor-pointer",
          )}
        >
          {toolTipMessage ? (
            <Tooltip message={toolTipMessage} position="top">
              <span className="truncate">{selectedLabel}</span>
            </Tooltip>
          ) : (
            <span className="truncate">{selectedLabel}</span>
          )}
          <ChevronDownIcon className="h-3 w-3" />
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            onCloseAutoFocus={(e) => e.preventDefault()}
            style={{
              boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
              minWidth: popupWidth ? `${popupWidth}px` : "190px",
              maxWidth: popupWidth ? `${popupWidth}px` : "525px",
              width: popupWidth ? `${popupWidth}px` : "fit-content",
            }}
            className={cn(
              "obb-dropdown-container",
              "z-60 inline-flex h-full flex-col items-start justify-start gap-4 rounded",
              "max-h-[400px] overflow-y-auto overflow-x-hidden",
              contentClassName,
            )}
            sideOffset={5}
            align="start"
            alignOffset={alignOffset}
          >
            {showSearch && (
              <Input
                size="sm"
                className="w-full"
                ref={inputRef}
                placeholder="Search"
                prefix={<Icon id="search" />}
                defaultValue={state.input}
                clearable={true}
                onChange={(input) => dispatch({ input: input.toString() })}
              />
            )}
            <div className="w-full text-xs">
              <div className="flex flex-col gap-1">
                <VirtualizedSelectList
                  items={filterValues}
                  showExtraInfo={showExtraInfo}
                  handleSetSelected={handleSetSelected}
                  refs={elementRefs}
                  width={finalWidth}
                  popupWidth={popupWidth}
                  onWidthChange={(w) =>
                    setFinalWidth((prev) => (prev !== w ? w : prev))
                  }
                />
              </div>
            </div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );
  },
) as <T = ValueType | ValueType[]>(
  props: AdvancedSelectProps<T> & { ref?: ForwardedRef<HTMLInputElement> },
) => ReactElement;

export default memo(AdvancedSelect);
