import { useMemo } from "react";
import {
  type EnhancedSelectOptionData,
  EnhancedTooltip,
} from "~/components/ds/atoms/EnhancedSelect";
import type { WidgetT } from "~/components/types";
import { useWidgetConfigContext } from "../WidgetConfigContext";

const getWidgetIcon = (type?: string) => {
  switch (type) {
    case "table":
      return "table-02";
    case "chart":
    case "line_chart":
    case "bar_chart":
      return "bar-chart-square-02";
    case "metric":
    case "number":
      return "target-01";
    case "live_grid":
      return "refresh-cw-05";
    default:
      return "puzzle-piece-02";
  }
};

const formatEndpoint = (endpoint?: any) => {
  if (!endpoint) return "No endpoint configured";
  if (typeof endpoint === "string") return endpoint;
  if (endpoint?.url) return endpoint.url;
  return "Endpoint configured";
};

export function useBackendSelection(
  backendNameToWidgetMap: Map<string, Map<string, WidgetT>>,
) {
  const selectedBackend = useWidgetConfigContext((s) => s.formState.selectedBackend);

  const backendOptions = useMemo(
    (): EnhancedSelectOptionData[] =>
      Array.from(backendNameToWidgetMap.keys())
        .filter((backendName) => backendNameToWidgetMap.get(backendName)?.size > 0)
        .map((backendName) => {
          const widgets = backendNameToWidgetMap.get(backendName);
          const widgetCount = widgets?.size || 0;

          // Get a representative endpoint from the first widget to show backend base URL
          let backendEndpoint = "No endpoint configured";
          if (widgets && widgets.size > 0) {
            const firstWidget = Array.from(widgets.values())[0];
            if (typeof firstWidget.endpoint === "string") {
              try {
                const url = new URL(firstWidget.endpoint);
                backendEndpoint = `${url.protocol}//${url.host}`;
              } catch {
                backendEndpoint = firstWidget.endpoint;
              }
            } else if (firstWidget.endpoint?.url) {
              try {
                const url = new URL(firstWidget.endpoint.url);
                backendEndpoint = `${url.protocol}//${url.host}`;
              } catch {
                backendEndpoint = firstWidget.endpoint.url;
              }
            }
          }

          const isWidgetStudio = backendName.toLowerCase().includes("widget studio");

          return {
            value: backendName,
            label: backendName,
            icon: "server-03" as const,
            subtitle: `${widgetCount} widget${widgetCount !== 1 ? "s" : ""} available`,
            description: backendEndpoint,
            tooltip: (
              <EnhancedTooltip.Root>
                <EnhancedTooltip.Header
                  left={isWidgetStudio ? "Saved Widgets" : "Backend Service"}
                />
                <EnhancedTooltip.Title>{backendName}</EnhancedTooltip.Title>
                <EnhancedTooltip.Divider />
                <EnhancedTooltip.Badge>
                  {widgetCount} Widget{widgetCount !== 1 ? "s" : ""}
                </EnhancedTooltip.Badge>
                {isWidgetStudio ? (
                  <EnhancedTooltip.Content>
                    Widgets created using Widget Studio. Settings are stored in OpenBB
                    and can be managed from the Widgets library page.
                  </EnhancedTooltip.Content>
                ) : (
                  <EnhancedTooltip.Section title="Base URL">
                    <EnhancedTooltip.Code>{backendEndpoint}</EnhancedTooltip.Code>
                  </EnhancedTooltip.Section>
                )}
              </EnhancedTooltip.Root>
            ),
          };
        }),
    [backendNameToWidgetMap],
  );

  const widgetOptions = useMemo((): EnhancedSelectOptionData[] => {
    if (!selectedBackend) return [];
    const widgets = backendNameToWidgetMap.get(selectedBackend);
    if (!widgets) return [];

    return Array.from(widgets.values()).map((widget) => {
      // Extract endpoint information for display
      let endpoint = "";
      if (typeof widget.endpoint === "string") {
        endpoint = widget.endpoint;
      } else if (widget.endpoint?.url) {
        endpoint = widget.endpoint.url;
      } else if (widget.widgetConfig?.endpoint) {
        const nestedEndpoint = widget.widgetConfig.endpoint;
        if (typeof nestedEndpoint === "string") {
          endpoint = nestedEndpoint;
        } else if (nestedEndpoint?.url) {
          endpoint = nestedEndpoint.url;
        }
      }

      const formattedEndpoint = formatEndpoint(endpoint);
      const widgetType = widget.type || "unknown";

      return {
        value: widget.widgetId || "",
        label: widget.name || widget.widgetId || "Unnamed Widget",
        icon: getWidgetIcon(widgetType),
        subtitle: formattedEndpoint,
        description: widget.description || "No description available",
        tooltip: (
          <EnhancedTooltip.Root>
            <EnhancedTooltip.Header
              left={selectedBackend}
              right={widget.source || undefined}
            />
            <EnhancedTooltip.Title>
              {widget.name || widget.widgetId || "Unnamed Widget"}
            </EnhancedTooltip.Title>
            <EnhancedTooltip.Divider />
            {(widget.category || widget.subCategory) && (
              <EnhancedTooltip.Badge>
                {[widget.category, widget.subCategory].filter(Boolean).join(" • ")}
              </EnhancedTooltip.Badge>
            )}
            {widget.description && (
              <EnhancedTooltip.Content>{widget.description}</EnhancedTooltip.Content>
            )}
            <EnhancedTooltip.Section title="Endpoint">
              <EnhancedTooltip.Code>{formattedEndpoint}</EnhancedTooltip.Code>
            </EnhancedTooltip.Section>
          </EnhancedTooltip.Root>
        ),
      };
    });
  }, [backendNameToWidgetMap, selectedBackend]);

  return { backendOptions, widgetOptions };
}
