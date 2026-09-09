import { useMemo } from "react";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowUserAppsStore } from "~/lib/state/userApps";

const CUSTOM_PREFIX = "custom-";

/**
 * Returns the prompts associated with a dashboard's templateId.
 *
 * Merges two sources because they live in different stores:
 * - Listed-app prompts on `apiSources[].templates[].prompts`
 *   (templateId: `custom-${sourceId}-${slug}`)
 * - User-app prompts on `userApps[uuid].content.prompts` (owned + shared)
 *   (templateId: `custom-${userAppUuid}`)
 */
export function useTemplatePrompts(templateId: string): string[] {
  const backendPrompts = useShallowBackendConnectorStore((s) =>
    s.getTemplatePrompts(templateId),
  );
  const { userApps, sharedUserApps } = useShallowUserAppsStore((s) => ({
    userApps: s.userApps,
    sharedUserApps: s.sharedUserApps,
  }));

  return useMemo(() => {
    if (!templateId.startsWith(CUSTOM_PREFIX)) return backendPrompts;
    const candidateUuid = templateId.slice(CUSTOM_PREFIX.length);
    const userApp = userApps[candidateUuid] ?? sharedUserApps[candidateUuid];
    const userAppPrompts = userApp?.content?.prompts ?? [];
    if (userAppPrompts.length === 0) return backendPrompts;
    return backendPrompts.length > 0
      ? [...backendPrompts, ...userAppPrompts]
      : userAppPrompts;
  }, [backendPrompts, userApps, sharedUserApps, templateId]);
}
