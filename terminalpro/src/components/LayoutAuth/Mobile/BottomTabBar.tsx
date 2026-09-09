import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";

interface TabItem {
  label: string;
  icon: IconId;
  action: () => void;
  isActive: boolean;
}

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { setMobileNavigationDrawer, setMobileCopilotDrawer } = useMobile((s) => ({
    setMobileNavigationDrawer: s.setMobileNavigationDrawer,
    setMobileCopilotDrawer: s.setMobileCopilotDrawer,
  }));

  const changeSearch = useShallowThemeStore((state) => state.changeSearch);

  const openSearch = useCallback(() => changeSearch(true), [changeSearch]);
  const openCopilot = useCallback(
    () => setMobileCopilotDrawer(true),
    [setMobileCopilotDrawer],
  );
  const openMenu = useCallback(
    () => setMobileNavigationDrawer(true),
    [setMobileNavigationDrawer],
  );
  const goToApps = useCallback(() => navigate("/app"), [navigate]);

  const copilotAvailable = useCopilotAvailable();

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [
      {
        label: "Menu",
        icon: "menu",
        action: openMenu,
        isActive: false,
      },
      {
        label: "Apps",
        icon: "grid-01",
        action: goToApps,
        isActive: location.pathname === "/app",
      },
      {
        label: "Search",
        icon: "search",
        action: openSearch,
        isActive: false,
      },
    ];
    // Copilot is browse-only useless without an agent — hide the tab until one exists.
    if (copilotAvailable) {
      items.push({
        label: "Copilot",
        icon: "sparkles-icon",
        action: openCopilot,
        isActive: false,
      });
    }
    return items;
  }, [
    location.pathname,
    goToApps,
    openSearch,
    openCopilot,
    openMenu,
    copilotAvailable,
  ]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-surface-divider bg-surface-header px-1 pb-[env(safe-area-inset-bottom)]">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          onClick={tab.action}
          className={cn(
            "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1",
            tab.isActive ? "text-tab-action-active" : "text-ds-text-caption",
          )}
        >
          <Icon id={tab.icon} className="size-5" />
          <span className="text-[10px] leading-tight">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
