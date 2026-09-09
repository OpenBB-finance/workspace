import { memo, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDefaultCopilot } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { type Copilot, useShallowCopilotStore } from "~/lib/state/copilot";
import { cn } from "~/lib/utils";
import { showNotification } from "~/lib/utils/toast";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Popover } from "../ds/atoms/Popover";
import { Switch } from "../ds/atoms/Switch";
import Avatar from "../General/Avatar";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import CopilotUsageInfo from "./CopilotUsageInfo";
import { useShallowStreamingStore } from "./hooks/useStreaming";

const uiShowCopilotSwitcherFF = getConfig().ui.showCopilotSwitcher;

const aiCopilotOpenBBCopilotFF = getConfig().copilot.openbbCopilot;

const aiShowCustomCopilotKeyFF = getConfig().copilot.showCustomKey;

/** Hover card for an agent: avatar, name and description. */
const AgentTooltipContent = memo(({ agent }: { agent: Copilot }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Avatar
          className="w-7 h-7 rounded shrink-0"
          variant="noVariant"
          src={agent.image ?? ""}
          alt={agent.name}
          fallback={
            <div className="w-7 h-7 bg-general-bg-secondary rounded flex items-center justify-center">
              <Icon id="stars-02" className="size-4 text-ds-text-body" />
            </div>
          }
        />
        <span className="body-xs-bold text-ds-text-heading">{agent.name}</span>
      </div>

      {agent.description && (
        <p className="text-xs leading-relaxed text-ds-text-body max-h-[150px] overflow-y-auto">
          {agent.description}
        </p>
      )}
    </div>
  );
});

