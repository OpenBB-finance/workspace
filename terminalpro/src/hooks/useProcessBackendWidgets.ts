import { useCallback } from "react";
import type { BackendPermissionsT } from "~/api/user_roles.api";
import { createSourceWidget } from "~/components/DataConnectors/common/helpers";
import { someTruthy } from "~/components/General/Table/utils";
import type { WidgetT } from "~/components/types";
import {
  type Source,
  useShallowBackendConnectorStore,
  type ValidateBackend,
} from "~/lib/state/backendConnector";
import { useShallowPermissionsStore } from "~/lib/state/permissions";
import { getApiSourceWidgets } from "~/lib/utils/validateBackend";
import { cleanURL } from "~/lib/utils/widgetParams";
import type { ProcessedTemplate, SharedPromptT } from "./useSharedTemplates";

export interface ProcessedBackendT<
  T = boolean,
  P extends string | SharedPromptT = SharedPromptT,
> extends Omit<BackendPermissionsT, "widgets" | "templates"> {
  status?: "error" | "success";
  id?: string;
  widgets: T extends true ? Source["widgets"] : Record<string, WidgetT>;
  validatedUrl?: string;
  templates: ProcessedTemplate<P>[];
  isSharedSource?: boolean;
}

export function useProcessBackendWidgets() {
  const permissions = useShallowPermissionsStore((state) => state.permissions);
  const hasAccess = useShallowPermissionsStore((state) => state.hasAccess);
  const getApiSourceById = useShallowBackendConnectorStore(
    (state) => state.getApiSourceById,
  );

  const processBackendWidgets = useCallback(
    async (backend: BackendPermissionsT): Promise<ProcessedBackendT> => {
      try {
        // @ts-expect-error
        backend.id = backend.uuid;

        if (!someTruthy(backend.templates, backend.widgets)) {
          return {
            ...backend,
            status: "error",
            widgets: {},
            templates: [],
            isSharedSource: true,
          };
        }

        const source: Source = {
          ...backend,
          isSharedSource: true,
        } as unknown as Source;

        const validatedUrl = cleanURL(backend.url);
        let validated: Partial<ValidateBackend> | undefined;

        // avoids unnecessary API calls if the backend is owned by the user
        const existing = getApiSourceById(backend.uuid);
        if (existing) {
          validated = {
            widgets: existing.widgets,
            templates: existing.templates,
            errorMessage: existing.status === "error" ? "Error" : null,
          };
        } else {
          validated = await getApiSourceWidgets(source, { agents: false });
        }

        const { widgets, templates, errorMessage } = validated;

        if (errorMessage) {
          console.error("No widgets found for backend:", backend.name);
          console.error("Backend not accessible at", validatedUrl);
          return {
            ...backend,
            status: "error",
            widgets: {},
            templates: [],
            isSharedSource: true,
          };
        }

        const newWidgets = {} as ProcessedBackendT["widgets"];

        // Add widgetId to widgets and check permissions
        for (const [key, widget] of Object.entries(widgets)) {
          widget.widgetId = widget.widgetId || key;
          // Disable widgets that the user does not have access to
          newWidgets[key] = createSourceWidget(
            widget,
            source,
            hasAccess(backend.uuid, widget.widgetId),
          );
        }

        // Filter out templates that the user doesn't have access to
        const filteredTemplates = templates
          ?.filter((template) => {
            return (
              backend.templates.find((t) => t.templateId === template.name)?.access ===
              "access"
            );
          })
          .map((template) => {
            // Preserve the original prompts structure from backend.templates
            const backendTemplate = backend.templates.find(
              (t) => t.templateId === template.name,
            );
            return {
              ...template,
              prompts: backendTemplate?.prompts || template.prompts,
            } as ProcessedTemplate<SharedPromptT>;
          });

        return {
          ...backend,
          id: backend.uuid,
          status: "success",
          widgets: newWidgets,
          validatedUrl,
          templates: filteredTemplates,
          isSharedSource: true,
        };
      } catch (err) {
        console.error(`Error processing backend ${backend.name}:`, err);
        return {
          ...backend,
          status: "error",
          widgets: {},
          templates: [],
          isSharedSource: true,
        };
      }
    },
    [permissions, hasAccess],
  );

  return processBackendWidgets;
}
