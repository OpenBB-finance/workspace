import { useCallback } from "react";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowCopilotStore } from "~/lib/state/copilot";

export function useGetCustomApiKeys() {
  const openaiApiKey = useShallowAuthStore((s) => s.openaiApiKey);
  const selectedCopilot = useShallowCopilotStore((s) => s.selectedCopilot);

  const getCustomApiKeys = useCallback(() => {
    if (openaiApiKey && selectedCopilot?.id === "openbb-copilot") {
      return { openai_api_key: openaiApiKey };
    }
    return undefined;
  }, [openaiApiKey, selectedCopilot?.id]);

  return getCustomApiKeys;
}
