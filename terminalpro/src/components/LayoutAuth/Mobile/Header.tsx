import { Link, useParams } from "react-router-dom";
import Icon from "~/components/Icon";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";

export default function MobileHeader() {
  const { id } = useParams();
  const { activeTab } = useShallowAppStore((state) => ({
    activeTab: state.getTabById(id),
  }));
  const theme = useShallowThemeStore((state) => state.theme);
  const { leftSidebarLogo, leftSidebarLogoDark, name } = getConfig().whiteLabel;
  return (
    <div className="sticky z-40 shadow-md dark:shadow-[0px_4px_15px_0px_rgba(0,0,0,0.6)] flex gap-2 p-4 justify-between items-center top-0 left-0 w-full bg-surface-header">
      <Link to="/app" className="flex items-center justify-center">
        {leftSidebarLogo ? (
          <img
            src={
              theme === "dark" && leftSidebarLogoDark
                ? leftSidebarLogoDark
                : leftSidebarLogo
            }
            alt={name || "Logo"}
            className="size-9"
          />
        ) : (
          <Icon id="minimal-logo-icon" className="h-4 w-8 text-general-label" />
        )}
      </Link>
      <p className="text-xs text-ds-text-caption uppercase tracking-wider truncate">
        {activeTab?.data?.name ?? "OpenBB Workspace"}
      </p>
      <div className="w-8" />
    </div>
  );
}
