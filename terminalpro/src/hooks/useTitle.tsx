import { useEffect } from "react";
import { useLocation, useMatches } from "react-router-dom";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";

export function useGlobalTitleManager(): void {
  const location = useLocation();
  const matches = useMatches();

  // Find the active tab ID parameter from matches
  const tabId = matches.find((m) => m.params?.id)?.params?.id;

  // Retrieve tab names from Zustand stores if we are on a tab route
  const tabName = useShallowAppStore((state) =>
    tabId ? state?.items?.[tabId]?.data?.name : undefined,
  );
  const sharedTabName = useShallowSharedAppStore((state) =>
    tabId ? state?.sharedItems?.[tabId]?.data?.name : undefined,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const brandName = getConfig().whiteLabel?.name || "OpenBB Workspace";
    let pageTitle = "";

    const path = location.pathname;

    if (path === "/login") {
      pageTitle = "Login";
    } else if (path === "/register") {
      pageTitle = "Register";
    } else if (path === "/terms-of-service") {
      pageTitle = "Terms of Service";
    } else if (path === "/booking") {
      pageTitle = "Book a Demo";
    } else if (path === "/forgot-password") {
      pageTitle = "Forgot Password";
    } else if (path === "/forgot-password-confirmation") {
      pageTitle = "Check Your Email";
    } else if (path === "/app") {
      pageTitle = "Apps";
    } else if (path.startsWith("/app/widgets")) {
      pageTitle = "Widgets Library";
    } else if (path.startsWith("/app/ai")) {
      pageTitle = "AI Library";
    } else if (path.startsWith("/app/connections")) {
      pageTitle = "Connections";
    } else if (path.startsWith("/app/settings")) {
      pageTitle = "Settings";
    } else if (path.startsWith("/app/news")) {
      pageTitle = "News";
    } else if (path.startsWith("/app/help-documentation")) {
      pageTitle = "Help & Documentation";
    } else if (path.startsWith("/app/") && tabId) {
      pageTitle = tabName || sharedTabName || "";
    } else if (path === "/admin") {
      pageTitle = "Admin Portal";
    } else if (path === "/admin/users") {
      pageTitle = "Users | Admin";
    } else if (path === "/admin/roles") {
      pageTitle = "Roles | Admin";
    } else if (path === "/admin/apps") {
      pageTitle = "Apps | Admin";
    } else if (path === "/admin/theme-settings") {
      pageTitle = "Theme | Admin";
    } else if (path === "/admin/account") {
      pageTitle = "Account | Admin";
    }

    const fullTitle = pageTitle ? `${pageTitle} | ${brandName}` : brandName;

    if (document.title !== fullTitle) {
      document.title = fullTitle;
    }
  }, [location.pathname, tabName, sharedTabName, tabId]);
}

export default useGlobalTitleManager;
