import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import type React from "react";
import {
  Fragment,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useStateReducer } from "~/hooks/useStateReducer";
import { cn } from "~/lib/utils";
import { Input } from "./ds/atoms/Input";
import Icon from "./Icon";
import ChevronDownIcon from "./Icons/ChevronDown";

function isMultiSelect(selected: string[] | string): selected is string[] {
  return Array.isArray(selected);
}

type ValuesType = {
  label: string;
  value: string;
  extraInfo?: {
    description: string;
    rightOfDescription: string;
  };
};

type AdvancedSelectProps = {
  label: string;
  values: ValuesType[];
  contentClassName?: string;
  onSelect: (value: string | string[]) => void;
  onRemove?: (value: string) => void;
  onAdd?: (value: ValuesType) => void;
  selected?: string[] | string;
  withSearch?: boolean;
  allowSelection?: boolean;
  selectionListType?: string;
};

export const AdvancedSelect = forwardRef<HTMLInputElement, AdvancedSelectProps>(
  (props, _ref) => {
    const {
      values,
      onSelect,
      onRemove,
      onAdd,
      label,
      selected = "",
      contentClassName = "",
      withSearch = true,
      allowSelection = true,
      selectionListType = "Items",
    } = props;

    const inputRef = useRef<HTMLInputElement>(null);
    const isMulti = useMemo(() => isMultiSelect(selected), [selected]);

    const [state, dispatch] = useStateReducer({
      input: "",
      selected,
      pending: false,
      open: false,
    });

    const [newItemInput, setNewItemInput] = useState("");

    const handleSelect = useDebouncedCallback(onSelect, 300);

    const handleSetSelected = useCallback(
      (value: ValuesType & { selected: boolean }) => {
        if (allowSelection) {
          dispatch({
            pending: true,
            selected: (prev) => {
              if (isMultiSelect(prev)) {
                return value.selected
                  ? [...prev, value.value]
                  : prev.filter((v) => v !== value.value);
              }
              return value.value;
            },
          });
        }
      },
      [dispatch, allowSelection],
    );

    const handleRemove = useCallback(
      (valueToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({
          pending: true,
          selected: (prev) => {
            if (isMultiSelect(prev)) {
              const newSelected = prev.filter((v) => v !== valueToRemove);
              // If all items are removed, select the first available value
              return newSelected.length === 0 && values.length > 0
                ? [values[0].value]
                : newSelected;
            }
            if (allowSelection) {
              // For single select, choose the next available value
              const currentIndex = values.findIndex((v) => v.value === prev);
              const nextIndex = (currentIndex + 1) % values.length;
              return values[nextIndex].value;
            }
          },
        });
        onRemove?.(valueToRemove);
      },
      [dispatch, onRemove, values, allowSelection],
    );

    const handleRemoveKeepSelected = useCallback(
      (valueToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({
          pending: true,
          selected: (prev) => {
            if (isMultiSelect(prev)) {
              return prev.filter((v) => v !== valueToRemove);
            }
            // For single select, keep the same value
            return prev;
          },
        });
        onRemove?.(valueToRemove);
      },
      [dispatch, onRemove],
    );

    const handleAddNewItem = useCallback(() => {
      if (newItemInput.trim() && onAdd) {
        const trimmedInput = newItemInput.trim();
        const itemExists = values.some(
          (item) => item.value.toLowerCase() === trimmedInput.toLowerCase(),
        );

        if (itemExists) {
          toast.error("That value already exists.", {
            description: "Please add a different one.",
          });
        } else {
          const newItem: ValuesType = {
            label: trimmedInput,
            value: trimmedInput,
          };
          onAdd(newItem);
          setNewItemInput("");
          // Update the selected state
          dispatch({
            pending: true,
            selected: isMulti
              ? [...(state.selected as string[]), newItem.value]
              : newItem.value,
          });
        }
      }
    }, [newItemInput, onAdd, dispatch, isMulti, state.selected, values]);

    useEffect(() => {
      if (state.pending && allowSelection) {
        handleSelect(state.selected);
        const stateUpdate = { pending: false } as typeof state;
        if (!isMulti) stateUpdate.open = false;
        dispatch(stateUpdate);
      }
    }, [
      state.pending,
      handleSelect,
      state.selected,
      isMulti,
      dispatch,
      allowSelection,
    ]);

    const filterValues = useMemo(() => {
      if (!isMulti)
        return values.map((v) => ({ ...v, selected: state.selected === v.value }));
      const input = state.input;
      return values
        .filter((category) => {
          if (input) {
            return (
              category.label.toLowerCase().includes(input.toLowerCase()) ||
              category.extraInfo?.description
                .toLowerCase()
                .includes(input.toLowerCase()) ||
              category.extraInfo?.rightOfDescription
                .toLowerCase()
                .includes(input.toLowerCase())
            );
          }
          return true;
        })
        .map((v) => ({ ...v, selected: state.selected.includes(v.value) }));
    }, [values, state.selected, state.input, isMulti]);

    return (
      <DropdownMenuPrimitive.Root
        open={state.open}
        onOpenChange={(open) => dispatch({ open })}
      >
        <DropdownMenuPrimitive.Trigger
          className={clsx(
            "obb-minimal-input flex items-center justify-between gap-1 bg-light-50 px-2.5 h-[20px] text-xs",
          )}
        >
          {allowSelection ? label : selectionListType}
          <ChevronDownIcon className="h-3 w-3" />
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            onCloseAutoFocus={(e) => e.preventDefault()}
            style={{
              boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
            }}
            className={cn(
              "z-60 inline-flex h-full flex-col items-start justify-start gap-4 rounded bg-white p-2 shadow-sm dark:bg-[#24242A]",
              "max-h-[400px] overflow-y-auto",
              {
                "w-[525px]": isMulti,
                "w-[165px]": !isMulti,
              },
              contentClassName,
            )}
            sideOffset={5}
            align="start"
          >
            <div className="flex items-center gap-2">
              <input
                className="obb-minimal-input w-full"
                placeholder="Add new item"
                value={newItemInput}
                onChange={(e) => setNewItemInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewItem();
                  }
                }}
              />
              <button
                onClick={handleAddNewItem}
                className="text-light-500 hover:text-light-700 dark:text-light-400 dark:hover:text-light-200"
              >
                <Icon id="plus" className="h-4 w-4" />
              </button>
            </div>
            {isMulti && withSearch && (
              <Input
                size="sm"
                className="w-full"
                ref={inputRef}
                placeholder="Search"
                prefix={<Icon id="search" />}
                value={state.input}
                onChange={(input) => dispatch({ input: input.toString() })}
              />
            )}
            <div className="w-full text-xs">
              {isMulti && withSearch && (
                <p className="text-2xs mb-1 uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  RESULTS
                </p>
              )}
              <div className="flex flex-col gap-1">
                {filterValues?.map((category, idx) => (
                  <Fragment key={category.value}>
                    <div
                      onClick={(e) => {
                        if (!e.defaultPrevented && allowSelection) {
                          handleSetSelected({
                            ...category,
                            selected: !category.selected,
                          });
                        }
                      }}
                      className={clsx(
                        "w-full whitespace-nowrap p-1 rounded text-left text-xs text-light-900 hover:bg-[#CCDEEE] dark:text-white dark:hover:bg-[#36363F]",
                        "flex justify-between items-center gap-2 group",
                        {
                          "cursor-pointer": allowSelection,
                          "cursor-default": !allowSelection,
                        },
                      )}
                    >
                      <span className="grow">{category.label}</span>
                      <span className="flex items-center gap-2">
                        {category.selected &&
                          (allowSelection ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemove(category.value, e);
                              }}
                              className="text-light-500 hover:text-light-700 dark:text-light-400 dark:hover:text-light-200"
                            >
                              <Icon id="trash-icon" className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                handleRemoveKeepSelected(category.value, e);
                              }}
                              className="hidden group-hover:block text-light-500 hover:text-light-700 dark:text-light-400 dark:hover:text-light-200"
                            >
                              <Icon id="trash-icon" className="h-3 w-3" />
                            </button>
                          ))}
                        {isMulti && category.selected && allowSelection && (
                          <Icon
                            id="checkmark-icon"
                            className="min-w-3 min-h-3 h-3 w-3"
                          />
                        )}
                      </span>
                      {!category.selected && (
                        <button
                          onClick={(e) => {
                            handleRemoveKeepSelected(category.value, e);
                          }}
                          className="hidden group-hover:block text-light-500 hover:text-light-700 dark:text-light-400 dark:hover:text-light-200"
                        >
                          <Icon id="trash-icon" className="min-w-3 min-h-3 h-3 w-3" />
                        </button>
                      )}
                      {!isMulti && category.selected && allowSelection && (
                        <Icon id="checkmark-icon" className="min-w-3 min-h-3 h-3 w-3" />
                      )}
                      {isMulti && category.extraInfo && (
                        <span className="uppercase tracking-wide flex gap-1">
                          <span className="text-light-500 dark:text-[#8A8A90]">
                            {category.extraInfo.description}
                          </span>
                          <span className="text-light-900 dark:text-white">
                            {category.extraInfo.rightOfDescription}
                          </span>
                        </span>
                      )}
                    </div>
                    {isMulti && idx !== values.length - 1 && (
                      <div className="obb-divider" />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );
  },
);

export default memo(AdvancedSelect);
