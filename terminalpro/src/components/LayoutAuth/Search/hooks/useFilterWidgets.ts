import { useMemo } from "react";
import type { WidgetT } from "~/components/types";
import { getAllowedDataVendors } from "~/lib/onPremFeatureFlags";
import WIDGET_BUNDLES from "../../../../lib/widget_bundles.json";
import type { SearchDialogState } from "../SearchDialog";

const assetClasses = ["all", "equity", "index", "etf"];
export type WidgetItem = Partial<Omit<WidgetT, "type">> & {
  uniqueId?: string;
  imgUrl?: string;
  type?: string;
  extension?: string;
};

const allowedVendorsFF = getAllowedDataVendors();

export function useFilterWidgets(widgets: WidgetItem[], state: SearchDialogState) {
  const widgetsMemo = useMemo(
    () =>
      widgets
        .filter((widget) => {
          // If no allowed vendors specified, show all widgets

          // For core widgets (from openbb bundle), always show them
          const realWidgetId = widget?.widgetId?.split("-")?.[0];
          if (WIDGET_BUNDLES.openbb.widgets.includes(realWidgetId)) {
            return true;
          }

          // For external widgets, always show them
          if (widget.external) {
            return true;
          }

          // Check if widget's source is in allowed vendors
          if (typeof widget.source === "string") {
            return allowedVendorsFF.includes(widget.source.toLowerCase());
          }

          // Shared files and backends are always shown
          if (
            ["shared files", "shared backends"].includes(
              widget?.category?.toLowerCase(),
            )
          ) {
            return true;
          }

          return widget.source?.some((source) =>
            allowedVendorsFF.includes(source.toLowerCase()),
          );
        })
        .flatMap((widget) => {
          const category =
            widget.category?.toLowerCase() === "others" && widget.external
              ? "my data"
              : widget?.category
                ? widget?.category.toLocaleLowerCase()
                : "my data";

          const supportedAssetClasses = widget?.supportedAssetClasses || [];
          if (assetClasses.some((asset) => supportedAssetClasses.includes(asset))) {
            if (
              supportedAssetClasses.length === 1 &&
              supportedAssetClasses[0] === "all"
            ) {
              return { ...widget, category };
            }
            return widget.supportedAssetClasses.map((assetClass) => ({
              ...widget,
              uniqueId: `${widget.uniqueId}-${assetClass}`,
              category: assetClass.toLowerCase(),
            }));
          }
          return { ...widget, category };
        }),
    [widgets],
  );

  const widgetsArray = useMemo(() => {
    const { selectedOption, selectedCategory } = state;
    const showAll = selectedOption === "all";

    const filteredWidgets = widgetsMemo
      .filter((widget) => {
        if (widget?.external && (selectedOption === "external" || showAll)) return true;

        if (
          (selectedOption === "shared" || showAll) &&
          ["shared files", "shared backends"].includes(widget?.category?.toLowerCase())
        )
          return true;

        const realWidgetId = widget?.widgetId?.split("-")?.[0] || widget?.widgetId;
        if (
          Object.entries(WIDGET_BUNDLES).some(
            ([key, bundle]) =>
              key !== "openbb" && bundle.widgets.includes(realWidgetId),
          ) &&
          showAll
        ) {
          return true;
        }
        if (WIDGET_BUNDLES.openbb.widgets.includes(realWidgetId) && showAll) {
          return true;
        }
        return false;
      })
      .filter(
        (widget) =>
          selectedCategory === "All" ||
          widget.category.toLowerCase() === selectedCategory.toLowerCase() ||
          (selectedCategory?.toLowerCase() === "others" &&
            widget?.category === "my data"),
      )
      .sort((a, b) => {
        // Sort by category first
        if (a.category.toLowerCase() !== b.category.toLowerCase()) {
          return a.category.toLowerCase().localeCompare(b.category.toLowerCase());
        }
        // If categories are the same, sort by sub-category
        if (a.subCategory !== b.subCategory) {
          return (a.subCategory || "").localeCompare(b.subCategory || "");
        }
        // If sub-categories are the same, sort alphabetically by name
        return a.name.localeCompare(b.name);
      });

    return filteredWidgets;
  }, [widgetsMemo, state.selectedOption, state.selectedCategory]);

  return widgetsArray;
}
