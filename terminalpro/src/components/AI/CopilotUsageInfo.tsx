import * as HoverCard from "@radix-ui/react-hover-card";
import dayjs from "dayjs";
import { type FC, memo, useCallback, useEffect, useState } from "react";
import { getUsage } from "~/api/auth.api";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";
import useQueriesLeft from "./hooks/useQueriesLeft";

const showDemoRequestButton = getShowDemoRequestButton();

const CopilotUsageInfo: FC = () => {
  const { queriesLeft, usage } = useQueriesLeft(true);
  const { setUsage, isProTier } = useShallowFeatureFlagsStore((state) => ({
    setUsage: state.setUsage,
    isProTier: state.featureFlags?.tier === "pro",
  }));

  const { setBookingOpen, setApiKeyDialogOpen } = useShallowThemeStore((s) => ({
    setBookingOpen: s.setBookingOpen,
    setApiKeyDialogOpen: s.setApiKeyDialogOpen,
  }));
  const openaiApiKey = useShallowAuthStore((s) => s.openaiApiKey);

  const [timeLeft, setTimeLeft] = useState("");

  const updateTimeLeft = useCallback(() => {
    // don't add days to this code @DidierRLopes
    const now = dayjs().utc();
    const diff = now.endOf("day").diff(now, "minute");

    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (minutes < 0 || hours > 24) return;

    if (now.isBefore(now.startOf("day").add(5, "minute")))
      getUsage().then((usage) => setUsage(usage));

    setTimeLeft(
      `${hours !== 0 ? `${hours}h ` : ""}
      ${minutes}m`,
    );
  }, [setTimeLeft]);

  useEffect(() => {
    if (!usage) return;

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000); // Update every minute

    return () => interval && clearInterval(interval);
  }, [usage]);

  if (!usage?.copilot_calls_limit) return null;

  const percentLeft = (queriesLeft / usage.copilot_calls_limit) * 100;

  return (
    <HoverCard.Root openDelay={300}>
      <HoverCard.Trigger
        className={cn(
          "rounded-full size-[18px] cursor-pointer flex items-center justify-center bg-[#2DAC5C4D] text-[#2DAC5C]",
        )}
      >
        <Icon id="key-icon" className="size-2.5" />
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="TooltipContent bg-white p-2 group-hover:scale-100 w-fit rounded z-9000 dark:bg-dark-500 dark:text-white text-xs max-w-[220px] flex flex-col gap-2"
          sideOffset={5}
          side="top"
        >
          {!openaiApiKey && (
            <>
              <div className="flex items-center">
                <Icon
                  id={
                    percentLeft > 20
                      ? "info-outline-circle"
                      : percentLeft <= 20
                        ? "warning-icon"
                        : "x-outline-circle"
                  }
                  className={cn("size-3.5 mr-1", {
                    "text-brand-lighter": percentLeft > 20,
                    "text-orange-400": percentLeft <= 20,
                    "text-red-500": percentLeft <= 0,
                  })}
                />
                <h3 className="font-bold">
                  {queriesLeft > 0
                    ? `You have ${queriesLeft} daily queries left`
                    : "Daily limit of queries reached"}
                </h3>
              </div>
              <p className="dark:text-light-100 text-light-600">
                {isProTier
                  ? "Add your own API keys for more usage."
                  : "Add your own API keys or upgrade for more usage."}
              </p>
              <p className="dark:text-dark-50 text-light-500">
                Resets in <span className="font-bold">{timeLeft}</span>
              </p>
              <div className="flex gap-1.5">
                {!isProTier && showDemoRequestButton && (
                  <Button
                    size="xs"
                    variant="primary"
                    className="w-full"
                    onClick={() => setBookingOpen(true)}
                  >
                    Upgrade Plan
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="secondary"
                  className="w-full dark:bg-dark-400 dark:hover:bg-dark-500"
                  onClick={() => setApiKeyDialogOpen(true)}
                >
                  Add API Key
                </Button>
              </div>
            </>
          )}
          {openaiApiKey && (
            <>
              <div className="flex items-center">
                <Icon
                  id="info-outline-circle"
                  className="size-3 mr-1 text-brand-main"
                />
                <h3 className="font-bold">Using your OpenAI key</h3>
              </div>
              <p className="dark:text-light-100 text-light-600">
                Copilot is using your OpenAI key for queries.
              </p>
              <Button
                size="xs"
                variant="secondary"
                className="w-fit float-left dark:bg-dark-400 dark:hover:bg-dark-500"
                onClick={() => setApiKeyDialogOpen(true)}
              >
                Edit API Key
              </Button>
            </>
          )}
          <HoverCard.Arrow className="fill-white dark:fill-dark-500" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};

export default memo(CopilotUsageInfo);
