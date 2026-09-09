import { type PropsWithChildren, useState } from "react";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import LocalIcon from "../Icon";
import Tooltip from "../Tooltip";

interface FeatureLockProps extends PropsWithChildren {
  isLocked: boolean;
  tooltipPosition?: "top" | "right" | "bottom" | "left";
  message?: string;
  className?: string;
}

const showDemoRequestButton = getShowDemoRequestButton();

export default function FeatureLock({
  children,
  isLocked,
  tooltipPosition = "right",
  message = "This feature is not available on your current plan.",
  className,
}: FeatureLockProps) {
  const { setBookingOpen } = useShallowThemeStore((s) => ({
    setBookingOpen: s.setBookingOpen,
  }));

  const [iconOpen, setIconOpen] = useState(undefined);

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      message={
        <div className="flex flex-col gap-2">
          <div>{message}</div>
          {showDemoRequestButton && (
            <Button
              size="xs"
              data-testid="upgrade-button"
              variant="primary"
              className="w-full"
              onClick={() => setBookingOpen(true)}
            >
              Upgrade
            </Button>
          )}
        </div>
      }
      open={iconOpen}
      position={tooltipPosition}
      className={cn("max-w-[157px]", className)}
    >
      <div className={cn("opacity-50 relative")}>
        <div className="pointer-events-none">{children}</div>
        <LocalIcon
          id="locker"
          data-testid="locker"
          // Makes sure when the icon is hovered, the tooltip stays open
          // to allow the user to click the upgrade button without the tooltip closing
          onMouseEnter={() => setIconOpen(true)}
          onMouseLeave={() => setTimeout(() => setIconOpen(undefined), 1000)}
          className="text-brand-lighter absolute top-1/2 right-0 -translate-y-1/2"
        />
      </div>
    </Tooltip>
  );
}
