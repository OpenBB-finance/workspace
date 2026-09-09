import { type ReactNode, useCallback, useMemo, useState } from "react";
import { DropdownMenuContentVariants } from "~/components/ds/atoms/DropdownMenu";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "~/components/ds/atoms/Popover";
import Tooltip from "~/components/Tooltip";
import useIsMobile from "~/hooks/useIsMobile";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { cn } from "~/lib/utils";
import type { SemanticViewSuggestion } from "./hooks/useSemanticViewSuggestions";
import {
  type SlashCommandItem,
  SlashSuggestionItem,
} from "./hooks/useSlashCommandSuggestions";
import { dispatchCopilotCommand } from "./hooks/utils";

interface SemanticViewsDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function SemanticViewsDropdown({
  open,
  onOpenChange,
  children,
}: SemanticViewsDropdownProps) {
  const isMobile = useIsMobile();
  const semanticViews = useShallowBackendConnectorStore((s) => s.semanticViews);

  const items = useMemo<SlashCommandItem<SemanticViewSuggestion>[]>(
    () =>
      Object.values(semanticViews).map((v) => ({
        ...v,
        type: "semanticView" as const,
        slashText: `/sv:${v.fqn}`,
      })),
    [semanticViews],
  );

  const handleSelect = useCallback(
    (item: SlashCommandItem) => {
      dispatchCopilotCommand((prev) => `${prev}${item.slashText} `);
      onOpenChange(false);
      setTimeout(() => {
        document.getElementById("copilot-input")?.focus();
      }, 100);
    },
    [onOpenChange],
  );

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange}>
      {children}
      <PopoverContent
        align="start"
        side="top"
        sideOffset={4}
        className={cn(DropdownMenuContentVariants(), "w-80 p-2.5 flex flex-col gap-1")}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-1 text-2xs font-semibold text-ds-text-caption uppercase tracking-wide">
          Semantic Views
        </div>

        <div className="overflow-y-auto overflow-x-hidden max-h-64 flex flex-col">
          {items.length > 0 ? (
            items.map((item, index) => (
              <SlashSuggestionItem
                key={item.fqn}
                item={item}
                index={index}
                onSelect={handleSelect}
                isMobile={isMobile}
              />
            ))
          ) : (
            <div className="p-4 text-center text-ds-text-caption text-sm">
              No semantic views discovered.
            </div>
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

export function SemanticViewsButton() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <SemanticViewsDropdown open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <PopoverTrigger asChild={true}>
        <Tooltip message="Semantic Views" hide={isMobile}>
          <button
            type="button"
            id="semantic-views-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
              "text-ds-text-body hover:bg-general-bg-primary-hover cursor-pointer",
            )}
          >
            <span className="text-sm font-medium leading-none">SV</span>
          </button>
        </Tooltip>
      </PopoverTrigger>
    </SemanticViewsDropdown>
  );
}
