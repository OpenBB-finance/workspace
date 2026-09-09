import * as TabsPrimitive from "@radix-ui/react-tabs";
import Fuse from "fuse.js";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDebouncedCallback } from "use-debounce";
import { useLocalStorage } from "usehooks-ts";
import { subscribeListedApp, unsubscribeListedApp } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { Select } from "~/components/ds/atoms/Select";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import { useListedAppConnect } from "~/hooks/useListedAppConnect";
import { useListedApps, useUserSubscriptions } from "~/hooks/useListedApps";
import {
  useDeleteSubmission,
  useMarketplaceSubmissions,
} from "~/hooks/useMarketplaceSubmissions";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useCanSubmitApp } from "~/lib/appSubmissionFlag";
import { isLiteEnvironment } from "~/lib/onPremFeatureFlags";
import { useAppStore } from "~/lib/state/app";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { apiErrorMessage } from "~/lib/utils/apiError";
import { openListedApp } from "~/lib/utils/createTemplates";
import { safeExternalUrl } from "~/lib/utils/externalUrl";
import { showNotification } from "~/lib/utils/toast";
import { slugify } from "~/lib/utils/utils";
import { createURLString } from "~/lib/utils/widgetParams";
import {
  appSupportsAnonymousAccess,
  appUsesCustomAuth,
  type ListedApp,
  type ListedAppAuthValue,
  mcpServerUsesTokenAuth,
} from "~/types/listedApps";
import type {
  MarketplaceSubmission,
  SubmissionTarget,
} from "~/types/marketplaceSubmission";
import type { ApiKeySaveResult } from "./ApiKeyModal";
import { ContactVendorModal } from "./ContactVendorModal";
import {
  type AppsFuseKey,
  buildAppsFuseSearchQuery,
  createAppsFuseOptions,
  tokenizeWords,
} from "./fuseSearch";
import { ListedAppCard } from "./ListedAppCard";
import { ListedAppDetailsModal } from "./ListedAppDetailsModal";
import { submissionToListedApp } from "./listedAppFromSubmission";
import { type SortValue, sortListedApps } from "./listedAppSort";
import { RateAppDialog } from "./RateAppDialog";
import { SubmitListingDialog } from "./SubmitListingDialog";
import { hasOpenRevision, targetForBackendUrl } from "./submissionTargets";

type SortOption = { label: string; value: SortValue };

const sortOptions: SortOption[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "App A-Z", value: "app-a-z" },
  { label: "App Z-A", value: "app-z-a" },
  { label: "Vendor A-Z", value: "vendor-a-z" },
  { label: "Vendor Z-A", value: "vendor-z-a" },
];

const FUSE_KEYS: AppsFuseKey<ListedApp>[] = [
  { name: "appName", weight: 0.6 },
  { name: "vendorName", weight: 0.25 },
  {
    name: "description",
    weight: 0.15,
    tokenize: (app) => tokenizeWords(app.description),
  },
];

const fuseOptions = createAppsFuseOptions(FUSE_KEYS);

const ALL_CATEGORIES = "__all__";

const EMPTY_SUBMISSIONS: MarketplaceSubmission[] = [];

/**
 * Owner-section filter. "listed" keeps the developer's live listings, "reviewing"
 * the ones still pending or rejected — both are owner cards, since a live listing
 * is hidden from the public grid below to avoid rendering it twice.
 */
type ViewFilter = "all" | "listed" | "reviewing";

const DEFAULT_STATE = {
  search: "",
  selectedApp: null as ListedApp | null,
  modalOpen: null as "details" | null,
  showRateDialog: false,
  rateContext: undefined as "unsubscribe" | undefined,
  sortBy: undefined as SortValue | undefined,
  category: undefined as string | undefined,
  view: "all" as ViewFilter,
  isLoading: false,
  contactApp: null as ListedApp | null,
};
type AppsTabState = typeof DEFAULT_STATE;

interface ListedAppsTabProps {
  appSlug?: string;
}

