import { Fragment, memo, type ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import Feedback from "~/components/General/Feedback";
import Icon from "~/components/Icon";
import { LETS_TALK_FORM_URL, VERSION } from "~/lib/constants";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { cn } from "../ds/utils";
import Tooltip from "../Tooltip";
import ChangelogDialog from "./ChangelogDialog";

interface Props {
  header?: ReactNode;
  search?: ReactNode;
  children: ReactNode;
}

const uiShowChangelogFF = getConfig().ui.showChangelog;
const uiShowInviteButtonFF = getConfig().ui.showInviteButton;
const { leftSidebarLogo, leftSidebarLogoDark, name: wlName } = getConfig().whiteLabel;

const showDemoRequestButton = getShowDemoRequestButton();

const isWhitelabel =
  (leftSidebarLogo && leftSidebarLogo !== "") ||
  (wlName && wlName !== "OpenBB Workspace");

function InviteButton() {
  const expanded = useShallowSidebarStore((state) => state.effectiveExpanded);
  const user = useShallowAuthStore((state) => state.user);

  const { isProTier, isTrial } = useShallowFeatureFlagsStore((state) => ({
    isProTier: state.featureFlags?.tier === "pro",
    isTrial: state.featureFlags?.is_trial,
  }));

  if (!uiShowInviteButtonFF) {
    return null;
  }

  if (user.role === "Admin") {
    return (
      <Link className="contents" to="/admin">
        <Tooltip position={expanded ? "top" : "right"} message="Manage team invites">
          <Button variant="secondary" size="sm" className="size-8 px-2">
            <Icon id="invite" data-testid="admin-invite" />
          </Button>
        </Tooltip>
      </Link>
    );
  }

  if (isProTier && !isTrial) {
    return (
      <Tooltip
        position={expanded ? "top" : "right"}
        message={
          <div>
            <strong className="mr-1">Contact Admin</strong>
            to invite colleagues
          </div>
        }
      >
        <span>
          <Button disabled={true} variant="outlined" size="sm" className="size-8 px-2">
            <Icon id="invite" />
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Link className="contents" to="/app/settings?tab=invites">
      <Tooltip position={expanded ? "top" : "right"} message="Invite a friend">
        <Button variant="outlined" size="sm" className="size-8 px-2">
          <Icon id="invite" />
        </Button>
      </Tooltip>
    </Link>
  );
}

export function Sidebar(props: Props) {
  const { header, search, children } = props;

  const { isProTier, isTrial } = useShallowFeatureFlagsStore((state) => ({
    isProTier: state.featureFlags?.tier === "pro",
    isTrial: state.featureFlags?.is_trial,
  }));
  const theme = useShallowThemeStore((state) => state.theme);

  const sideBarHeader = useMemo(() => {
    return (
      <div
        className="@max-[100px]:flex-col
        flex w-full items-center justify-between
        @max-[100px]:gap-2 text-light-900 dark:text-white mb-2.5"
      >
        <Link
          to="/app"
          className="@max-[100px]:flex-col flex items-center justify-center gap-2"
        >
          {leftSidebarLogo ? (
            <img
              src={
                theme === "dark" && leftSidebarLogoDark
                  ? leftSidebarLogoDark
                  : leftSidebarLogo
              }
              alt={wlName || "Logo"}
              className="size-9 object-contain"
            />
          ) : (
            <Icon
              id="minimal-logo-icon"
              className="h-4 w-8 text-light-800 dark:text-white"
            />
          )}
        </Link>
        {header && (
          <div className="@max-[100px]:flex-col flex items-center justify-center">
            {header}
          </div>
        )}
      </div>
    );
  }, [header, isProTier, isTrial, theme]);

  const searchMemo = useMemo(
    () =>
      search && (
        <div className="relative flex-col text-xs" key="sidebar-search">
          {search}
        </div>
      ),
    [search],
  );
  const sideBarFooter = useMemo(() => <SidebarFooter key="sidebar-footer" />, []);
  const dialogMemo = useMemo(() => <DemoDialog key="demo-dialog" />, []);

  return (
    <Fragment key="sidebar-fragment">
      {dialogMemo}
      <div
        id="sidebar"
        data-testid="sidebar"
        className="@container relative justify-between overflow-x-auto bg-white
        transition-opacity duration-200 dark:bg-dark-900
        flex h-full flex-col items-center overflow-y-hidden p-3.5"
      >
        <div className="flex w-full flex-1 flex-col text-xs @max-[100px]:items-center overflow-hidden">
          {sideBarHeader}
          {searchMemo}
          {children}
        </div>
        <div className="mt-auto flex flex-col items-center justify-center flex-shrink-0 w-full">
          {sideBarFooter}
        </div>
      </div>
    </Fragment>
  );
}

function DemoDialog() {
  const { bookingOpen, setBookingOpen } = useShallowThemeStore((s) => ({
    bookingOpen: s.bookingOpen,
    setBookingOpen: s.setBookingOpen,
  }));

  const { showChangelog, updateShowChangelog } = useShallowAuthStore((s) => ({
    showChangelog: s.showChangelog,
    updateShowChangelog: s.updateShowChangelog,
  }));

  return useMemo(
    () => (
      <Fragment key="demo-dialog-fragment">
        <BaseDialog
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          className="min-h-[80vh] max-h-[80vh] lg:max-w-3xl xl:max-w-5xl h-full z-999999 p-0 overflow-hidden"
        >
          <iframe className="w-full h-full" src={LETS_TALK_FORM_URL} />
        </BaseDialog>
        <ChangelogDialog
          open={uiShowChangelogFF ? showChangelog : false}
          onClose={() => updateShowChangelog(false)}
        />
        <Feedback />
      </Fragment>
    ),
    [bookingOpen, showChangelog],
  );
}

function SidebarFooter() {
  const expanded = useShallowSidebarStore((state) => state.effectiveExpanded);

  const setBookingOpen = useShallowThemeStore((s) => s.setBookingOpen);
  const updateShowChangelog = useShallowAuthStore((s) => s.updateShowChangelog);

  const showUpgrade = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier !== "pro" || state.featureFlags?.is_trial,
  );

  return (
    <>
      <div
        className={cn(
          "relative overflow-auto rounded bg-surface-card p-2 text-2xs flex justify-between items-center w-full gap-2 mb-2.5 @max-[185px]:hidden",
          {
            hidden: !expanded || (expanded && !showUpgrade) || !showDemoRequestButton,
          },
        )}
      >
        <p className="body-xs-bold text-general-label flex items-center gap-1 whitespace-nowrap">
          Need more?
        </p>
        <Button variant="primary" size="xs" onClick={() => setBookingOpen(true)}>
          Let's talk
        </Button>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <Tooltip
          message="Click here to check changelog"
          position={expanded ? "top" : "right"}
        >
          <button
            className="body-xs-medium text-2xs text-light-600 dark:text-light-200"
            onClick={() => updateShowChangelog(true)}
          >
            {VERSION}
          </button>
        </Tooltip>
        {isWhitelabel && (
          <p className="text-center body-xs-regular text-2xs text-light-500 dark:text-light-400">
            Powered by OpenBB
          </p>
        )}
      </div>
    </>
  );
}

export default memo(Sidebar);
