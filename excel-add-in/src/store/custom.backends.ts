import { create } from "zustand";
import { persist } from "zustand/middleware";

import OPENBB_SANDBOX_WIDGET_NAME_TO_ID from "~/assets/openbb-sandbox-widget-name-to-id.json";
import OPENBB_SANDBOX_WIDGETS from "~/assets/openbb-sandbox-widgets.json";
import { OPENBB_SANDBOX_ID } from "~/constants";
import {
  BackendId,
  BackendsMap,
  WidgetDefinition,
  WidgetId,
} from "~/types/widget.types";

export interface CustomBackendsStore {
  backendsMap: BackendsMap;
  widgetNameToIdByBackendIdMap: Record<BackendId, Record<string, WidgetId>>;
  update: (newMap: BackendsMap) => void;
  getBackendWidgets: (
    backendId: string,
  ) => Record<WidgetId, WidgetDefinition> | undefined;
  getWidgetIdFromName: (
    backendId: string,
    widgetName: string,
  ) => WidgetId | undefined;
}

export const useCustomBackendsStore = create<CustomBackendsStore>()(
  persist(
    (set, get) => ({
      backendsMap: {},
      widgetNameToIdByBackendIdMap: {},
      update(newMap) {
        set((state) => {
          // We ensure OPENBB_SANDBOX_ID is not persisted, that belongs to the
          // application only.
          const { [OPENBB_SANDBOX_ID]: _, ...filteredMap } = newMap;
          const updatedBackendsMap = {
            ...(state.backendsMap ?? {}),
            ...filteredMap,
          };

          // Update the widgetNameToIdByBackendIdMap
          const updatedWidgetNameToIdMap: Record<
            BackendId,
            Record<string, WidgetId>
          > = {};
          Object.entries(updatedBackendsMap).forEach(([backendId, widgets]) => {
            updatedWidgetNameToIdMap[backendId] = {};
            Object.entries(widgets).forEach(([widgetId, widget]) => {
              updatedWidgetNameToIdMap[backendId][widget.name] = widgetId;
            });
          });

          return {
            backendsMap: updatedBackendsMap,
            widgetNameToIdByBackendIdMap: updatedWidgetNameToIdMap,
          };
        });
      },
      getBackendWidgets(backendId: string) {
        // @ts-expect-warning - Fix widget typing hack below
        if (backendId === OPENBB_SANDBOX_ID)
          return OPENBB_SANDBOX_WIDGETS as any;
        const { backendsMap } = get();
        return backendsMap[backendId];
      },
      getWidgetIdFromName(backendId: string, widgetName: string) {
        if (backendId === OPENBB_SANDBOX_ID)
          return OPENBB_SANDBOX_WIDGET_NAME_TO_ID[widgetName] as WidgetId;
        const { widgetNameToIdByBackendIdMap } = get();
        return widgetNameToIdByBackendIdMap[backendId]?.[widgetName];
      },
    }),
    {
      name: "custom-backends",
    },
  ),
);
