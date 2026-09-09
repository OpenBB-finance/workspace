import isEqual from "lodash.isequal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCallbackRef, useCreateRef } from "~/hooks/useRefHooks";
import { useTabContext } from "~/lib/contexts/TabContext";
import {
  type AppState,
  type Group,
  type Ticker,
  useAppStore,
  useShallowAppStore,
} from "~/lib/state/app";
import { type SharedAppState, useSharedAppStore } from "~/lib/state/sharedApp";
import {
  addToWidgetParamGroups,
  getCellOnClickParams,
  getEndpointParamGroupByIds,
  getEndpointParamName,
  getJsonWidget,
  getWidgetInfo,
  isOmniType,
  isSSRMType,
  needsGroupValueUpdate,
  triggerCustomEvent,
  updateWidgetGroupValues,
  useEventListener,
} from "~/lib/utils";
import { useIsFirstRender } from "./General/Table/hooks/utils";
import type { NewWidgetT, WidgetProps, WidgetT } from "./types";

type SubType = [Group[], Ticker[], string | null];

/**
 * Decides whether an in-memory widget update must also be persisted to the
 * app store. Param-group, group, and ticker changes are the historical
 * triggers; everything else stays in provider state until an explicit save.
 * Extracted from updateWidgetCallback so the gate is testable in isolation.
 */
export function shouldPersistWidgetUpdate(
  currentWidget: WidgetT,
  newWidget: WidgetT,
  getParamName: (groupById: string) => string,
): boolean {
  const prevMainTicker = currentWidget.data?.mainTicker?.symbol;
  const prevParams = currentWidget.storage?.params;
  const prevGroupById = currentWidget.groupById;
  const newMainTicker = newWidget.data?.mainTicker?.symbol;
  const newParams = newWidget.storage?.params;

  // Identity fields set by update_widget (MCP/copilot) arrive without any
  // param/group change — they must persist or the rename is a silent no-op.
  // The `in` guard keeps partial update objects from forcing store churn.
  if (
    ("name" in newWidget && currentWidget.name !== newWidget.name) ||
    ("description" in newWidget &&
      currentWidget.description !== newWidget.description) ||
    ("source" in newWidget && currentWidget.source !== newWidget.source)
  ) {
    return true;
  }

  if (newWidget.paramGroups) {
    const paramNames = Object.keys(newWidget.paramGroups);

    if (
      paramNames.some((groupById) => {
        const paramName = getParamName(groupById);

        return newParams?.[paramName] !== prevParams?.[paramName];
      })
    ) {
      return true;
    }
  }

  if (prevGroupById || newWidget.groupId) {
    const params = (newWidget.params ?? []).concat(
      newWidget.storage?.sqlParamDefs ?? [],
    );
    const paramName = getEndpointParamName(params, newWidget.groupById);
    if (
      prevGroupById !== newWidget.groupId ||
      prevMainTicker !== newMainTicker ||
      (paramName && prevParams?.[paramName] !== newParams?.[paramName])
    ) {
      return true;
    }
  }

  return false;
}

