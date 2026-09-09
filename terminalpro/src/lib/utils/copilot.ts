import type { WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import type { Citation as CitationT } from "~/lib/state/copilot";

/**
 * Finds a widget on the dashboard that matches the citation's content.
 *
 * This function determines if a widget corresponding to a citation already exists
 * on the current dashboard by comparing the widget's type and its configuration
 * parameters, rather than relying on a transient UUID.
 *
 * @param citation - The citation to match.
 * @param dashboardWidgets - An array of widgets currently on the dashboard.
 * @param allAppWidgets - A map of all available widget definitions.
 * @returns The matching widget or undefined if no match is found.
 */
export function findMatchingWidget(
  citation: CitationT,
  dashboardWidgets: WidgetT[],
  allAppWidgets: Map<WidgetId, WidgetT>,
): WidgetT | undefined {
  if (citation.source_info.type !== "widget") {
    return undefined;
  }

  const inputArgs = citation.source_info?.metadata?.input_args;
  if (!inputArgs) {
    return undefined;
  }

  // Determine the widgetId and potential originalWidgetId for composite widgets
  let widgetId = citation.source_info?.widget_id || citation.source_info?.name;
  let originalWidgetId = "";
  if (["income_statement", "balance_sheet", "cash_flow_statement"].includes(widgetId)) {
    originalWidgetId = widgetId;
    widgetId = "financial_statements";
  }

  const widgetDefinition = allAppWidgets.get(widgetId as WidgetId);
  if (!widgetDefinition) {
    return undefined;
  }

  // Find a widget on the dashboard that matches the type and parameters
  const matchingWidget = dashboardWidgets.find((widget) => {
    // 1. Check if the widget ID matches. This is more specific than widget.type
    if (widget.widgetId !== widgetId) {
      return false;
    }

    // 2. Handle special cases like financial statements where a sub-type must match
    if (originalWidgetId && widget.storage?.selectedGroup !== originalWidgetId) {
      return false;
    }

    // 3. Compare parameters for an exact match
    if (widgetDefinition.params) {
      for (const paramDef of widgetDefinition.params) {
        const paramName = paramDef.paramName;
        const citationValue = inputArgs[paramName];
        const widgetValue = widget.storage?.params?.[paramName];

        // If the citation provides a value for this param, it must match the widget's value.
        // We ignore "null" strings as they often represent unset optional params.
        if (
          citationValue !== undefined &&
          citationValue !== null &&
          citationValue !== "null"
        ) {
          // Using String() to handle potential type differences (e.g., 5 vs "5")
          if (String(widgetValue) !== String(citationValue)) {
            return false;
          }
        }
      }
    }

    // If all checks pass, it's a match
    return true;
  });

  return matchingWidget;
}
