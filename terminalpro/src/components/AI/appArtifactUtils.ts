import type { WidgetT } from "~/components/types";
import type { Item } from "~/lib/state/app";
import type { Source, WidgetMetadataItem } from "~/lib/state/backendConnector";
import type { AppArtifactT, AppArtifactWidgetRef, Copilot } from "~/lib/state/copilot";
import { createWidgetStudioWidget } from "./hooks/useGetAppWidgets";

/**
 * Build a per-widget Source resolver from an app artifact's widget refs and the user's
 * connected backends. External widgets resolve to the Source whose name matches the ref
 * origin (falling back to any backend exposing the widget id); built-ins resolve to
 * `undefined` so the caller falls back to the bundled widget registry.
 *
 * Each widget keeps its own Source so multi-origin apps get the correct url/headers.
 */
export function buildWidgetSourceResolver(
  widgetRefs: AppArtifactWidgetRef[],
  apiSources: Source[],
): (widgetId: string) => Source | undefined {
  const byWidgetId = new Map<string, Source>();

  for (const ref of widgetRefs) {
    if (byWidgetId.has(ref.widget_id)) continue;

    const match =
      apiSources.find(
        (source) =>
          source.name === ref.origin && Boolean(source.widgets?.[ref.widget_id]),
      ) ?? apiSources.find((source) => Boolean(source.widgets?.[ref.widget_id]));

    if (match) byWidgetId.set(ref.widget_id, match);
  }

  return (widgetId) => byWidgetId.get(widgetId);
}

export function buildWidgetMetadataResolver(
  widgetMetadata: WidgetMetadataItem[],
): (widgetId: string) => WidgetT | undefined {
  const widgetStudioById = new Map(
    widgetMetadata
      .filter((widget) => widget.widgetType === "widget_studio")
      .map((widget) => [`widget_studio-${widget.widgetId}`, widget]),
  );

  return (widgetId) => {
    const widget = widgetStudioById.get(widgetId);
    return widget ? createWidgetStudioWidget(widget) : undefined;
  };
}

/**
 * Representative Source used only for template-id derivation. The per-widget resolver
 * handles real widget lookups, so this just needs a stable id and a label.
 */
export function buildAppArtifactSource(artifact: AppArtifactT): Source {
  return {
    uuid: artifact.uuid,
    name: "Copilot App",
    url: "",
    endpointHeaders: null,
  };
}

/**
 * Auto-open applies only when the agent has Generative UI enabled and the user is sitting on an
 * empty dashboard. We never replace a dashboard that already holds widgets, and folders are not
 * dashboards.
 */
export function shouldAutoOpenAppArtifact({
  generativeUiEnabled,
  features,
  currentDashboardItem,
}: {
  generativeUiEnabled: boolean;
  features: Copilot["features"];
  currentDashboardItem: Item | null | undefined;
}): boolean {
  if (!generativeUiEnabled || features?.["generative-ui"] !== true) return false;
  return (
    !!currentDashboardItem?.data &&
    !currentDashboardItem.isFolder &&
    currentDashboardItem.data.widgets?.length === 0
  );
}
