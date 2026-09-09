import posthog from "posthog-js";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { deleteUserAppShare, syncUserApps } from "~/api/auth.api";
import { areTruthy } from "~/components/General/Table/utils";
import type { WidgetJsonT } from "~/components/types";
import { useShallowAuthStore } from "~/lib/state/auth";
import { TEMPLATES } from "~/lib/templates";
import { duplicateTabItem } from "~/lib/utils";
import {
  createCustomTemplateTab,
  getUntouchedAppTabInfo,
  OPENBB_ONBOARDING_WIDGETS,
} from "~/lib/utils/createTemplates";
import { showNotification } from "~/lib/utils/toast";
import type { ListedAppMcpServer } from "~/types/listedApps";
import { useShallowAppStore } from "../lib/state/app";
import {
  getTemplateWidgetsMetadata,
  type Source,
  useShallowBackendConnectorStore,
} from "../lib/state/backendConnector";
import { type SharedUser, useShallowUserAppsStore } from "../lib/state/userApps";
import { useAvailableTemplates } from "./useAvailableTemplates";
import { useSharedTemplates } from "./useSharedTemplates";

export type TemplateType = "openbb" | "user" | "shared" | "listed" | "generated";

export interface UnifiedTemplate {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  selected_agent?: string;
  widgets:
    | Partial<WidgetJsonT>[]
    | { name: string; description?: string; count?: number }[];
  totalWidgets?: number;
  prompts: string[];
  mcpServers?: ListedAppMcpServer[];
  img?: string;
  img_dark?: string;
  img_light?: string;
  onClick: () => void;
  onOpen?: () => void;
  onDelete?: () => Promise<void>;
  onAfterDelete?: () => void;
  onRate?: () => void;
  source?: Source;
  isShared?: boolean;
  createdBy?: string;
  creator?: boolean;
  sharedWith?: SharedUser[];
  vendorName?: string;
}

