import { useMemo } from "react";
import { getDefaultCopilot } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import {
  type Copilot,
  type ExternalCopilotHolder,
  useShallowCopilotStore,
} from "~/lib/state/copilot";

const aiCopilotOpenBBCopilotFF = getConfig().copilot.openbbCopilot;

// Flattens the enabled external copilot holders into a flat agent list. Guarded so
// undefined holders (e.g. loosely-mocked stores in tests) don't throw.
export function selectExternalCopilots(
  holders: ExternalCopilotHolder[] | undefined,
): Copilot[] {
  return (holders ?? [])
    .filter((holder) => holder.enabled !== false)
    .flatMap((holder) => holder.copilots ?? []);
}

export default function useGetAiAgents(): Copilot[] {
  const { externalCopilotHolders } = useShallowCopilotStore((copilot) => ({
    externalCopilotHolders: copilot.externalCopilotHolders,
  }));

  const aiAgentsMemo = useMemo(
    () => [
      ...(aiCopilotOpenBBCopilotFF ? [getDefaultCopilot()] : []),
      ...selectExternalCopilots(externalCopilotHolders),
    ],
    [externalCopilotHolders, aiCopilotOpenBBCopilotFF],
  );

  return aiAgentsMemo;
}
