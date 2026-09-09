import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useShallowAppWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import { EnhancedSelect } from "~/components/ds/atoms/EnhancedSelect";
import Icon from "~/components/Icon";
import type { WidgetT } from "~/components/types";
import { useBackendSelection } from "../hooks/useBackendSelection";
import { useWidgetConfigContext } from "../WidgetConfigContext";

export function BackendWidgetSelector() {
  const context = useWidgetConfigContext((s) => ({
    handleTestAndFetchData: s.handleTestAndFetchData,
    getFormState: s.getFormState,
    dispatch: s.dispatchFormState,
    setWidgetConfig: s.setWidgetConfig,
    updateJsonFromConfig: s.updateJsonFromConfig,
  }));

  const { selectedBackend, selectedWidget } = context.getFormState();

  const allBackendNameToWidgetMap = useShallowAppWidgetsStore(
    (s) => s.backendNameToWidgetMap,
  );

  // Filter to only include custom backends and Widget Studio
  const backendNameToWidgetMap = useMemo(() => {
    const builtInBackends = new Set([
      "API Endpoints",
      "DatabaseConnector",
      "OpenBB Sandbox",
      "OpenBB Hub",
      "OpenBB Workspace",
      "SnowflakeConnector",
    ]);

    const filteredMap = new Map<string, Map<string, WidgetT>>();

    for (const [backendName, widgetMap] of allBackendNameToWidgetMap.entries()) {
      if (!builtInBackends.has(backendName)) {
        filteredMap.set(backendName, widgetMap);
      }
    }

    return filteredMap;
  }, [allBackendNameToWidgetMap]);

  const { backendOptions, widgetOptions } = useBackendSelection(backendNameToWidgetMap);

  const handleWidgetChange = useCallback(
    (widgetId: string) => {
      context.dispatch({ selectedWidget: widgetId });
      const state = context.getFormState();

      if (!(state.selectedBackend && widgetId)) return;

      const widgets = backendNameToWidgetMap.get(state.selectedBackend);
      if (!widgets) return;

      const selectedWidgetData = Array.from(widgets.values()).find(
        (widget) => widget.widgetId === widgetId,
      );

      if (selectedWidgetData) {
        const nestedWidget = {
          ...selectedWidgetData,
          ...(selectedWidgetData.widgetConfig ?? {}),
        };

        // Extract endpoint information
        let endpointUrl = "";
        let authRequired = false;
        let authHeaderKey = "";
        let tokenBearer = "";

        if (typeof nestedWidget.endpoint === "string") {
          endpointUrl = nestedWidget.endpoint;
        } else if (nestedWidget.endpoint?.url) {
          endpointUrl = nestedWidget.endpoint.url;
        }

        // Check for authentication headers
        if (
          nestedWidget.endpointHeaders &&
          Array.isArray(nestedWidget.endpointHeaders) &&
          nestedWidget.endpointHeaders.length > 0
        ) {
          authRequired = true;
          const firstHeader = nestedWidget.endpointHeaders[0];
          authHeaderKey = firstHeader.key || "";
          tokenBearer = firstHeader.value || "";
        } else if (
          nestedWidget.endpoint?.headers &&
          typeof nestedWidget.endpoint.headers === "object" &&
          Object.keys(nestedWidget.endpoint.headers).length > 0
        ) {
          authRequired = true;
          const headerKey = Object.keys(selectedWidgetData.endpoint.headers)[0];
          authHeaderKey = headerKey;
          tokenBearer = selectedWidgetData.endpoint.headers[headerKey];
        }

        // Extract widget configuration
        const widgetConfig = {
          widgetId: nestedWidget.widgetId || selectedWidgetData.widgetId,
          name: selectedWidgetData.name || "",
          description: selectedWidgetData.description || "",
          endpoint: endpointUrl,
          type: selectedWidgetData.type || nestedWidget.type || "table",
          category: selectedWidgetData.category || "",
          subCategory: selectedWidgetData.subCategory || "",
          runButton: nestedWidget.runButton,
          gridData: {
            w: nestedWidget.gridData?.w || 20,
            h: nestedWidget.gridData?.h || 9,
            minW: nestedWidget.gridData?.minW || 10,
            minH: nestedWidget.gridData?.minH || 5,
            maxW: nestedWidget.gridData?.maxW || 40,
            maxH: nestedWidget.gridData?.maxH || 100,
          },
          dataKey: nestedWidget.data?.dataKey || "",
          wsEndpoint: nestedWidget.wsEndpoint || "",
          wsRowIdColumn: nestedWidget.data?.wsRowIdColumn || "",
          params: nestedWidget.params || [],
          enableCharts: nestedWidget.data?.table?.enableCharts,
          showAll: nestedWidget.data?.table?.showAll !== false,
          chartViewEnabled: nestedWidget.data?.table?.chartView?.enabled,
          chartType: nestedWidget.data?.table?.chartView?.chartType || "column",
          columnsDefs: (nestedWidget.data?.table?.columnsDefs || []).map(
            (col: any) => ({
              ...col,
              renderFn: col.renderFn
                ? Array.isArray(col.renderFn)
                  ? col.renderFn
                  : [col.renderFn]
                : [],
            }),
          ),
          refetchInterval: nestedWidget.refetchInterval ?? 900000,
          dataUpdateDisplay: nestedWidget.dataUpdateDisplay || "",
          staleTime: nestedWidget.staleTime || 300000,
          source: Array.isArray(selectedWidgetData.source)
            ? selectedWidgetData.source
            : selectedWidgetData.source
              ? [selectedWidgetData.source]
              : [],
          headers:
            state.authRequired && state.authHeaderKey && state.tokenBearer
              ? { [state.authHeaderKey]: state.tokenBearer }
              : {},
          // Add source information for tracking backend association
          sourceId: selectedWidgetData.sourceId,
          sourceName: selectedWidgetData.sourceName,
        };

        // Generate mock data for preview

        context.setWidgetConfig(widgetConfig);

        // Update the form state with preview data populated
        context.dispatch({
          endpoint: endpointUrl,
          authRequired,
          authHeaderKey,
          tokenBearer,
          error: null,
        });

        context.handleTestAndFetchData(widgetConfig.endpoint, widgetConfig.type);
        context.dispatch({ isUpdatingPreview: true });

        // Small delay to show loading state before updating
        setTimeout(() => context.dispatch({ isUpdatingPreview: false }), 50);

        // If we're on JSON tab, update JSON immediately
        if (state.activeConfigTab === "json") context.updateJsonFromConfig();
      }
    },
    [backendNameToWidgetMap, context],
  );

  // Validate restored backend and widget selections
  useEffect(() => {
    const state = context.getFormState();
    if (state.selectedBackend && backendNameToWidgetMap.size > 0) {
      if (!backendNameToWidgetMap.has(state.selectedBackend)) {
        context.dispatch({ selectedBackend: "", selectedWidget: "" });
        return;
      }

      if (state.selectedWidget) {
        const widgets = backendNameToWidgetMap.get(state.selectedBackend);
        const widgetExists =
          widgets &&
          Array.from(widgets.values()).some(
            (widget) => widget.widgetId === state.selectedWidget,
          );

        if (!widgetExists) {
          context.dispatch({ selectedWidget: "" });
        } else if (widgets) {
          const selectedWidgetData = Array.from(widgets.values()).find(
            (widget) => widget.widgetId === state.selectedWidget,
          );
          if (selectedWidgetData && !state.previewData) {
            handleWidgetChange(state.selectedWidget);
          }
        }
      }
    }
  }, [backendNameToWidgetMap, selectedBackend, selectedWidget, handleWidgetChange]);

  return useMemo(() => {
    if (backendOptions.length === 0) {
      return (
        <div className="px-6 mb-6 flex-shrink-0">
          <div className="flex items-start gap-3 p-4 rounded border border-light-200 dark:border-dark-700 bg-light-50 dark:bg-dark-800">
            <Icon
              id="info-circle"
              className="size-5 text-light-600 dark:text-dark-200 flex-shrink-0"
            />
            <div>
              <p className="body-sm-medium text-light-700 dark:text-light-300">
                No backends connected
              </p>
              <p className="body-xs-regular text-light-600 dark:text-dark-50 mt-1">
                Connect to a backend first to reference existing widgets. You can do
                this in the{" "}
                <Link to="/app" className="obb-hyper-link">
                  Apps
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-6 mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-72">
            <EnhancedSelect
              label="Reference Backend"
              options={backendOptions}
              value={selectedBackend}
              onChange={(selectedBackend) =>
                context.dispatch({ selectedBackend, selectedWidget: "" })
              }
              placeholder="Select a backend service"
            />
          </div>
          <div className="w-80">
            <EnhancedSelect
              label="Reference Widget"
              options={widgetOptions}
              value={selectedWidget}
              onChange={handleWidgetChange}
              placeholder={
                selectedBackend
                  ? widgetOptions.length === 0
                    ? "No widgets available in this backend"
                    : "Select a widget to reference"
                  : "Select a backend first"
              }
              disabled={!selectedBackend || widgetOptions.length === 0}
            />
          </div>
        </div>
      </div>
    );
  }, [
    backendOptions,
    widgetOptions,
    selectedBackend,
    selectedWidget,
    context.dispatch,
    handleWidgetChange,
  ]);
}

BackendWidgetSelector.displayName = "BackendWidgetSelector";