export function useAllTemplates(isLoadingApiSources = false) {
  const userEmail = useShallowAuthStore((state) => state.user?.email || "");
  const availableTemplates = useAvailableTemplates();
  const { data: sharedTemplatesData = [] } = useSharedTemplates({
    enabled: !isLoadingApiSources,
  });
  const apiSources = useShallowBackendConnectorStore((state) => state.apiSources);
  const { userGeneratedApps, userSharedApps, removeUserApp } = useShallowUserAppsStore(
    (state) => ({
      userGeneratedApps: state.getAllUserApps(),
      userSharedApps: state.getAllSharedUserApps(),
      removeUserApp: state.removeUserApp,
    }),
  );

  const { getTabById, addTab, items } = useShallowAppStore((state) => ({
    getTabById: state.getTabById,
    addTab: state.addTab,
    items: state.items,
  }));
  const navigate = useNavigate();
  const { id: currentDashboard } = useParams();

  const allTemplates = useMemo<UnifiedTemplate[]>(() => {
    const openbbTemplates = availableTemplates.map((template) => {
      const templateData = TEMPLATES[template.id] || {};
      if (template.id === "onboarding")
        templateData.widgets = OPENBB_ONBOARDING_WIDGETS;

      return {
        ...template,
        type: "openbb" as const,
        widgets: (templateData?.widgets || []) as WidgetJsonT[],
        prompts: (templateData?.prompts || []) as string[],
      };
    });

    const sharedTemplateIds = new Set(
      sharedTemplatesData.map((template) => template.id),
    );

    const userTemplates = apiSources
      .filter(
        (source) =>
          (source.templates && source.templates.length > 0) || source.vendorApp,
      )
      .flatMap((source) => {
        const vendorApp = source.vendorApp;
        const appUuid = vendorApp?.uuid;
        const isListedApp = Boolean(appUuid);

        const templates = [...(source.templates || [])];
        const listedAppDisconnected =
          isListedApp && !areTruthy(source.templates, source.widgets);
        if (listedAppDisconnected) {
          // If this is a Listed App without templates, create a template from the vendorApp data
          const listedAppTemplate: Source["templates"][number] = {
            name: vendorApp?.name || source.name,
            description: vendorApp?.shortDescription || "",
            prompts: vendorApp?.prompts || [],
            mcpServers: vendorApp?.mcpServers,
            img: vendorApp?.thumbnail,
            img_dark: vendorApp?.thumbnailDark,
            img_light: vendorApp?.thumbnailLight,
            tabs: {},
          };
          templates.push(listedAppTemplate);
        }

        return templates.map((template) => {
          const { widgets, totalWidgets } = getTemplateWidgetsMetadata(
            template,
            source,
          );

          return {
            id: isListedApp ? `listed-${appUuid}` : template.id,
            name: isListedApp ? vendorApp?.name || source.name : template.name,
            description: template.description,
            type: isListedApp ? "listed" : "user",
            vendorName: isListedApp ? vendorApp?.vendorName : undefined,
            totalWidgets,
            widgets,
            prompts: template.prompts || [],
            mcpServers: template.mcpServers || vendorApp?.mcpServers,
            selected_agent: template.selected_agent,
            img: vendorApp?.thumbnail || template.img,
            img_dark: vendorApp?.thumbnailDark || template.img_dark,
            img_light: vendorApp?.thumbnailLight || template.img_light,
            onClick: () => {
              if (listedAppDisconnected) {
                console.warn("[ListedApp] App not connected debug:", {
                  appName: vendorApp.name,
                  appBackendUrl: source.url,
                  existingSource: source,
                  allApiSources: apiSources.map((s) => ({
                    name: s.name,
                    url: s.url,
                    templatesLength: s.templates?.length,
                  })),
                });
                return showNotification({
                  message: "App not connected",
                  description:
                    "Re-enter your API key in the Apps Marketplace to connect this app.",
                  toastType: "warning",
                });
              }

              if (posthog) {
                posthog.capture("app_opened", {
                  app_id: isListedApp ? appUuid : template.id,
                  app_name: isListedApp
                    ? vendorApp?.name || source.name
                    : template.name,
                  app_type: isListedApp ? "listed" : "user",
                  vendor_name: vendorApp?.vendorName,
                });
              }
              createCustomTemplateTab({
                addTab,
                navigate,
                items,
                template,
                source,
                currentDashboard,
              });
            },
            source,
            isShared: sharedTemplateIds.has(template.id),
          } as UnifiedTemplate;
        });
      });

    const userTemplateIds = new Set(userTemplates.map((template) => template.id));

    const sharedTemplates = sharedTemplatesData
      .filter((template) => !userTemplateIds.has(template.id))
      .map((template) => {
        const { widgets, totalWidgets } = getTemplateWidgetsMetadata(
          template,
          template.source,
        );

        return {
          id: template.templateId,
          name: template.name,
          description: template.description,
          type: "shared",
          totalWidgets,
          widgets,
          prompts: template.prompts,
          img: template.img,
          img_dark: template.img_dark,
          img_light: template.img_light,
          createdBy: template.createdBy,
          onClick: () => {
            if (posthog) {
              posthog.capture("app_opened", {
                app_id: template.templateId,
                app_name: template.name,
                app_type: "shared",
              });
            }
            createCustomTemplateTab({
              addTab,
              navigate,
              items,
              template,
              source: template.source,
              currentDashboard,
            });
          },
          source: template.source,
        } as UnifiedTemplate;
      });

    // Map user-generated apps to template format
    const generatedAppTemplates = [...userGeneratedApps, ...userSharedApps].map(
      (app) => {
        const widgets = app.widgets
          .filter((w) => w.widgetId && w.name)
          .map((w) => ({
            name: w.name || w.widgetId,
            count: 1,
          }));

        const uniqueWidgets = widgets.reduce(
          (acc, widget) => {
            const existing = acc.find((w) => w.name === widget.name);
            if (existing) {
              existing.count += 1;
            } else {
              acc.push({ ...widget });
            }
            return acc;
          },
          [] as typeof widgets,
        );

        return {
          id: app.uuid,
          name: app.name,
          description: app.description,
          type: "generated",
          totalWidgets: app.widgets.length,
          widgets: uniqueWidgets,
          prompts: app.prompts || [],
          selected_agent: app.selected_agent,
          img: app.img,
          img_dark: app.img_dark,
          img_light: app.img_light,
          isShared: app.isShared,
          createdBy: app.createdBy,
          creator: app.creator,
          sharedWith: app.sharedWith,
          onClick: () => {
            if (posthog) {
              posthog.capture("app_opened", {
                app_id: app.uuid,
                app_name: app.name,
                app_type: "generated",
              });
            }

            const templateId = `custom-${app.uuid}` as const;
            const { tabName, navigateTo } = getUntouchedAppTabInfo(
              templateId,
              app.name,
              items,
            );
            if (navigateTo) {
              if (navigate) navigate(navigateTo);
              return;
            }

            const tabData = {
              name: tabName,
              type: "custom",
              templateId,
              widgets: app.widgets,
              groups: app.groups || [],
              gridLayout: app.gridLayout || {},
            } as const;

            // Directly create a new tab with the user-generated app data
            const newTab = duplicateTabItem({ data: tabData }, undefined, false);
            const index = newTab.index;

            addTab(newTab, true);

            if (navigate) {
              // Navigate to the new dashboard after a brief delay to ensure it's created
              setTimeout(() => {
                const tab = getTabById(index);
                if (!tab) return;
                navigate(`/app/${index}`);
              }, 100);
            }
          },
          onDelete: async () => {
            if (app.creator) return await removeUserApp(app.uuid!);
            if (userEmail) {
              const data = await deleteUserAppShare(app.uuid!, [userEmail]);
              if (!data?.success)
                throw new Error(data?.detail || "Failed to delete app share");

              await syncUserApps();
              toast.success("App share deleted successfully", {
                id: "delete-app-share",
                description: "You have successfully removed your access to this app.",
              });
            }
          },
          source: {
            id: `generated-${app.uuid}`,
            name: app.name,
            createdDate: app.createdDate,
          } as Partial<Source>,
        } as UnifiedTemplate;
      },
    );

    // Type assertion needed here because the inferred type might be too wide
    return [
      ...sharedTemplates,
      ...userTemplates,
      ...generatedAppTemplates,
      ...openbbTemplates,
    ] as UnifiedTemplate[];
  }, [
    availableTemplates,
    apiSources,
    sharedTemplatesData,
    userGeneratedApps,
    userSharedApps,
    addTab,
    navigate,
    items,
    currentDashboard,
    removeUserApp,
    getTabById,
  ]);

  return allTemplates;
}
