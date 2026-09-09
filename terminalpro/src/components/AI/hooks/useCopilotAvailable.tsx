import { getConfig } from "~/lib/runtimeConfig";
import { useCopilotStore } from "~/lib/state/copilot";
import useGetAiAgents, { selectExternalCopilots } from "./useGetAiAgents";

/**
 * Copilot is "available" only when it is enabled AND at least one usable agent
 * exists. In lite (openbbCopilot off) that means a custom agent has been connected;
 * in pro the OpenBB default copilot keeps the count >= 1. Used to hide every Copilot
 * entry point until an agent is present.
 *
 * Reactive — for components/hooks.
 */
export function useCopilotAvailable(): boolean {
  const agents = useGetAiAgents();
  return getConfig().copilot.enabled && agents.length > 0;
}

/** Imperative variant for event handlers / non-hook utils (reads current store state). */
export function isCopilotAvailable(): boolean {
  if (!getConfig().copilot.enabled) return false;
  const openbb = getConfig().copilot.openbbCopilot ? 1 : 0;
  const custom = selectExternalCopilots(
    useCopilotStore.getState().externalCopilotHolders,
  ).length;
  return openbb + custom > 0;
}
