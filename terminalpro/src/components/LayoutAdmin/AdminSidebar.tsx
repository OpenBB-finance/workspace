import { memo, useEffect } from "react";
import { useIsMarketplaceAdmin } from "~/hooks/useAdminMarketplace";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import Sidebar from "../General/Sidebar";
import SidebarNavButton from "../General/SidebarNavButton";
import SnowflakeHide from "../General/SnowflakeHide";
import { useLayoutPanelsState } from "../LayoutAuth/AppLayout/hooks/usePanelsState";
import HamburgerMenu from "../LayoutAuth/HamburgerMenu";

function AdminSidebar({
  expandedState,
}: {
  expandedState: { left: boolean; collapsedLeft: boolean };
}) {
  const [_, dispatch] = useLayoutPanelsState();
  const setEffectiveExpanded = useShallowSidebarStore(
    (state) => state.setEffectiveExpanded,
  );
  const { isMarketplaceAdmin } = useIsMarketplaceAdmin();
  const showMarketplace = getConfig().ui.showMarketplace;

  useEffect(() => {
    setEffectiveExpanded(expandedState.left && !expandedState.collapsedLeft);
    dispatch((state) => ({
      ...state,
      adminleft: expandedState.left,
      admincollapsedLeft: expandedState.collapsedLeft,
    }));
  }, [expandedState, dispatch]);

  return (
    <Sidebar header={<HamburgerMenu />}>
      <div className="flex flex-col gap-2.5 mt-1.5 @max-[100px]:items-center">
        <SidebarNavButton to="/admin/users" title="Users" icon="person-icon" />
        <SnowflakeHide>
          <SidebarNavButton
            to="/admin/roles"
            title="Roles and Access"
            icon="user-group"
          />
        </SnowflakeHide>
        <SnowflakeHide>
          <SidebarNavButton to="/admin/apps" title="Apps" icon="chart-icon" />
        </SnowflakeHide>
        {showMarketplace && isMarketplaceAdmin && (
          <SnowflakeHide>
            <SidebarNavButton
              to="/admin/marketplace"
              title="Marketplace"
              icon="grid-01"
            />
          </SnowflakeHide>
        )}
        <SidebarNavButton
          to="/admin/theme-settings"
          title="Theme"
          icon="solar-palette-2-linear"
        />
        <SnowflakeHide>
          <SidebarNavButton to="/admin/account" title="Account" icon="cog" />
        </SnowflakeHide>
      </div>
    </Sidebar>
  );
}

export default memo(AdminSidebar);
