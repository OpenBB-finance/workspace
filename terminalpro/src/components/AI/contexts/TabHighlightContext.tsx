import { useMemo } from "react";
import type { WidgetT } from "~/components/types";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";

export interface TabHighlightContextType {
  hoveredWidgetTabId: string | null;
}

export function useTabHighlight(): TabHighlightContextType {
  const { hoveredCitationWidgetId, hoveredTabId } = useShallowCopilotStore((state) => ({
    hoveredCitationWidgetId: state.hoveredCitationWidgetId,
    hoveredTabId: state.hoveredTabId,
  }));

  const getWidgetsInCurrentDashboard = useShallowCopilotDataStore(
    (state) => state.getWidgetsInCurrentDashboard,
  );

  const hoveredWidgetTabId = useMemo(() => {
    // Prioritize direct tab hovering over widget-derived tab hovering
    if (hoveredTabId) {
      return hoveredTabId;
    }

    if (!hoveredCitationWidgetId) {
      return null;
    }

    try {
      const widgets = getWidgetsInCurrentDashboard() as WidgetT[];

      const highlightedWidget = widgets?.find(
        (widget) => widget.id === hoveredCitationWidgetId,
      );

      if (highlightedWidget?.innerTab) {
        return highlightedWidget.innerTab;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, [hoveredCitationWidgetId, hoveredTabId, getWidgetsInCurrentDashboard]);

  return { hoveredWidgetTabId };
}
