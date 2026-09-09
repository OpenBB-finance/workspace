import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

interface TerminalProOnlyTagProps {
  isVisible?: boolean;
}

const showDemoRequestButton = getShowDemoRequestButton();
export default function TerminalProOnlyTag({
  isVisible = true,
}: TerminalProOnlyTagProps) {
  const { setBookingOpen } = useShallowThemeStore((s) => ({
    setBookingOpen: s.setBookingOpen,
  }));
  const uiShowEnterpriseTagsFF = getConfig().ui.showEnterpriseTags;

  if (!uiShowEnterpriseTagsFF) {
    return null;
  }

  const tagContent = (
    <div className="obb-tag flex gap-0.5 whitespace-nowrap items-center">
      Enterprise
    </div>
  );

  if (!isVisible) {
    return tagContent;
  }

  return (
    <Tooltip
      className="max-w-[157px]"
      message={
        <div className="flex flex-col gap-2">
          <div>This feature is only available on OpenBB Enterprise.</div>
          {showDemoRequestButton && (
            <Button
              size="xs"
              variant="primary"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setBookingOpen(true);
              }}
            >
              Upgrade
            </Button>
          )}
        </div>
      }
    >
      <div className="obb-tag flex gap-0.5 whitespace-nowrap items-center">
        <Icon id="lock-01" className="w-2 h-2" />
        Enterprise Feature
      </div>
    </Tooltip>
  );
}
