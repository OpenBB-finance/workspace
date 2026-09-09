import { usePostHog } from "posthog-js/react";
import { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { saveDashboards } from "~/api/dashboard.api";
import FeatureLock from "~/components/General/FeatureLock";
import Icon from "~/components/Icon";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowWorkspaceBridgeStore } from "~/lib/state/workspaceBridge";
import { Avatar } from "../ds/atoms/Avatar";
import { Button } from "../ds/atoms/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import { Tag } from "../ds/atoms/Tag";
import { cn } from "../ds/utils";
import { isFeedbackEnabled } from "../General/Feedback";
import Tooltip from "../Tooltip";

const { leftSidebarLogo: hmLeftSidebarLogo, name: hmWlName } = getConfig().whiteLabel;
const isWhitelabel =
  (hmLeftSidebarLogo && hmLeftSidebarLogo !== "") ||
  (hmWlName && hmWlName !== "OpenBB Workspace");

const showDemoRequestButton = getShowDemoRequestButton();

function UserInformation({ toggleHamburgerMenu }: { toggleHamburgerMenu: () => void }) {
  const { user, name } = useShallowAuthStore((s) => ({ user: s.user, name: s.name }));
  const admin_access = useShallowFeatureFlagsStore((s) => s.featureFlags?.admin_access);
  const { pathname } = useLocation();
  const fullName = [name.first, name.last].filter(Boolean).join(" ");
  return (
    <div className="space-y-2">
      {user.entity_name && (
        <Tag color="grey" className="text-2xs!">
          {user.entity_name?.replace("OpenBB Developer", "OpenBB Free")}
        </Tag>
      )}
      <div className="flex items-center gap-2">
        <Avatar size="xs" className="bg-brand-main" />
        <div className="flex-1 pr-4">
          <div className="subtitle-2xs-medium">{fullName}</div>
          <div className="dark:text-dark-50 text-light-500">{user.email}</div>
        </div>
      </div>
      {user.role === "Admin" && (
        <FeatureLock isLocked={!admin_access}>
          {pathname.startsWith("/admin") ? (
            <Link to="/app" className="obb-dropdown-item" onClick={toggleHamburgerMenu}>
              <Icon id="layout" />
              <span>Workspace</span>
            </Link>
          ) : (
            <Link
              to="/admin"
              className="obb-dropdown-item"
              onClick={toggleHamburgerMenu}
            >
              <Icon id="user-edit" />
              <span>Admin Portal</span>
            </Link>
          )}
        </FeatureLock>
      )}
    </div>
  );
}

const uiShowHelpDocumentationFF = getConfig().ui.showHelpDocumentation;
const openDataPlatformInstallerEnabledFF = getConfig().ui.odpDownloadInstaller;
const showCompanionModeFF = getConfig().ui.showCompanionMode;

