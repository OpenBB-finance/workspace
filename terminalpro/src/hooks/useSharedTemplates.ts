import { useMemo } from "react";
import {
  type BackendTemplate,
  getTemplateWidgetsMetadata,
  type Source,
} from "~/lib/state/backendConnector";
import {
  type RolePermissionsOptions,
  useUserResourcePermissions,
} from "./useUserResourcePermissions";

export type SharedPromptT = { promptId: string; access: string };

export interface ProcessedTemplate<P extends string | SharedPromptT = SharedPromptT>
  extends Omit<BackendTemplate, "prompts"> {
  access?: string;
  widgets?: { id?: string; name?: string }[];
  totalWidgets?: number;
  source?: Source;
  prompts?: P[];
  selected_agent?: string;
  createdBy?: string;
}

export function useSharedTemplates(
  options: RolePermissionsOptions = { enabled: true },
) {
  const { data, refetch, ...rest } = useUserResourcePermissions({
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options,
  });

  const sharedTemplates = useMemo(() => {
    if (!data) return;

    // Transform the data into a flat list of templates with their source information
    const templates = data.backends.flatMap((backend) =>
      (backend.templates || []).map((template) => {
        const { widgets, totalWidgets } = getTemplateWidgetsMetadata(template, backend);

        return {
          ...template,
          description: template.description || "",
          totalWidgets,
          widgets,
          prompts: (template.prompts ?? []).map((prompt) => {
            if (typeof prompt === "string") return prompt;

            return prompt?.promptId;
          }),
          tabs: template.tabs || {},
          source: backend,
          createdBy: backend.createdBy,
        } as unknown as ProcessedTemplate<string>;
      }),
    );

    return templates;
  }, [data]);

  return { data: sharedTemplates, refetch, ...rest };
}