export function useWidgetSync(props: Omit<WidgetProps, "children">) {
  const { getWidget, isShared } = useTabContext();
  const [providerWidget, setProviderWidget] = useState(
    props.contextOverride?.widget || (getWidget?.(props.uuid) as WidgetT),
  );

  const isFirstRender = useIsFirstRender();

  const storeUpdateWidget = useShallowAppStore((state) => state.updateWidget);

  const widgetFromJSON = useMemo(
    () => getJsonWidget(providerWidget),
    [providerWidget?.widgetId, getWidgetInfo(providerWidget), providerWidget?.params],
  );

  useEffect(() => {
    if (isFirstRender) return;
    if (props.isPreview && props.contextOverride?.widget) {
      setProviderWidget(props.contextOverride.widget);
    }
  }, [props.contextOverride?.widget]);

  const endpointParams = useMemo(() => {
    return getEndpointParamGroupByIds(providerWidget);
  }, [providerWidget?.params, providerWidget?.storage?.sqlParamDefs]);

  const cellOnClickParams = useMemo(() => {
    return getCellOnClickParams(providerWidget, false);
  }, [providerWidget?.data?.table?.columnsDefs]);

  const ignoreParamsRef = useCreateRef(cellOnClickParams);

  const getParamName = useCallbackRef(
    (groupById) => endpointParams?.[groupById] ?? groupById,
  );

  const needsUpdateRef = useRef(false);

  // Use a ref to keep track of the current providerWidget
  const providerWidgetRef = useCreateRef(providerWidget);

  // Use a ref to keep track of the saveToStore callback
  const saveToStoreCb = useCallbackRef(() => {
    if (needsUpdateRef.current && !props.contextOverride) {
      storeUpdateWidget(props.activeDashboardId, providerWidget);
      needsUpdateRef.current = false;
    }
  });

  const onBeforeUnload = useCallback(
    (_e: BeforeUnloadEvent) => {
      if (needsUpdateRef.current) saveToStoreCb();
    },
    [saveToStoreCb, needsUpdateRef],
  );

  useEffect(() => {
    const { activeDashboardId, uuid, contextOverride } = props;
    let unsubscribe = null;
    const ctrl = new AbortController();

    if (providerWidget?.external && providerWidget?.staleTime === undefined) {
      setProviderWidget((currentWidget) => {
        return { ...currentWidget, staleTime: 1000 * 60 * 15 };
      });
    }

    if (!contextOverride) {
      const store = isShared ? useSharedAppStore : useAppStore;
      // @ts-expect-error
      unsubscribe = store.subscribe(
        (s: SharedAppState | AppState) => {
          {
            const storeWidget = s.getWidgetById(uuid);
            return [
              s.getWidgetGroups(activeDashboardId, uuid),
              storeWidget?.data?.secondaryTickers,
              storeWidget?.innerTab,
            ];
          }
        },
        (current: SubType, prev: SubType) => {
          const lastWidget = providerWidgetRef.current;

          const [groups, secondaryTickers, innerTab] = current;
          const [prevGroups, prevSecondaryTickers, _] = prev;
          const group = groups?.find((g) => g.type === "ticker");

          const newGroup =
            !isEqual(groups, prevGroups) || lastWidget?.groupId !== group?.id;
          const newSecondaryTickers = !isEqual(secondaryTickers, prevSecondaryTickers);

          const linkedGroups = groups?.filter((g) =>
            needsGroupValueUpdate(lastWidget, g),
          );
          const groupValuesUpdated = linkedGroups?.length > 0;

          if (newGroup || newSecondaryTickers || groupValuesUpdated) {
            return setProviderWidget((currentWidget) => {
              const updatedWidget = updateWidgetGroupValues(
                currentWidget,
                linkedGroups,
              );
              updatedWidget.groupId = group?.id ?? null;
              updatedWidget.paramGroups = (groups || []).reduce((acc, g) => {
                if (g.type === "ticker") return acc;
                acc = addToWidgetParamGroups(acc, g);
                return acc;
              }, {});

              if (newSecondaryTickers) {
                updatedWidget.data.secondaryTickers = secondaryTickers;
              }

              const groupParams = Object.keys(updatedWidget.paramGroups);
              const updatedParams = groupParams.reduce((acc, groupById) => {
                const paramName = getParamName(groupById);
                const value = updatedWidget.storage?.params?.[paramName];
                if (
                  value !== undefined &&
                  ignoreParamsRef.current?.includes(paramName)
                ) {
                  updatedWidget.storage.params[paramName] = undefined;
                }

                acc[paramName] = value;
                return acc;
              }, {});

              if (groupValuesUpdated && groupParams?.length > 0) {
                triggerCustomEvent(`updateQueryParams-${uuid}`, updatedParams);
              }

              return updatedWidget;
            });
          }

          if (lastWidget?.innerTab !== innerTab)
            setProviderWidget((currentWidget) => ({ ...currentWidget, innerTab }));
        },
        { fireImmediately: true },
      );
    }

    // Add event listeners for beforeunload and save shortcut
    window.addEventListener("beforeunload", onBeforeUnload, { signal: ctrl.signal });

    return () => {
      if (unsubscribe) {
        unsubscribe();
        saveToStoreCb();
      }
      ctrl.abort();
    };
  }, [
    providerWidgetRef,
    needsUpdateRef,
    ignoreParamsRef,
    getParamName,
    saveToStoreCb,
    setProviderWidget,
  ]);

  const updateWidgetCallback = useCallback(
    (newWidget: NewWidgetT, forceStoreUpdate = false) => {
      if (!newWidget) return;

      setProviderWidget((currentWidget) => {
        if (typeof newWidget === "function") newWidget = newWidget(currentWidget);

        if (!props.contextOverride) {
          if (!needsUpdateRef.current)
            needsUpdateRef.current = !isEqual(currentWidget, newWidget);

          const updateStore =
            forceStoreUpdate ||
            shouldPersistWidgetUpdate(
              currentWidget,
              newWidget as WidgetT,
              getParamName,
            );

          if (updateStore) {
            queueMicrotask(() =>
              storeUpdateWidget(props.activeDashboardId, newWidget as WidgetT),
            );
          }
        }
        props.contextOverride?.updateWidget?.(newWidget);

        return newWidget;
      });
    },
    [
      needsUpdateRef,
      setProviderWidget,
      props.contextOverride?.updateWidget,
      props.activeDashboardId,
      getParamName,
    ],
  );

  useEventListener("saveWidgets", saveToStoreCb);
  useEventListener("refreshQuery", () =>
    setProviderWidget((currentWidget) => {
      const widgetType = currentWidget?.type;
      if (isOmniType(widgetType) || isSSRMType(widgetType)) {
        queueMicrotask(() => triggerCustomEvent(`runParams-${currentWidget?.id}`));
      }
      return { ...currentWidget, refreshQuery: Date.now() };
    }),
  );
  useEventListener(`updateWidget-${props?.uuid}`, updateWidgetCallback);

  return [updateWidgetCallback, providerWidget, widgetFromJSON] as const;
}