function MenuLinks() {
  const { toggleShortcutSidebar, setOpenDataPlatformModalOpen, setFeedbackOpen } =
    useShallowThemeStore((state) => ({
      toggleShortcutSidebar: state.toggleShortcutSidebar,
      setOpenDataPlatformModalOpen: state.setOpenDataPlatformModalOpen,
      setFeedbackOpen: state.setFeedbackOpen,
    }));

  const setMcpModalOpen = useShallowWorkspaceBridgeStore((state) => state.setModalOpen);
  const posthog = usePostHog();

  const toggleHamburgerMenu = useShallowSidebarStore(
    (state) => state.toggleHamburgerMenu,
  );
  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );

  const openDataPlatformInstallerEnabled =
    openDataPlatformInstallerEnabledFF && !isWhitelabel && !isProTier;

  const BOTTOM_MENU_LINKS = [
    {
      id: "settings",
      href: "/app/settings",
      label: "Settings",
      icon: "settings-01" as const,
      onClick: null,
    },
    ...(showCompanionModeFF
      ? [
          {
            id: "mcp-companion",
            href: null,
            label: "MCP Companion",
            icon: "mcp" as const,
            onClick: () => {
              posthog?.capture("opened_mcp_companion_modal");
              setMcpModalOpen(true);
              toggleHamburgerMenu();
            },
          },
        ]
      : []),
    ...(uiShowHelpDocumentationFF
      ? [
          {
            id: "help-documentation",
            href: "/app/help-documentation",
            label: "Help and Documentation",
            icon: "help-outline-circle" as const,
            onClick: null,
          },
        ]
      : []),
    {
      id: "shortcuts",
      href: null,
      label: "Shortcuts Menu",
      icon: "iconoir-apple-shortcuts" as const,
      onClick: () => {
        toggleShortcutSidebar();
        toggleHamburgerMenu();
      },
    },
    ...(isFeedbackEnabled
      ? [
          {
            id: "feedback",
            href: null,
            label: "Support & Feedback",
            icon: "email" as const,
            onClick: () => {
              setFeedbackOpen(true);
              toggleHamburgerMenu();
            },
          },
        ]
      : []),
    ...(openDataPlatformInstallerEnabled
      ? [
          {
            id: "open-data-platform",
            href: null,
            label: "Install Open Data Platform",
            icon: "download" as const,
            onClick: () => {
              setOpenDataPlatformModalOpen(true);
              toggleHamburgerMenu();
            },
          },
        ]
      : []),
    {
      id: "logout",
      onClick: () => {
        toggleHamburgerMenu();
        saveDashboards({ logout: true });
      },
      label: inSnowflakeNativeApp ? "Refresh Workspace" : "Log out",
      icon: "log-in-02" as const,
      href: null,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      {BOTTOM_MENU_LINKS.map((item) =>
        item.href ? (
          <Link
            to={item.href}
            key={item.id}
            className={`obb-dropdown-item _${item.id}`}
            onClick={toggleHamburgerMenu}
            data-testid={item.id}
          >
            <Icon id={item.icon as IconTypes} />
            <span>{item.label}</span>
          </Link>
        ) : (
          <button
            key={item.id}
            onClick={item.onClick}
            data-testid={item.id}
            className="obb-dropdown-item"
          >
            <Icon id={item.icon as IconTypes} />
            <span>{item.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

type IconTypes =
  | "settings-01"
  | "mcp"
  | "help-outline-circle"
  | "iconoir-apple-shortcuts"
  | "email"
  | "download"
  | "log-in-02";

function HamburgerMenuCTA() {
  const setBookingOpen = useShallowThemeStore((s) => s.setBookingOpen);
  const toggleHamburgerMenu = useShallowSidebarStore(
    (state) => state.toggleHamburgerMenu,
  );
  const showUpgrade = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier !== "pro" || state.featureFlags?.is_trial,
  );

  if (!showUpgrade || !showDemoRequestButton) return null;

  return (
    <div className="rounded bg-surface-card p-2 text-2xs flex justify-between items-center w-full gap-2">
      <p className="body-xs-bold text-general-label whitespace-nowrap">Need more?</p>
      <Button
        variant="primary"
        size="xs"
        onClick={() => {
          setBookingOpen(true);
          toggleHamburgerMenu();
        }}
      >
        Let's talk
      </Button>
    </div>
  );
}

function HamburgerMenu({ isMobile = false }: { isMobile?: boolean }) {
  const { isHamburgerMenuOpen, toggleHamburgerMenu } = useShallowSidebarStore(
    (state) => ({
      isHamburgerMenuOpen: state.isHamburgerMenuOpen,
      toggleHamburgerMenu: state.toggleHamburgerMenu,
    }),
  );

  return (
    <DropdownMenu open={isHamburgerMenuOpen} onOpenChange={toggleHamburgerMenu}>
      <Tooltip message="Settings Menu">
        <DropdownMenuTrigger
          className={cn("p-1 obb-icon-btn-v2 size-6", {
            "bg-light-50 dark:bg-dark-700": isHamburgerMenuOpen,
          })}
        >
          {isMobile ? (
            <Icon id="ion-ellipsis-vertical" className="mx-auto stroke-1.5 size-4" />
          ) : (
            <Icon id="menu" className="mx-auto stroke-1.5 size-4" />
          )}
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuPortal>
        <DropdownMenuContent
          className="space-y-2 max-h-fit" // dark:border dark:border-dark-300"
          /*style={{
            boxShadow: "0px 2px 10px 0px rgba(0, 0, 0, 0.4)",
          }}*/
          sideOffset={5}
          alignOffset={0}
          side="bottom"
          align={isMobile ? "end" : "start"}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <UserInformation toggleHamburgerMenu={toggleHamburgerMenu} />
          <hr />
          <MenuLinks />
          <HamburgerMenuCTA />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

export default memo(HamburgerMenu);
