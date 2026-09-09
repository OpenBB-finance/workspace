import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "~/components/ds/atoms/Input";
import Icon from "~/components/Icon";
import ChevronDownIcon from "~/components/Icons/ChevronDown";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { beautifySlug, cn, ensureArray } from "~/lib/utils";

export default function CompareTermsParam({
  className = "obb-parameter",
  toolTipMessage,
  selectedLabel,
  popupWidth,
  contentClassName,
  value,
  onUpdateParam,
}: {
  className?: string;
  toolTipMessage?: string | ReactNode;
  selectedLabel: string;
  popupWidth?: number;
  contentClassName?: string;
  value?: string; // comma separated values e.g., google,apple,microsoft
  onUpdateParam?: (val: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => {
    return ensureArray(value)
      .map((term) => term?.toString()?.trim())
      .filter(Boolean);
  }, [value]);

  const [state, dispatch] = useStateReducer({
    search: "",
    open: false,
    terms,
    pending: false,
  });

  const handleUpdate = useDebouncedCallback((terms: string) => {
    onUpdateParam?.(terms);
    dispatch({ pending: false });
  }, 600);

  const handleAddTerm = useCallback(
    () =>
      dispatch((prev) => {
        const newTerms = new Set(prev.terms);
        const trimmed = prev.search
          .split(",")
          .map((term) => term.trim())
          .filter((term) => term && !newTerms.has(term));

        // No new terms to add
        if (trimmed.length === 0) return { ...prev, search: "" };

        trimmed.forEach((term) => newTerms.add(term));
        prev.terms = Array.from(newTerms);
        return { ...prev, search: "", pending: true };
      }),
    [],
  );

  useEffect(() => {
    if (state.pending) {
      handleUpdate.cancel();
      handleUpdate(state.terms.join(","));
    }
  }, [state.terms]);

  const handleRemoveTerm = useCallback(
    (termToRemove: string) =>
      dispatch({
        terms: (prev) => prev.filter((term) => term !== termToRemove),
        search: "",
        pending: true,
      }),
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTerm();
      }
    },
    [handleAddTerm],
  );

  const currentTerms = state.pending ? state.terms : terms;

  const label = useMemo(() => {
    const terms = currentTerms;
    if (terms.length === 1) return terms?.[0];
    const label = beautifySlug(selectedLabel, false);
    return terms?.length > 1 ? `${label} (${terms?.length})` : label;
  }, [currentTerms, selectedLabel]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = state.search;
    }
  }, [inputRef, state.search]);

  useEffect(() => {
    if (state.open) queueMicrotask(() => inputRef.current?.focus?.());
  }, [state.open, inputRef]);

  const onOpenChange = useCallback(
    (open: boolean) => dispatch({ open, ...(!open && { search: "" }) }),
    [],
  );

  return (
    <DropdownMenuPrimitive.Root open={state.open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger
        className={cn(
          className,
          "flex items-center justify-between gap-1 h-[20px] text-xs cursor-pointer",
        )}
      >
        {toolTipMessage ? (
          <Tooltip message={toolTipMessage} position="top">
            <span className="truncate">{label}</span>
          </Tooltip>
        ) : (
          <span className="truncate">{label}</span>
        )}
        <ChevronDownIcon className="h-3 w-3" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          onCloseAutoFocus={(e) => {
            e.stopPropagation();
            if (inputRef.current) inputRef.current.blur(); // Prevents focus from moving to the input when closing
          }}
          style={{
            minWidth: popupWidth ? `${popupWidth}px` : "200px",
            maxWidth: popupWidth ? `${popupWidth}px` : "200px",
            width: popupWidth ? `${popupWidth}px` : "200px",
          }}
          className={cn(
            "obb-dropdown-container shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-[0px_2px_10px_0px_rgba(0,0,0,0.4)]",
            "z-60 inline-flex h-full flex-col items-start justify-start gap-0 rounded",
            "max-h-[400px] overflow-y-auto overflow-x-hidden",
            contentClassName,
          )}
          sideOffset={5}
          alignOffset={-5}
          align="start"
        >
          <Input
            ref={inputRef}
            size="sm"
            className="w-full"
            placeholder="Add search term"
            clearable={true}
            onChange={(search: string) => dispatch({ search })}
            onKeyDown={handleKeyDown}
            defaultValue={state.search}
          />
          <div className="obb-divider my-2" />
          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto w-full text-xs">
            {currentTerms.length === 0 && (
              <p className="dark:text-dark-100 text-light-400">No terms added</p>
            )}
            {currentTerms.map((item, index) => (
              <div key={`term-${index}`} className="flex items-center gap-1.5 p-1">
                <Icon
                  id="x-outline-circle"
                  className="size-[14px] cursor-pointer hover:opacity-70 flex-shrink-0"
                  onClick={() => handleRemoveTerm(item)}
                />
                <Tooltip message={item} position="top">
                  <span className="truncate flex-1 min-w-0">{item}</span>
                </Tooltip>
              </div>
            ))}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
