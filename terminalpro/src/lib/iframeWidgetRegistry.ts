import type { OpenBBDataMessage, OpenBBWidgetManifest } from "~/types/iframeProtocol";

/**
 * In-memory registry of mounted Iframe widget instances, keyed by the parent
 * widget's UUID (`widget.id`).
 *
 * Each Iframe component registers itself once it has completed the
 * `openbb-connect` handshake with the embedded page, exposing imperative hooks
 * that other parts of the app can call to interact with that specific iframe:
 *
 * - `manifest` — sub-widgets the iframe declared (used by the Copilot to
 *   enumerate exportable sub-widgets, e.g. `useGetCopilotWidgets`).
 * - `requestWidgetData(widgetId)` — fetch data for a sub-widget on demand
 *   (used by Copilot tool calls in `useFunctionCall`).
 * - `sendRefresh()` — force the iframe to remount (used by `useMcpExecutor`
 *   after a destructive MCP tool call so the embedded page reloads its state).
 *
 * This registry is what bridges code that lives outside React's component tree
 * — the Copilot stream handlers and MCP executor — back to the specific
 * `<Iframe>` instance that owns the widget. Without it, those modules would
 * have no way to find the right iframe by id.
 */
export type IframeWidgetEntry = {
  requestWidgetData: (widgetId: string) => Promise<OpenBBDataMessage>;
  sendRefresh: () => void;
  manifest: OpenBBWidgetManifest[];
};

const registry = new Map<string, IframeWidgetEntry>();

export function registerIframeWidget(
  parentUuid: string,
  entry: IframeWidgetEntry,
): void {
  registry.set(parentUuid, entry);
}

export function unregisterIframeWidget(parentUuid: string): void {
  registry.delete(parentUuid);
}

export function getIframeWidget(parentUuid: string): IframeWidgetEntry | undefined {
  return registry.get(parentUuid);
}