export default function CopilotSwitcher() {
  const {
    selectedCopilot,
    setSelectedCopilot,
    orchestrationModeEnabled,
    setOrchestrationModeEnabled,
    activeCopilotHolders,
  } = useShallowCopilotStore((copilot) => ({
    selectedCopilot: copilot.selectedCopilot,
    setSelectedCopilot: copilot.setSelectedCopilot,
    orchestrationModeEnabled: copilot.orchestrationModeEnabled,
    setOrchestrationModeEnabled: copilot.setOrchestrationModeEnabled,
    activeCopilotHolders: copilot.externalCopilotHolders.filter(
      (holder) => holder.enabled !== false,
    ),
  }));

  const navigate = useNavigate();

  const loading = useShallowStreamingStore((state) => state.loading);
  const [agentSwitcherPopoverOpen, setAgentSwitcherPopoverOpen] = useState(false);

  const popoverContent = useMemo(() => {
    const defaultCopilot = getDefaultCopilot();
    const hasHolders = activeCopilotHolders.length > 0;
    return (
      <div className="w-[269px] text-xs">
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: intentional for accessibility */}
        <span tabIndex={0} className="sr-only" />
        <div className="flex flex-col items-center justify-between">
          <div className="flex flex-row w-full text-ds-text-heading">
            <div className="body-xs-bold flex grow items-center">AI Agents</div>
            <Tooltip message="Manage Agents">
              <button
                type="button"
                aria-label="Manage Agents"
                onClick={() => {
                  setAgentSwitcherPopoverOpen(false);
                  navigate("/app/ai?tab=ai-agents");
                }}
                className="flex items-center justify-center w-6 h-6 rounded transition-colors
                  duration-200 text-ds-text-body hover:bg-general-bg-secondary-hover
                  hover:text-ds-text-heading shrink-0 cursor-pointer"
              >
                <Icon id="settings-01" className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="w-full">
          {aiCopilotOpenBBCopilotFF && (
            <>
              <div className="obb-divider my-1" />
              <div className="mx-0.5">
                <div
                  key={`default::${defaultCopilot.id}`}
                  className="flex items-center justify-between w-full my-2"
                >
                  <div className="flex items-center gap-2 p-0 w-full">
                    <div
                      className="flex items-center gap-2 flex-1 hover:bg-general-bg-secondary rounded px-2 py-1 cursor-pointer"
                      onClick={() => setSelectedCopilot(defaultCopilot)}
                    >
                      <div className="w-3.5 flex justify-center">
                        {selectedCopilot?.id === defaultCopilot.id && (
                          <Icon id="check" className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <Tooltip
                        position="right"
                        sideOffset={8}
                        className="p-3 max-w-[280px]"
                        message={<AgentTooltipContent agent={defaultCopilot} />}
                      >
                        <span className="text-ds-text-body max-w-30 truncate whitespace-nowrap min-w-0">
                          {defaultCopilot.name}
                        </span>
                      </Tooltip>
                      {aiShowCustomCopilotKeyFF && <CopilotUsageInfo />}
                    </div>
                    <Tooltip
                      position="top"
                      message={
                        <div className="flex flex-col gap-1 leading-4.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">
                              Enable orchestration feature
                            </span>
                          </div>
                          <span className="text-xs">
                            {hasHolders ? (
                              <>
                                OpenBB Copilot will delegate tasks to
                                <br />
                                the agents available.
                              </>
                            ) : (
                              <>
                                No external agents available.
                                <br />
                                Add agents to enable orchestration.
                              </>
                            )}
                          </span>
                        </div>
                      }
                    >
                      <Switch
                        checked={orchestrationModeEnabled && hasHolders}
                        disabled={!hasHolders}
                        aria-label="Toggle orchestration mode"
                        onCheckedChange={(checked) => {
                          if (!hasHolders) return;

                          if (!checked) {
                            setOrchestrationModeEnabled(false);
                            return showNotification({
                              message: "Orchestration Disabled",
                              description:
                                "OpenBB Copilot will no longer delegate tasks to external agents. All queries will be handled directly by the OpenBB Copilot.",
                              toastType: "info",
                            });
                          }

                          setOrchestrationModeEnabled(true);
                          setSelectedCopilot(defaultCopilot);

                          const agentNames = activeCopilotHolders
                            .flatMap((holder) => holder.copilots || [])
                            .map((agent) => agent.name)
                            .filter(Boolean);

                          const agentList =
                            agentNames.length > 0
                              ? agentNames.join(", ")
                              : "external agents";

                          showNotification({
                            message: "Orchestration Enabled",
                            description: `Tasks will be automatically routed to the most appropriate agent. OpenBB Copilot can now delegate tasks to the following agents: ${agentList}.`,
                            toastType: "info",
                          });
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
              </div>
              {hasHolders && <div className="obb-divider my-1" />}
            </>
          )}
          <div className="max-h-50 overflow-y-auto mx-0.5 w-full">
            {activeCopilotHolders.map((holder) => (
              <div key={`holder-${holder.uuid}`}>
                {(holder.copilots || []).map((agent, index) => (
                  <AgentItem
                    key={`holder-${holder.uuid}-agent-${index}`}
                    agent={agent}
                    holderUuid={holder.uuid}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [
    setSelectedCopilot,
    orchestrationModeEnabled,
    activeCopilotHolders,
    selectedCopilot,
    setAgentSwitcherPopoverOpen,
    navigate,
  ]);

  const agentsPopoverTriggerMemo = useMemo(
    () => (
      <div className="flex-1 min-w-0 pl-1.5">
        {uiShowCopilotSwitcherFF ? (
          <Popover
            open={agentSwitcherPopoverOpen}
            onOpenChange={setAgentSwitcherPopoverOpen}
            align="start"
            sideOffset={5}
            content={popoverContent}
          >
            <button
              className={cn(
                "_manage-copilots flex items-center text-xs gap-1 cursor-pointer w-full min-w-0",
                {
                  "opacity-50": loading,
                },
              )}
              disabled={loading}
              onClick={() => {
                setAgentSwitcherPopoverOpen((prev) => !prev);
              }}
            >
              <Tooltip message="Manage Copilots">
                {selectedCopilot ? (
                  <span className="flex items-center gap-1 body-xs-medium text-ds-text-heading min-w-0 max-w-full truncate">
                    <span className="truncate min-w-0 leading-none">
                      {selectedCopilot?.name}
                    </span>
                    <Icon id="chevron-down" className="h-3.5 w-3.5 flex-shrink-0" />
                  </span>
                ) : (
                  <span className="truncate whitespace-nowrap body-xs-medium">
                    No copilot selected
                  </span>
                )}
              </Tooltip>
            </button>
          </Popover>
        ) : (
          <div className="flex items-center text-xs gap-1 w-full min-w-0">
            {selectedCopilot ? (
              <span className="body-xs-medium text-ds-text-heading truncate whitespace-nowrap min-w-0 max-w-full">
                {selectedCopilot?.name}
              </span>
            ) : (
              <span className="truncate whitespace-nowrap body-xs-medium">
                No copilot selected
              </span>
            )}
          </div>
        )}
      </div>
    ),
    [selectedCopilot, agentSwitcherPopoverOpen, popoverContent, loading],
  );

  return agentsPopoverTriggerMemo;
}

const AgentItem = memo(
  ({ agent, holderUuid }: { agent: Copilot; holderUuid: string }) => {
    const {
      orchestrationModeEnabled,
      isSelected,
      isAgentEnabled,
      toggleAgentOrchestration,
      setSelectedCopilot,
      setOrchestrationModeEnabled,
    } = useShallowCopilotStore((s) => ({
      orchestrationModeEnabled: s.orchestrationModeEnabled,
      isSelected:
        s.selectedCopilot?.id === agent.id &&
        s.selectedCopilot?.holderUuid === holderUuid,
      isAgentEnabled: !!s.agentOrchestrationMap[holderUuid]?.includes(agent.id),
      toggleAgentOrchestration: s.toggleAgentOrchestration,
      setSelectedCopilot: s.setSelectedCopilot,
      setOrchestrationModeEnabled: s.setOrchestrationModeEnabled,
    }));

    const tooltipMessage = useMemo(
      () => <AgentTooltipContent agent={agent} />,
      [agent],
    );

    return (
      <div
        key={`${holderUuid}::${agent.id}`}
        className="flex items-center justify-between w-full my-2"
      >
        <div className="flex items-center gap-2 p-0 w-full">
          <Tooltip
            position="right"
            sideOffset={8}
            className="p-3 max-w-[280px]"
            message={tooltipMessage}
          >
            <div
              className="flex items-center gap-2 flex-1 hover:bg-general-bg-secondary rounded px-2 py-1 cursor-pointer"
              onClick={() => {
                setSelectedCopilot(agent);
                // Turn off orchestration when selecting a non-OpenBB agent
                if (orchestrationModeEnabled) setOrchestrationModeEnabled(false);
              }}
            >
              <div className="w-3.5 flex justify-center">
                {isSelected && (
                  <Icon id="check" className="h-3.5 w-3.5 text-ds-text-caption" />
                )}
              </div>
              <span className="text-ds-text-body max-w-50 truncate whitespace-nowrap min-w-0">
                {agent.name}
              </span>
            </div>
          </Tooltip>
          {orchestrationModeEnabled && (
            <div className="flex-1 flex justify-end pr-1.5">
              <Checkbox
                checked={isAgentEnabled}
                onCheckedChange={() => toggleAgentOrchestration(holderUuid, agent.id)}
                className="scale-75"
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);
