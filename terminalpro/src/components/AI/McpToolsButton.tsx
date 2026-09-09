import { useState } from "react";
import { PopoverTrigger } from "~/components/ds/atoms/Popover";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { cn } from "~/lib/utils";
import { McpToolsDropdown } from "./McpToolsDropdown";

export function McpToolsButton() {
  const contextEnabled = useShallowCopilotStore(
    (s) =>
      Boolean(s.selectedCopilot?.features?.["mcp-tools"]) ||
      (s.orchestrationModeEnabled &&
        s.externalCopilotHolders?.some(
          (holder) =>
            holder.enabled !== false &&
            holder.copilots?.some((agent) => agent.features?.["mcp-tools"] === true),
        )),
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const enabledToolCount = useShallowMcpToolsStore((state) =>
    state.getEnabledToolCount(),
  );

  return (
    <div className="relative flex items-center gap-1 h-8">
      <McpToolsDropdown open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild={true}>
          <Tooltip
            message={
              contextEnabled
                ? `MCP Tools (${enabledToolCount} active)`
                : "MCP Tools are not enabled for this agent."
            }
          >
            <button
              type="button"
              id="mcp-tools-btn"
              disabled={!contextEnabled}
              onClick={() => setDropdownOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                {
                  "opacity-25 cursor-default": !contextEnabled,
                  "text-ds-text-body hover:bg-btn-ghost-bg-hover cursor-pointer":
                    contextEnabled && !dropdownOpen,
                },
              )}
            >
              <Icon id="mcp" className="w-4 h-4 stroke-1.5" />
            </button>
          </Tooltip>
        </PopoverTrigger>
      </McpToolsDropdown>

      <span
        className={cn("text-xs font-medium leading-none flex items-center h-8", {
          "opacity-25": !contextEnabled,
          "text-ds-text-body": contextEnabled,
        })}
      >
        {enabledToolCount}
      </span>

      <div className="h-8 w-px bg-surface-divider ml-2" />
    </div>
  );
}
