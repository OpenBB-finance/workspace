import { useCallback } from "react";
import { convertHeadersToRecord } from "~/lib/api";
import { useShallowAuthStore } from "~/lib/state/auth";
import { type Copilot, useShallowCopilotStore } from "~/lib/state/copilot";

export function useGetCopilotRequestHeaders() {
  const user = useShallowAuthStore((s) => s.user);
  const { selectedCopilot, getCurrentChat } = useShallowCopilotStore((s) => ({
    selectedCopilot: s.selectedCopilot,
    getCurrentChat: s.getCurrentChat,
  }));

  const getCopilotRequestHeaders = useCallback(
    (xTraceId?: string, targetAgent?: Copilot) => {
      // openbb-copilot is the only copilot without a holderUuid
      // If targetAgent is provided, use it; otherwise fall back to selectedCopilot
      const copilotToUse = targetAgent || selectedCopilot;
      const isOpenBBCopilot = !copilotToUse?.holderUuid;
      const { uuid: chatId } = getCurrentChat();

      const headers = {
        "Content-Type": "application/json",
        ...(isOpenBBCopilot && {
          Authorization: `Bearer ${user?.token}`,
          "X-User-Id": user?.uuid,
        }),
        "X-Trace-Id": xTraceId || chatId,
      };

      const copilotHeaders = copilotToUse?.headers;

      const convertedHeaders = convertHeadersToRecord(copilotHeaders).headers;
      for (const [key, value] of Object.entries(convertedHeaders)) {
        if (value !== undefined) headers[key] = value;
      }

      return headers;
    },
    [
      selectedCopilot?.holderUuid,
      selectedCopilot?.headers,
      user?.token,
      user?.uuid,
      getCurrentChat,
    ],
  );
  return getCopilotRequestHeaders;
}
