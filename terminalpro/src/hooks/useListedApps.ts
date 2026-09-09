import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "~/api/api";
import { getUserSubscriptions, SUBSCRIPTIONS_QUERY_KEY } from "~/api/auth.api";
import { isLiteEnvironment } from "~/lib/onPremFeatureFlags";
import { createURLString } from "~/lib/utils/widgetParams";
import type { ListedApp } from "~/types/listedApps";

const OPENBB_SANDBOX: ListedApp = {
  id: "openbb-sandbox",
  vendorName: "OpenBB",
  appName: "Sandbox App (FMP Data)",
  description:
    "Sandbox data from Financial Modeling Prep (FMP), added to every Workspace account by default. Explore company financials, comparisons, ownership, and events right away, no setup needed. Free data to get you started.",
  backendUrl: "",
  thumbnail: "/assets/images/openbb_cover.png",
  vendorDescription:
    "OpenBB is the open-source investment research platform that democratizes access to financial data and tools.",
  vendorWebsiteUrl: "https://openbb.co",
  documentationUrl: "https://docs.openbb.co",
  widgets: [],
  prompts: [
    "Get stock price for AAPL",
    "Show financial statements for MSFT",
    "Compare tech stocks",
    "Analyze market trends",
  ],
  screenshots: [],
  isBuiltIn: true,
  authType: ["none"],
};

// In lite the app is served from a non-OpenBB origin and its configured backend is
// not the marketplace backend, so the marketplace listing must be fetched
// cross-origin from the OpenBB backend (CORS allow-listed there).
const MARKETPLACE_URL = "https://backend.openbb.co";

export function getMarketplaceBaseUrl(): string | undefined {
  // Normal deployments hit their own backend (apiClient interceptor → urls.backend).
  if (!isLiteEnvironment()) return undefined;
  return MARKETPLACE_URL;
}

async function fetchListedApps(): Promise<ListedApp[]> {
  const baseURL = getMarketplaceBaseUrl();
  // The marketplace host rejects the lite session token, so the cross-origin
  // request must go out unauthenticated.
  const { data } = await apiClient.get<ListedApp[]>(
    "/marketplace/apps",
    baseURL ? { baseURL, headers: { authorization: "" } } : undefined,
  );
  for (const app of data) {
    for (const img_key of ["img", "img_dark", "img_light"]) {
      if (!app?.appImages?.[img_key]) continue;
      app.appImages[img_key] = createURLString(app.appImages[img_key], app.backendUrl);
    }
  }

  return data;
}

export function useListedApps() {
  return useQuery({
    queryKey: ["listedApps"],
    queryFn: fetchListedApps,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

export function useUserSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: getUserSubscriptions,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
}
