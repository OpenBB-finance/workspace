import { createContext, type PropsWithChildren, useContext, useMemo } from "react";
import { useCreateRef } from "~/hooks/useRefHooks";
import type { NewWidgetT, WidgetContextType, WidgetProps, WidgetT } from "./types";
import { useWidgetSync } from "./Widget.hooks";

export interface WidgetStoreProps {
  widget: WidgetT;
  widgetFromJSON: WidgetT | null;
  activeDashboardId: string;
  isShared: boolean;
  uuid: string;
}

export interface WidgetState extends WidgetStoreProps {
  storageParams: WidgetT["storage"]["params"];
  storage: WidgetT["storage"];
  columnsDefs: WidgetT["data"]["table"]["columnsDefs"];
  needsUpdate: boolean;
  endpointParams: Record<string, string>;
  stateKey: string;
  getParamName: (groupById: string) => string;
  updateWidget: (newWidget: NewWidgetT, forceStoreUpdate?: boolean) => void;
}

// const createWidgetStore = (initialProps: Partial<WidgetStoreProps>) => {
//   const { widget, widgetFromJSON, activeDashboardId, isShared, uuid } = initialProps;

//   const endpointParams = widget?.params
//     ?.filter((p): p is ParamDefT<"endpoint"> => p.type === "endpoint")
//     ?.reduce((acc, p) => {
//       acc[p.groupById] = p?.paramName;
//       return acc;
//     }, {});

//   return createWithEqualityFn<WidgetState>()(
//     subscribeWithSelector((set, get) => ({
//       widget: widget,
//       storageParams: widget.storage?.params ?? {},
//       storage: widget.storage ?? {},
//       columnsDefs: widget.data?.table?.columnsDefs ?? [],
//       widgetFromJSON: widgetFromJSON ?? getJsonWidget(widget),
//       activeDashboardId: activeDashboardId,
//       isShared: isShared ?? false,
//       uuid: uuid ?? "",
//       needsUpdate: false,
//       endpointParams: endpointParams,
//       stateKey: getStateKey(widget),
//       getParamName: (groupById: string) =>
//         get().endpointParams?.[groupById] ?? groupById,
//       updateWidget: (newWidget, forceStoreUpdate = false) => {
//         const currentWidget = structuredClone(get().widget);
//         set(
//           produce((state: WidgetState) => {
//             if (typeof newWidget === "function") {
//               newWidget(state.widget);
//             } else {
//               state.widget = newWidget;
//             }

//             const currentMainTicker = currentWidget.data?.mainTicker?.symbol;
//             const newMainTicker = state.widget.data?.mainTicker?.symbol;
//             const currentParams = currentWidget.storage?.params;
//             const newParams = state.widget.storage?.params;
//             let updateStore = forceStoreUpdate;

//             if (!state.needsUpdate)
//               state.needsUpdate = !isEqual(currentWidget, newWidget);

//             if (!updateStore && state.widget.paramGroups) {
//               const paramNames = Object.keys(state.widget.paramGroups);

//               updateStore = paramNames.some((groupById) => {
//                 const paramName = state.getParamName(groupById);

//                 return newParams?.[paramName] !== currentParams?.[paramName];
//               });
//             }

//             if (!updateStore && (currentWidget.groupId || state.widget.groupId)) {
//               const paramName = getEndpointParamName(
//                 state.widget.params,
//                 state.widget.groupById,
//               );
//               if (
//                 currentWidget.groupId !== state.widget.groupId ||
//                 currentMainTicker !== newMainTicker ||
//                 (paramName && currentParams?.[paramName] !== newParams?.[paramName])
//               ) {
//                 updateStore = true;
//               }
//             }

//             state.stateKey = getStateKey(state.widget);

//             if (!isShared && (updateStore || forceStoreUpdate)) {
//               useAppStore
//                 .getState()
//                 .updateWidget(state.activeDashboardId, state.widget);
//             }
//           }),
//         );
//       },
//     })),
//     (prev, next) => isEqual(prev, next),
//   );
// };

// type WidgetStore = ReturnType<typeof createWidgetStore>;
// const WidgetStoreContext = createContext<WidgetStore | null>(null);

// export function useWidgetStoreContext<T>(
//   selector?: (store: WidgetState) => T,
//   equalityFn: (a: T, b: T) => boolean = (prev, next) => isEqual(prev, next),
// ) {
//   const store = useContext(WidgetStoreContext);

//   if (!store) {
//     throw new Error("useWidgetStoreContext must be used within a WidgetStoreProvider");
//   }

//   return useStoreWithEqualityFn(store, selector, equalityFn);
// }

// type WidgetStoreProviderProps = PropsWithChildren<WidgetStoreProps>;

// function WidgetStoreProvider({ children, ...rest }: PropsWithChildren<WidgetProps>) {
//   const getWidget = useTabContext()?.getWidget;

//   const storeRef = useRef<WidgetStore>();
//   if (!storeRef.current) {
//     storeRef.current = createWidgetStore({ widget: getWidget(rest.uuid), ...rest });
//   }

//   const childrenMemo = useMemo(() => children, [children]);

//   return (
//     <WidgetStoreContext.Provider value={storeRef.current}>
//       {childrenMemo}
//     </WidgetStoreContext.Provider>
//   );
// }

export const WidgetContext = createContext<WidgetContextType>({
  widget: undefined,
  widgetRef: { current: null },
  widgetFromJSON: null,
  activeDashboardId: "",
  isShared: false,
  isPreview: false,
  uuid: "",
  updateWidget: (_prev) => {},
  getWidget: () => null,
});

WidgetContext.displayName = "WidgetContext";

export const useWidgetContext = (
  nullable = false,
  contextOverride?: WidgetContextType,
) => {
  const context = useContext(WidgetContext);
  if (!(context || nullable)) {
    throw new Error("useWidgetContext must be used within a WidgetProvider");
  }
  if (contextOverride) {
    return { ...context, ...contextOverride };
  }
  return context;
};

export function WidgetProvider(props: PropsWithChildren<WidgetProps>) {
  const { children, ...rest } = props;
  const { activeDashboardId, isShared, isPreview, uuid } = rest;
  const [updateWidget, widget, widgetFromJSON] = useWidgetSync(rest);

  const widgetRef = useCreateRef(widget);

  const getWidget = useMemo(() => () => widgetRef.current, [widgetRef]);

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <WidgetContext.Provider
      value={{
        widget,
        widgetRef,
        widgetFromJSON,
        activeDashboardId,
        isShared,
        isPreview,
        uuid,
        updateWidget,
        getWidget,
      }}
    >
      {childrenMemo}
    </WidgetContext.Provider>
  );
}

WidgetProvider.displayName = "WidgetProvider";
