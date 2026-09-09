import { useEffect, useMemo } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { type Usage, useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowStreamingStore } from "./useStreaming";

export default function useQueriesLeft(fromUsageInfo = false): {
  queriesLeft: number | null;
  usage: Usage;
} {
  const openaiApiKey = useShallowAuthStore((s) => s.openaiApiKey);
  const selectedCopilot = useShallowCopilotStore((s) => s.selectedCopilot);
  const usage = useShallowFeatureFlagsStore((state) => state.usage);

  if (openaiApiKey) return { queriesLeft: null, usage };

  // Only apply query limits to the default OpenBB copilot (Ada)
  // openbb-copilot is the only copilot without a holderUuid
  if ((!fromUsageInfo && selectedCopilot?.holderUuid) || !usage?.copilot_calls_limit)
    return { queriesLeft: null, usage: {} as Usage };

  return {
    queriesLeft: Math.max(
      0,
      usage.copilot_calls_limit - usage.number_copilot_calls_day_count,
    ),
    usage,
  };
}

export function QueryLimitReached() {
  const { limitReached, dispatch } = useShallowStreamingStore((s) => ({
    limitReached: s.limitReached,
    dispatch: s.dispatch,
  }));

  const { queriesLeft, usage } = useQueriesLeft();
  const setApiKeyDialogOpen = useShallowThemeStore((s) => s.setApiKeyDialogOpen);
  const showWelcome = useShallowCopilotStore((s) => s.showWelcome);

  const messageMemo = useMemo(() => {
    const { copilot_calls_limit, number_copilot_calls_day_count } = usage;

    return (
      <div className="_message-content">
        <div className="bg-[#7F1D1D33] border border-[#EF4444] rounded px-2.5 py-1 space-y-1">
          <p className="text-[#DC2626] dark:text-[#EF4444] pt-1">
            <span className="text-medium font-bold">Daily Limit Reached </span>
            <span className="text-xs">
              - {number_copilot_calls_day_count} of {copilot_calls_limit} queries used
            </span>
          </p>
          <p className="pt-1 text-xs">
            You've reached your daily limit of OpenBB Coplilot queries. Add your OpenAI
            key or return tomorrow.
          </p>
          <div className="py-2">
            <Button
              size="xs"
              variant="primary"
              onClick={() => setApiKeyDialogOpen(true)}
            >
              Add your OpenAI key
            </Button>
          </div>
        </div>
      </div>
    );
  }, [usage, setApiKeyDialogOpen]);

  useEffect(() => {
    if (limitReached && queriesLeft !== 0) {
      dispatch({ limitReached: false });
    }
  }, [limitReached, queriesLeft]);

  if (!(limitReached && usage && queriesLeft === 0)) return null;

  if (showWelcome) {
    return (
      <div className="flex flex-col items-center justify-center grow w-full">
        <div className="max-w-[406px]">
          <div className="flex justify-center">{messageMemo}</div>
        </div>
      </div>
    );
  }

  return messageMemo;
}