export async function autoAddMcpForApp(app: ListedApp) {
  const mcpServer = app.mcpServers?.[0];
  if (!mcpServer) return;
  const store = useMcpToolsStore.getState();
  if (store.servers.some((s) => s.vendorAppUuid === app.id)) return;

  const source = useBackendConnectorStore.getState().getApiSourceById(app.id);
  const headers = source?.endpointHeaders ?? [];
  const customHeaders = headers.reduce<Record<string, string>>((acc, h) => {
    if (h.location === "headers" && h.key && h.value) acc[h.key] = h.value;
    return acc;
  }, {});

  store.addServer({
    id: Date.now().toString(),
    name: mcpServer.name,
    clientName: "",
    isLocal: false,
    url: mcpServer.url,
    // A token-auth server has no OAuth fallback, so connecting before the user
    // has supplied a token just fails. Stay disabled until `saveToken` runs.
    enabled: !mcpServerUsesTokenAuth(mcpServer) || !!customHeaders.Authorization,
    tools: [],
    customHeaders: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
    vendorAppUuid: app.id,
    vendorName: app.vendorName,
    authType: mcpServer.authType,
  });
  await store.saveMCPServers();
}

export function ListedAppsTab({ appSlug }: ListedAppsTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handledSlug = useRef<string | null>(null);
  const [sortBy, setSortBy] = useLocalStorage<SortValue>("listed-apps-sort", undefined);

  const {
    data: { subscribedAppIds = [], subscriptions = [] } = {},
    refetch: refetchSubscriptions,
  } = useUserSubscriptions();

  const [state, dispatch] = useStateReducer<AppsTabState>(null, () => ({
    ...DEFAULT_STATE,
    sortBy,
  }));

  useEffect(() => {
    return () => state.sortBy && setSortBy(state.sortBy);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id: currentDashboard } = useParams();

  const { data: listedApps, isPending, isFetching, error, refetch } = useListedApps();
  const { connectApp, disconnectApp } = useListedAppConnect();
  const { data: submissions = [], refetch: refetchSubmissions } =
    useMarketplaceSubmissions();
  const canSubmit = useCanSubmitApp();
  // Memoised: a fresh `[]` here would invalidate `ownerSubmissionIds` and with it
  // `filteredApps` (Fuse search + sort) on every render for non-developers.
  const ownerSubmissions = useMemo(
    () => (canSubmit ? submissions : EMPTY_SUBMISSIONS),
    [canSubmit, submissions],
  );
  const hasSubmissions = ownerSubmissions.length > 0;
  // Segmented control only appears once the developer has a personal submission;
  // without one, `view` is pinned to "all" so the public grid renders as before.
  const view = hasSubmissions ? state.view : "all";
  const [submitTarget, setSubmitTarget] = useState<SubmissionTarget | null>(null);
  const [deletingSubmission, setDeletingSubmission] =
    useState<MarketplaceSubmission | null>(null);
  const deleteSubmission = useDeleteSubmission();

  const handleDeleteListing = useCallback(async () => {
    if (!deletingSubmission) return;
    try {
      await deleteSubmission.mutateAsync(deletingSubmission.id);
    } catch (error) {
      // Keep the confirm dialog open so the developer can retry or cancel.
      showNotification({
        message: "Couldn't remove listing",
        description: apiErrorMessage(
          error,
          "Something went wrong removing your submission. Please try again.",
        ),
        toastType: "error",
      });
      return;
    }
    setDeletingSubmission(null);
    showNotification({
      message: "Listing removed",
      description: "Your submission was removed from the marketplace.",
      toastType: "success",
    });
  }, [deletingSubmission, deleteSubmission]);
  const isLite = isLiteEnvironment();

  const { outdatedApps, needsUpdate } = useMemo(() => {
    if (subscriptions?.length === 0 || !listedApps?.length)
      return { outdatedApps: [], needsUpdate: false };

    const map = new Map<string, ListedApp>();
    let needsUpdate = false;
    for (const sub of subscriptions) {
      if (sub.parentAppUuid && !map.has(sub.parentAppUuid)) {
        const app = listedApps?.find((a) => a.id === sub.parentAppUuid);
        if (app) {
          app.parentAppUuid = sub.parentAppUuid;
          app.id = sub.appId;
          map.set(sub.parentAppUuid, app);
          needsUpdate = true;
        }
      }
    }
    return { outdatedApps: map.values(), needsUpdate };
  }, [subscriptions, listedApps]);

  const openConnectedApp = useCallback(
    async (app: ListedApp) => {
      const source = useBackendConnectorStore.getState().getApiSourceById(app.id);
      const { items, addTab } = useAppStore.getState();
      const ok = await openListedApp({
        source,
        addTab,
        navigate,
        items,
        currentDashboard,
      });
      if (!ok) setSearchParams({ tab: "my-apps" });
    },
    [navigate, currentDashboard, setSearchParams],
  );

  const notifyAppConnected = useCallback(
    (app: ListedApp) => {
      if (posthog) {
        posthog.capture("app_installed", {
          app_id: app.id,
          app_name: app.appName,
          vendor_name: app.vendorName,
        });
      }
      const hasMcp = !!app.mcpServers?.[0];
      showNotification({
        message: "App connected",
        description: hasMcp
          ? `${app.appName} added to My Apps. MCP server connected automatically.`
          : "This app was added to My Apps.",
        toastType: "success",
        action: {
          label: "Open App",
          onClick: () => openConnectedApp(app),
        },
        cancel: hasMcp
          ? {
              label: "Manage MCP Server",
              onClick: () => navigate("/app/ai?tab=mcp-servers"),
            }
          : undefined,
      });
    },
    [openConnectedApp, navigate],
  );

  useEffect(() => {
    if (posthog) posthog.capture("app_marketplace_tab_viewed");
  }, []);

  useEffect(() => {
    if (!needsUpdate) return;
    for (const app of outdatedApps) {
      const { parentAppUuid, ...appData } = app;
      connectApp(appData, { parentAppUuid }).then(async (result) => {
        if (!result.success) {
          return console.error(
            `Failed to update connection for app ${app.appName}:`,
            "error" in result ? result.error : "Unknown error",
          );
        }
        await unsubscribeListedApp(app.id);
        await subscribeListedApp(parentAppUuid);
      });
    }
  }, [needsUpdate]);

  // Deep link from "List app to marketplace" (My Apps): open the listing dialog
  // seeded from the connected backend, then drop the param so back/refresh won't
  // reopen it.
  useEffect(() => {
    if (!canSubmit) return;
    const listSourceId = searchParams.get("list");
    if (!listSourceId) return;
    const source = useBackendConnectorStore.getState().getApiSourceById(listSourceId);
    if (!source) return;
    const url = source.url ?? "";
    // Already listed → edit that submission (or update the live one) instead of
    // creating a dup.
    const existingTarget = targetForBackendUrl(submissions, url);
    // Pre-fill the cover with the same image My Apps shows on the card:
    // `vendorApp.thumbnail || template.img` (see useAllTemplates). vendorApp is
    // only set for already-published listings, so a vendor listing their own
    // backend falls back to the connected app's template image. Resolve relative
    // paths against the backend and only keep publicly-hosted (http) URLs.
    const template = source.templates?.[0];
    const rawCover =
      source.vendorApp?.thumbnail ||
      template?.img ||
      source.vendorApp?.thumbnailDark ||
      template?.img_dark ||
      source.vendorApp?.thumbnailLight ||
      template?.img_light ||
      "";
    const resolvedCover = rawCover ? createURLString(rawCover, url) : "";
    const existingCover = safeExternalUrl(resolvedCover) ?? undefined;
    setSubmitTarget(
      existingTarget ?? {
        kind: "new",
        seed: {
          backendSourceId: listSourceId,
          appName: source.name ?? "",
          backendUrl: url,
          widgetCount:
            source.vendorApp?.totalWidgets ??
            (source.widgets ? Object.keys(source.widgets).length : 0),
          existingCover,
        },
      },
    );
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("list");
        return next;
      },
      { replace: true },
    );
  }, [canSubmit, searchParams, submissions, setSearchParams]);

  // Auto-open details modal when navigating via deep link. Track the handled
  // slug (not a one-shot boolean) so reopening the same app after closing — e.g.
  // clicking "View details" again from My Apps — retriggers the modal.
  useEffect(() => {
    if (!appSlug) {
      handledSlug.current = null;
      return;
    }
    if (!listedApps?.length || handledSlug.current === appSlug) return;
    const matchedApp = listedApps.find((app) => slugify(app.appName) === appSlug);
    if (matchedApp) {
      handledSlug.current = appSlug;
      dispatch({ modalOpen: "details", selectedApp: matchedApp });
    }
  }, [appSlug, listedApps]);

  const setAppSlugParam = useCallback(
    (slug: string | null) => {
      setSearchParams(
        (prev) => {
          if (slug) {
            prev.set("app", slug);
          } else {
            prev.delete("app");
          }
          return prev;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleOpenDetails = useCallback(
    (selectedApp: ListedApp) => {
      if (posthog) {
        posthog.capture("app_card_clicked", {
          app_id: selectedApp.id,
          app_name: selectedApp.appName,
          vendor_name: selectedApp.vendorName,
        });
      }
      dispatch({ modalOpen: "details", selectedApp });
      setAppSlugParam(slugify(selectedApp.appName));
    },
    [setAppSlugParam],
  );

  const refreshData = useCallback(async () => {
    const promise = [refetchSubscriptions, refetch, refetchSubmissions].map(
      async (fn) => await fn(),
    );
    await Promise.all(promise);
  }, [refetchSubscriptions, refetch, refetchSubmissions]);

  const debounceRefetch = useDebouncedCallback(refreshData, 500, {
    leading: true,
    maxWait: 200,
  });

  const handleCloseDetails = useCallback(() => {
    dispatch({
      modalOpen: null,
      selectedApp: null,
      showRateDialog: false,
      rateContext: undefined,
    });
    setAppSlugParam(null);
  }, [setAppSlugParam]);

  const handleCloseRateDialog = useCallback(() => {
    dispatch({ showRateDialog: false, rateContext: undefined });
    if (state.modalOpen !== "details") {
      setAppSlugParam(null);
    }
  }, [state.modalOpen, setAppSlugParam]);

  const handleAuthSave = useCallback(
    async (
      authValues: ListedAppAuthValue[],
      validateApiKey?: boolean,
    ): Promise<ApiKeySaveResult> => {
      const selectedApp = state.selectedApp;
      if (!selectedApp) return { success: false, error: "No app selected." };
      const authLabel = appUsesCustomAuth(selectedApp) ? "Authentication" : "API key";

      dispatch({ isLoading: true });
      try {
        const result = await connectApp(selectedApp, { authValues, validateApiKey });
        if (posthog) {
          const eventProps = {
            app_id: selectedApp.id,
            app_name: selectedApp.appName,
            vendor_name: selectedApp.vendorName,
          };
          if (result.success) {
            posthog.capture("app_api_key_added", eventProps);
          } else {
            posthog.capture("app_api_key_validation_failed", {
              ...eventProps,
              error: "error" in result ? result.error : "Unknown error",
            });
          }
        }
        if (result.success) {
          if (validateApiKey) {
            showNotification({
              message: `${authLabel} saved`,
              description: `Click "Connect App" to finish connecting ${selectedApp.appName}.`,
              toastType: "success",
            });
            return result;
          }

          await subscribeListedApp(selectedApp.id);
          await autoAddMcpForApp(selectedApp);
          notifyAppConnected(selectedApp);
        }
        return result;
      } finally {
        dispatch({ isLoading: false });
      }
    },
    [state.selectedApp, connectApp, notifyAppConnected],
  );

  const handleApiKeyRemove = useCallback(
    async (isSubscribed: boolean): Promise<void> => {
      const selectedApp = state.selectedApp;
      if (!selectedApp) return;
      const authLabel = appUsesCustomAuth(selectedApp) ? "Authentication" : "API key";
      const eventProps = {
        app_id: selectedApp.id,
        app_name: selectedApp.appName,
        vendor_name: selectedApp.vendorName,
      };
      if (!isSubscribed) {
        if (posthog) posthog.capture("app_api_key_removed", eventProps);
        return showNotification({
          message: `${authLabel} removed`,
          toastType: "success",
        });
      }

      dispatch({ isLoading: true });
      try {
        if (appSupportsAnonymousAccess(selectedApp)) {
          const result = await connectApp(selectedApp);
          if (!result.success) {
            return showNotification({
              message: "Connection failed",
              description: "error" in result ? result.error : "Unknown error",
              toastType: "error",
            });
          }

          if (posthog) posthog.capture("app_api_key_removed", eventProps);
          return showNotification({
            message: `${authLabel} removed`,
            description: `${selectedApp.appName} connected with limited access. Add ${authLabel.toLowerCase()} for more features.`,
            toastType: "warning",
          });
        }

        await disconnectApp(selectedApp, {
          message: `${authLabel} removed`,
          description: `${selectedApp.appName} has been disconnected.`,
          toastType: "success",
        });
        if (posthog) {
          posthog.capture("app_api_key_removed", eventProps);
        }
      } finally {
        dispatch({ isLoading: false });
      }
    },
    [state.selectedApp, disconnectApp],
  );

  const handleSubscribe = useCallback(async () => {
    const selectedApp = state.selectedApp;
    if (!selectedApp) return;
    dispatch({ isLoading: true });
    try {
      // For no-auth apps, also register the backend as an apiSource
      if (appSupportsAnonymousAccess(selectedApp)) {
        const result = await connectApp(selectedApp);
        if (!result.success) {
          showNotification({
            message: "Connection failed",
            description: "error" in result ? result.error : "Unknown error",
            toastType: "error",
          });
          return;
        }
      }

      await subscribeListedApp(selectedApp.id);
      await autoAddMcpForApp(selectedApp);
      notifyAppConnected(selectedApp);
    } finally {
      dispatch({ isLoading: false });
    }
  }, [state.selectedApp, connectApp, notifyAppConnected]);

  const handleUnsubscribe = useCallback(
    async (app?: ListedApp) => {
      const targetApp = app || state.selectedApp;
      if (!targetApp) return;
      dispatch({ isLoading: true });
      try {
        await disconnectApp(targetApp, {
          message: "Unsubscribed",
          description: `${targetApp.appName} has been removed from My Apps.`,
          toastType: "success",
        });
        if (posthog) {
          posthog.capture("app_removed", {
            app_id: targetApp.id,
            app_name: targetApp.appName,
            vendor_name: targetApp.vendorName,
          });
        }
      } finally {
        dispatch({ isLoading: false });
      }
    },
    [state.selectedApp, disconnectApp],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const app of listedApps ?? []) {
      if (app.category) set.add(app.category);
    }
    return [
      { label: "All categories", value: ALL_CATEGORIES },
      ...Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ label: c, value: c })),
    ];
  }, [listedApps]);

  const fuseInstance = useMemo(() => {
    if (!listedApps?.length) return null;
    return new Fuse(listedApps, fuseOptions);
  }, [listedApps]);

  const searchQuery = useMemo(
    () => buildAppsFuseSearchQuery(state.search, FUSE_KEYS),
    [state.search],
  );

  // The public catalog (GET /marketplace/apps) also returns the caller's own
  // apps, which already render in the owner section above — drop them from the
  // public grid so each submission isn't shown twice.
  const ownerSubmissionIds = useMemo(
    () => new Set(ownerSubmissions.map((s) => s.id)),
    [ownerSubmissions],
  );

  // "Listed" and "Reviewing" both scope the owner section; the public grid only
  // renders under "All", so an approved listing is always reachable somewhere.
  const visibleSubmissions = useMemo(() => {
    if (view === "all") return ownerSubmissions;
    const wantApproved = view === "listed";
    return ownerSubmissions.filter((s) => (s.status === "approved") === wantApproved);
  }, [ownerSubmissions, view]);

  const filteredApps = useMemo(() => {
    if (!listedApps?.length) return [];

    const byCategory = (app: ListedApp) =>
      !state.category ||
      state.category === ALL_CATEGORIES ||
      app.category === state.category;

    const notOwnSubmission = (app: ListedApp) => !ownerSubmissionIds.has(app.id);

    if (searchQuery && fuseInstance) {
      return fuseInstance
        .search(searchQuery)
        .map((r) => r.item)
        .filter(byCategory)
        .filter(notOwnSubmission);
    }

    return sortListedApps(
      listedApps.filter(byCategory).filter(notOwnSubmission),
      state.sortBy,
      subscribedAppIds,
    );
  }, [
    listedApps,
    searchQuery,
    fuseInstance,
    state.sortBy,
    state.category,
    subscribedAppIds,
    ownerSubmissionIds,
  ]);

  const handleNavigateApp = useCallback(
    (direction: "prev" | "next") => {
      if (!state.selectedApp || !filteredApps.length) return;
      const currentIndex = filteredApps.findIndex(
        (a) => a.id === state.selectedApp?.id,
      );
      if (currentIndex === -1) return;
      const nextIndex =
        direction === "prev"
          ? (currentIndex - 1 + filteredApps.length) % filteredApps.length
          : (currentIndex + 1) % filteredApps.length;
      const nextApp = filteredApps[nextIndex];
      dispatch({ selectedApp: nextApp });
      setAppSlugParam(slugify(nextApp.appName));
    },
    [state.selectedApp, filteredApps, setAppSlugParam],
  );

  if (error) {
    return (
      <TabsPrimitive.Content
        value="apps-marketplace"
        className="p-6 flex flex-col gap-4"
      >
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Icon id="exclamation-circle-icon" className="w-12 h-12 text-alert-error" />
          <p className="text-sm text-ds-text-body">Failed to load listed apps</p>
          <Button variant="secondary" size="sm" onClick={debounceRefetch}>
            Retry
          </Button>
        </div>
      </TabsPrimitive.Content>
    );
  }

  return (
    <TabsPrimitive.Content value="apps-marketplace" className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Input
            ref={inputRef}
            prefix={<Icon id="search" />}
            placeholder="Search for apps"
            className="h-8 [&_input]:h-8 w-[192px]"
            defaultValue={state.search}
            onChange={(search: string) => {
              dispatch({ search });
              if (inputRef.current) {
                inputRef.current.value = search;
              }
            }}
          />
          <Select
            options={categoryOptions}
            placeholder="Category"
            className="h-8"
            value={state.category ?? ""}
            onChange={(category: string) => dispatch({ category })}
          />
          <Select
            options={sortOptions}
            placeholder="Sort by"
            className="h-8"
            value={state.sortBy ?? ""}
            onChange={(sortBy: SortOption["value"]) => {
              dispatch({ sortBy });
              setSortBy(sortBy);
            }}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            className="h-8 w-8"
            variant="secondary"
            loading={isFetching}
            onClick={debounceRefetch}
            loadingChildren={null}
          >
            <Icon
              id="refresh-icon-ds"
              className="w-4 min-w-4 h-4 min-h-4 text-ds-text-body"
            />
          </Button>
        </div>
      </div>
      {hasSubmissions && (
        <Tabs
          value={view}
          onValueChange={(v) => dispatch({ view: v as ViewFilter })}
          variant="filled_secondary"
          className="w-fit"
        >
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="all" className="w-auto">
              All
            </TabsTrigger>
            <TabsTrigger value="listed" className="w-auto">
              Listed
            </TabsTrigger>
            <TabsTrigger value="reviewing" className="w-auto">
              Reviewing
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {visibleSubmissions.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-4">
            {visibleSubmissions.map((sub) => {
              const ownerApp = submissionToListedApp(sub);
              return (
                <ListedAppCard
                  key={sub.id}
                  app={ownerApp}
                  isSubscribed={false}
                  submission={sub}
                  onOpenDetails={() => handleOpenDetails(ownerApp)}
                  onSubmitListing={() =>
                    setSubmitTarget({ kind: "existing", submission: sub })
                  }
                  onUpdateListing={
                    // Only one revision at a time: the next version is derived
                    // from this row, so a second update would collide with the
                    // open one. Edit that revision instead.
                    sub.status === "approved" && !hasOpenRevision(sub, ownerSubmissions)
                      ? () => setSubmitTarget({ kind: "update", submission: sub })
                      : undefined
                  }
                  submissionDropdownItems={
                    // A published (approved) app can't be removed by the
                    // developer — only an admin can unlist it — so don't offer it.
                    sub.status === "approved"
                      ? []
                      : [
                          {
                            label: "Delete listing",
                            color: "#E03C3C",
                            onClick: () => setDeletingSubmission(sub),
                          },
                        ]
                  }
                />
              );
            })}
          </div>
        </section>
      )}
      {view !== "all" && visibleSubmissions.length === 0 && (
        <SearchResultsNotFound
          extraClassName="bg-general-bg-secondary py-20 rounded"
          icon={true}
          firstMessage={
            view === "listed" ? "No live listings yet" : "Nothing in review"
          }
          secondMessage={
            view === "listed"
              ? "Your approved apps appear here once the OpenBB team publishes them."
              : "Submissions waiting on review or needing changes appear here."
          }
        />
      )}
      {view === "all" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-4">
          {isPending ? (
            <div className="col-span-full flex items-center justify-center py-20">
              <BrandedLoadingState message="Loading apps..." />
            </div>
          ) : filteredApps.length === 0 ? (
            <SearchResultsNotFound
              extraClassName="col-span-full bg-general-bg-secondary py-60 rounded"
              icon={true}
              firstMessage="No listed apps found"
              secondMessage={
                state.search
                  ? "Try searching for a different app."
                  : "No community apps are currently available."
              }
            />
          ) : (
            filteredApps.map((app) => {
              const subscribed = subscribedAppIds.includes(app.id);
              return (
                <ListedAppCard
                  key={app.id}
                  app={app}
                  isSubscribed={subscribed}
                  onOpenDetails={() => handleOpenDetails(app)}
                  onOpenApp={
                    subscribed || app.isBuiltIn
                      ? () => openConnectedApp(app)
                      : undefined
                  }
                  onRate={
                    subscribed
                      ? () =>
                          dispatch({
                            showRateDialog: true,
                            selectedApp: app,
                            rateContext: undefined,
                          })
                      : undefined
                  }
                  onDisconnect={subscribed ? () => handleUnsubscribe(app) : undefined}
                  isLite={isLite}
                />
              );
            })
          )}
        </div>
      )}

      <SubmitListingDialog
        target={submitTarget}
        onClose={() => setSubmitTarget(null)}
      />

      <ConfirmDialog
        open={!!deletingSubmission}
        onClose={() => setDeletingSubmission(null)}
        title="Delete listing"
        description="This removes your submission from the marketplace. You can list the app again later."
        cancelText="Cancel"
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            loading={deleteSubmission.isPending}
            onClick={handleDeleteListing}
          >
            Delete
          </Button>
        }
      />

      {state.selectedApp && (
        <>
          <ListedAppDetailsModal
            app={state.selectedApp}
            isOpen={state.modalOpen === "details"}
            onClose={handleCloseDetails}
            isSubscribed={subscribedAppIds.includes(state.selectedApp.id)}
            onSubscribe={handleSubscribe}
            onAuthSave={handleAuthSave}
            onApiKeyRemove={handleApiKeyRemove}
            isSubscribing={state.isLoading}
            onDisconnect={() => handleUnsubscribe()}
            onAfterDisconnect={() =>
              dispatch({
                showRateDialog: true,
                rateContext: "unsubscribe",
              })
            }
            onOpen={
              subscribedAppIds.includes(state.selectedApp.id) ||
              state.selectedApp.isBuiltIn
                ? () => {
                    handleCloseDetails();
                    openConnectedApp(state.selectedApp!);
                  }
                : undefined
            }
            onRate={
              subscribedAppIds.includes(state.selectedApp.id)
                ? () => {
                    dispatch({
                      modalOpen: null,
                      showRateDialog: true,
                      rateContext: undefined,
                    });
                  }
                : undefined
            }
            onPrev={
              filteredApps.length > 1 ? () => handleNavigateApp("prev") : undefined
            }
            onNext={
              filteredApps.length > 1 ? () => handleNavigateApp("next") : undefined
            }
            onContactVendor={
              isLite ? () => dispatch({ contactApp: state.selectedApp }) : undefined
            }
          />

          <RateAppDialog
            app={state.selectedApp}
            isOpen={state.showRateDialog}
            onClose={handleCloseRateDialog}
            context={state.rateContext}
          />
        </>
      )}

      <ContactVendorModal
        app={state.contactApp}
        isOpen={!!state.contactApp}
        onClose={() => dispatch({ contactApp: null })}
      />
    </TabsPrimitive.Content>
  );
}
