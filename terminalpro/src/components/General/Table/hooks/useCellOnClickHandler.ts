import type { CellClickedEvent } from "ag-grid-enterprise";
import { useCallback, useMemo } from "react";
import { dispatchCopilotCommand } from "~/components/AI/hooks/utils";
import type { CellOnClickedProps } from "~/components/General/Table/hooks/types";
import { useWidgetContext } from "~/components/Widget.context";
import { getGroupParamName } from "~/components/Widgets/Helpers/useParamGroupBindings";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import {
  getEndpointParams,
  getTickerParamName,
  parseMarkdownParams,
} from "~/lib/utils";

export function getCellOnClickActionParamsFromAgGrid(
  params: CellClickedEvent,
): CellOnClickedProps | null {
  const target = params.event?.target as Element | null;
  if (target?.closest?.("[data-cell-on-click-renderer='true']")) return null;

  const rendererParams =
    typeof params.colDef?.cellRendererParams === "function"
      ? params.colDef.cellRendererParams(params)
      : params.colDef?.cellRendererParams;

  return {
    ...(rendererParams as CellOnClickedProps),
    value: params.value,
    data: params.data,
  };
}

export function useCellOnClickHandler() {
  const { widgetFromJSON, activeDashboardId, isShared, updateWidget } =
    useWidgetContext();
  const { getWidgetGroups, updateGroup } = useShallowAppStore((state) => ({
    getWidgetGroups: state.getWidgetGroups,
    updateGroup: state.updateGroup,
  }));

  const { selectedCopilot, setCopilotById } = useShallowCopilotStore((state) => ({
    selectedCopilot: state.selectedCopilot,
    setCopilotById: state.setCopilotById,
  }));

  const { tickerParamName, endpointParams } = useMemo(
    () => ({
      tickerParamName: getTickerParamName(widgetFromJSON),
      endpointParams: getEndpointParams(widgetFromJSON),
    }),

    [widgetFromJSON?.params],
  );

  return useCallback(
    (params: CellOnClickedProps) => {
      const { actionType, groupBy } = params;
      const value = groupBy?.valueField
        ? (params.data?.[groupBy.valueField] ?? params.value)
        : params.value;

      if (value === undefined || value === null || value === "") return;

      if (actionType === "sendToAgent" && params?.sendToAgent?.markdown) {
        const agentMessage = parseMarkdownParams(params.sendToAgent.markdown, {
          value: params.value,
          ...params.data,
        })?.parsedValue;

        if (agentMessage) {
          const agentId = params?.sendToAgent?.agentId;
          if (agentId && selectedCopilot?.id !== agentId) setCopilotById(agentId);

          dispatchCopilotCommand((prev) => {
            if (!prev) return agentMessage;
            if (prev?.includes(agentMessage)) return prev;
            return `${prev}\n\n${agentMessage}`;
          });
        }
      }

      if (actionType === "groupBy" && groupBy?.paramName) {
        const widgetGroups = getWidgetGroups(activeDashboardId, widgetFromJSON?.id);
        let matchedGroup = false;

        for (const group of widgetGroups) {
          if (group?.type === "ticker" && groupBy?.paramName === tickerParamName) {
            updateGroup(activeDashboardId, group?.id, {
              ...group,
              value: {
                ...group.value,
                symbol: value,
                id: value,
              },
            });
            return;
          }

          const paramName = getGroupParamName(group, endpointParams);

          if (paramName === groupBy?.paramName) {
            matchedGroup = true;
            updateGroup(activeDashboardId, group?.id, {
              ...group,
              value,
            });
          }
        }

        if (!matchedGroup) {
          updateWidget(
            (prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                params: {
                  ...(prev.storage?.params ?? {}),
                  [groupBy.paramName]: value,
                },
              },
            }),
            true,
          );
        }
      }
    },
    [
      activeDashboardId,
      getWidgetGroups,
      isShared,
      selectedCopilot,
      setCopilotById,
      endpointParams,
      tickerParamName,
      updateGroup,
      updateWidget,
    ],
  );
}
