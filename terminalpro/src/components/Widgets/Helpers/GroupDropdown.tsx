import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { debounce } from "lodash";
import {
  type CSSProperties,
  createContext,
  Fragment,
  forwardRef,
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { areTruthy } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import Tooltip from "~/components/SpecialTooltip";
import type { Group, GroupTypes, ParamDef, Ticker, Widget } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  type TabEndpointParams,
  type TabParams,
  useAppStore,
  useShallowAppStore,
} from "~/lib/state/app";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useTableChartThemesStore } from "~/lib/state/tableChartThemes";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import {
  COLORS,
  cn,
  getEndpointParamName,
  getEndpointParams,
  getGroupInfo,
  getGroupLabel,
  getJsonWidget,
  getWidgetsWithSupportedAssetClass,
  groupParamOverride,
  scoreArrays,
  triggerCustomEvent,
  useEventListener,
  uuidv4,
} from "~/lib/utils";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { getContrastTextColor } from "~/utils/colorUtils";
import { GroupPanelHeader, GroupRow } from "./GroupRow";

interface GroupDropdownProps {
  children?: ReactNode;
  type?: GroupTypes;
  groupById?: string;
  paramDef?: ParamDef;
  className?: string;
}

const GROUP_TYPE = {
  endpoint: "endpointParam",
  ticker: "ticker",
};

export const GroupDropdownAnchorContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null);

export const GroupDropdown = forwardRef<HTMLButtonElement, GroupDropdownProps>(
  (
    { children, className = "obb-parameter", paramDef, ...rest }: GroupDropdownProps,
    _ref,
  ) => {
    const {
      widget: {
        id: widgetUuid,
        widgetId,
        paramGroups,
        groupId,
        storage: { sqlParamDefs } = {},
      } = {},
      activeDashboardId,
      widgetFromJSON,
    } = useWidgetContext();

    const params = useMemo(
      () => (widgetFromJSON?.params ?? []).concat(sqlParamDefs ?? []),
      [widgetFromJSON?.params, sqlParamDefs],
    );

    const props = useMemo(() => {
      const newProps = {
        ...rest,
        paramDef,
        groupById: rest?.groupById || paramDef?.paramName,
      };
      if (paramDef?.type === "endpoint") {
        newProps.groupById = paramDef?.groupById;
      }

      if (!newProps.type && paramDef) {
        newProps.type = GROUP_TYPE[paramDef.type] || "param";
      }

      return newProps;
    }, [rest, paramDef]);

    const optionValues = useMemo(() => {
      if (props?.type !== "param") return [];

      if (!paramDef) {
        const paramName = groupParamOverride(props?.groupById, widgetId);
        const param = params?.find(
          (param) =>
            param.paramName === paramName &&
            !["ticker", "endpoint"].includes(param.type),
        );
        return param?.options?.map((o: any) => o.value) || [];
      }

      return paramDef?.options?.map((o: any) => o.value) || [];
    }, [params, paramDef?.options, paramDef?.type, props?.type, props?.groupById]);

    const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
      (state) => ({
        currentTutorial: state.currentTutorial,
        currentStep: state.currentStep,
        goToStep: state.goToStep,
      }),
    );

    const [state, dispatch] = useStateReducer({
      canGroup: false,
      group: null as Group | null,
      groupTextColor: getContrastTextColor(""),
    });

    const [show, setShow] = useState(false);

    const groupingVisible = useShallowThemeStore((state) => state.groupingVisible);
    const getDashboardById = useShallowSharedAppStore((s) => s.getDashboardById);

    const updateGroupState = useCallback(
      (params: {
        groups: Group[];
        currentTabParams: TabParams;
        currentEndpointParams: TabEndpointParams;
      }) => {
        const { groups, currentTabParams, currentEndpointParams } = params;
        const paramName = props?.groupById;

        const group = groups?.find((group) => {
          if (["param", "endpointParam"].includes(props.type))
            return group.type === props.type && paramGroups?.[paramName] === group.id;

          return group.id === groupId && group.type === props.type;
        });

        let canGroup = !!activeDashboardId;
        if (props.type === "param" && canGroup) {
          const tabParam = currentTabParams?.[paramName];
          canGroup = tabParam?.total > 1 || !!group?.id;

          if (areTruthy(optionValues, tabParam?.options)) {
            const score = scoreArrays(optionValues, tabParam?.options, true)?.score;

            canGroup = (score > 0.5 && tabParam?.total > 1) || !!group?.id;
          }
        }

        if (props.type === "endpointParam" && canGroup) {
          const tabEndpointParam = currentEndpointParams?.[paramName];
          canGroup = tabEndpointParam > 1 || !!group?.id;
        }

        const groupTextColor = getContrastTextColor(group?.color ?? "");
        return { canGroup, group, groupTextColor };
      },
      [
        activeDashboardId,
        paramGroups,
        groupId,
        props.type,
        props?.groupById,
        optionValues,
      ],
    );

    useEffect(() => {
      let unsub = null;
      if (widgetId === "pyth_price_feeds") return;

      unsub = useAppStore.subscribe(
        (s) => {
          const tab =
            s.getTabById(activeDashboardId) || getDashboardById(activeDashboardId);
          return {
            groups: tab?.data?.groups || [],
            currentTabParams: s.currentTabParams,
            currentEndpointParams: s.currentEndpointParams,
          };
        },
        (current) => dispatch(updateGroupState(current)),

        { fireImmediately: true },
      );

      return () => unsub?.();
    }, [updateGroupState]);

    const { canGroup, group, groupTextColor } = state;

    const groupFirstLetter = useMemo(() => {
      const parts = group?.name?.split(" ");
      const secondPart = parts?.[1];
      // If the second part is a number, show the full number; otherwise show the first letter
      if (Number.isNaN(Number(secondPart))) {
        return parts?.[0]?.charAt(0);
      }
      return secondPart;
    }, [group]);

    const groupParamValueDetails = useMemo(() => {
      const { valueLabel, paramLabel } = getGroupInfo(group, paramDef);

      return (
        <div className="mt-1.5 grid gap-0.5">
          <span className="body-xs-medium break-words dark:text-light-100 text-light-900">
            {paramLabel}
          </span>
          <span className="body-xs-regular break-words dark:text-light-300 text-light-600">
            {valueLabel}
          </span>
        </div>
      );
    }, [group, paramDef?.options, paramDef?.paramName, paramDef?.label]);

    const currentGroupTooltip = useMemo(() => {
      if (!group?.name) return "Group widget";

      return (
        <div className="space-y-1">
          <p className="body-xs-regular dark:text-light-100 text-light-900">
            Current group: {group.name}
          </p>
          {groupParamValueDetails}
        </div>
      );
    }, [group?.name, groupParamValueDetails]);

    const triggerOnClick = useCallback(() => {
      if (currentTutorial) {
        if (currentTutorial === "grouping") {
          if (currentStep === 1) {
            setTimeout(() => {
              goToStep(2);
            }, 500);
          } else if (currentStep === 3) {
            setTimeout(() => {
              goToStep(4);
            }, 500);
          }
        }
      }
    }, [currentStep, currentTutorial, goToStep]);

    const groupContentMemo = useMemo(() => <GroupContent {...props} />, [props]);

    const childrenMemo = useMemo(() => children, [children]);

    const [isHoverSynced, setIsHoverSynced] = useState(false);
    const syncParamName = paramDef?.paramName;

    useEventListener(`sqlParamHover-${widgetUuid}`, (detail) => {
      if (!syncParamName) return;
      setIsHoverSynced(detail?.paramName === syncParamName);
    });

    const hoverSyncProps = useMemo(() => {
      if (!(syncParamName && widgetUuid)) return {};
      const onEvent = (paramName: string | null) =>
        triggerCustomEvent(`sqlParamHoverPill-${widgetUuid}`, { paramName });

      return {
        onMouseEnter: () => onEvent(syncParamName),
        onMouseLeave: () => onEvent(null),
      };
    }, [syncParamName, widgetUuid]);

    const hoverSyncClass = isHoverSynced ? "bg-general-bg-secondary!" : "";

    const anchorRef = useRef<HTMLDivElement | null>(null);

    if (!canGroup)
      return (
        childrenMemo && (
          <div
            className={cn(
              className,
              "flex items-center justify-between gap-1 h-[20px]",
              hoverSyncClass,
            )}
            {...hoverSyncProps}
          >
            {childrenMemo}
          </div>
        )
      );

    if (!groupingVisible && group) {
      //TODO: we need to update types because they dont match reality?
      //@ts-expect-error
      let label = group.groupBy ?? group.paramName ?? group.type;
      if (group.type === "ticker" && group?.value?.category === "country") {
        label = "country";
      }
      return (
        <Tooltip
          className="max-w-[265px]"
          message={
            <>
              <p className="body-xs-regular dark:text-light-100 text-light-900">
                This parameter is associated with a group. Changing this will impact the
                group.
              </p>
              <div className="w-fit flex gap-1.5 items-center mt-2 dark:border-dark-400 border border-light-200 rounded p-1">
                <p className="capitalize body-xs-medium dark:text-light-100">{label}</p>
                <span className="inline-flex gap-1 items-center rounded-[2px] dark:bg-dark-500 bg-light-100 py-px px-0.5 body-2xs-regular dark:text-light-300 text-dark-800">
                  <span
                    className="block size-3 rounded-[2px]"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </span>
              </div>
              {groupParamValueDetails}
            </>
          }
          delayDuration={100}
          hoverOnly={true}
          preventOnDropdown={true}
        >
          <div
            className={cn(
              className,
              "flex items-center justify-between gap-1 h-[20px] transition-colors duration-200",
              {
                "hover:border-(--group-color)!": group?.color,
              },
              hoverSyncClass,
            )}
            style={
              {
                "--group-color": group?.color,
              } as CSSProperties
            }
            {...hoverSyncProps}
          >
            {childrenMemo}
          </div>
        </Tooltip>
      );
    }

    return (
      <GroupDropdownAnchorContext.Provider value={anchorRef}>
        <div
          ref={anchorRef}
          className={cn(
            className,
            "flex items-center justify-between gap-1 h-[20px]",
            hoverSyncClass,
          )}
          {...hoverSyncProps}
        >
          <DropdownMenu.Root open={show} onOpenChange={setShow} modal={false}>
            <Tooltip className="max-w-[365px]" message={currentGroupTooltip}>
              <DropdownMenu.Trigger onClick={triggerOnClick} asChild={true}>
                <button className="_group-dropdown-trigger w-full h-full flex items-center justify-center">
                  {group?.name ? (
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-[2px] text-2xs flex justify-center items-center font-bold",
                      )}
                      style={{
                        backgroundColor: group.color,
                        color: groupTextColor,
                      }}
                    >
                      {groupFirstLetter}
                    </span>
                  ) : (
                    <Icon id="group-icon" className="w-3.5 h-3.5" />
                  )}
                </button>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={5}
                onInteractOutside={(e) => {
                  // Keep the dropdown open while interacting with a color picker
                  // popover, which portals outside the dropdown DOM.
                  if ((e.target as HTMLElement)?.closest?.(".BB-Popover")) {
                    e.preventDefault();
                  }
                }}
                style={{
                  boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
                }}
                className={cn(
                  "obb-dropdown-container",
                  "flex flex-col gap-2 p-2",
                  "text-xs",
                  "z-50 min-w-[183px]",
                )}
              >
                {groupContentMemo}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {childrenMemo}
        </div>
      </GroupDropdownAnchorContext.Provider>
    );
  },
);

export default memo(GroupDropdown);

function GroupContent(props: Omit<GroupDropdownProps, "children">) {
  const { type, groupById, paramDef } = props;

  const EXCEPTION_WIDGETS_IDS = useMemo(
    () => getWidgetsWithSupportedAssetClass("all", true),
    [],
  );
  const { widget, activeDashboardId } = useWidgetContext();
  const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
    (state) => ({
      currentTutorial: state.currentTutorial,
      currentStep: state.currentStep,
      goToStep: state.goToStep,
    }),
  );

  const getDashboardById = useShallowSharedAppStore((s) => s.getDashboardById);

  const { addGroup, updateGroup, setWidgetGroupId, groups, watchlistWidget } =
    useShallowAppStore((s) => {
      const tab =
        s.getTabById(activeDashboardId) || getDashboardById(activeDashboardId);
      let watchlistWidget = {} as Widget;
      if (type === "ticker") {
        watchlistWidget = tab?.data?.widgets.find(
          (widget) => widget.widgetId === "watchlist",
        );
      }

      return {
        addGroup: s.addGroup,
        updateGroup: s.updateGroup,
        setWidgetGroupId: s.setWidgetGroupId,
        groups: tab?.data?.groups || [],
        watchlistWidget,
      };
    });

  const validGroups = groups.filter((group) => {
    if (type === "param")
      return group.type === "param" && group.groupById === groupById;

    if (type === "endpointParam")
      return (
        group.type === type &&
        paramDef?.type === "endpoint" &&
        group?.groupById === paramDef?.groupById
      );
    return group.type === type;
  });

  const widgetAssetClasses = useMemo(() => {
    const widgetFromJSON = getJsonWidget(widget);

    return widget?.supportedAssetClasses || widgetFromJSON?.supportedAssetClasses || [];
  }, [widget?.supportedAssetClasses, widget?.widgetId]);

  const validateAssetClass = useCallback(
    (group: Group) => {
      if (group.type === "param") return group.groupById === groupById;

      if (paramDef?.type === "endpoint" && group.type === "endpointParam")
        return [widget?.groupById, paramDef?.groupById].includes(group?.groupById);

      if (group.type !== "ticker") return false;

      const isOptions =
        widgetAssetClasses.includes("options") && group?.value?.has_options;

      if (group.acceptAssetClasses?.includes("all") || isOptions) return true;
      // If the widget is in the list of exception widgets, it can be grouped with any asset class
      if (EXCEPTION_WIDGETS_IDS.includes(widget?.widgetId)) {
        return true;
      }
      // If the widget has no specific asset classes, it's an exception and can be grouped with any
      if (!widgetAssetClasses || widgetAssetClasses.length === 0) {
        return true;
      }

      // If the group has an asset class that is in the widget's supported asset classes, return true

      return [group?.value?.category, "all"].some((type) =>
        widgetAssetClasses.includes(type),
      );
    },
    [widget?.groupById, widget?.widgetId, widgetAssetClasses, groupById, paramDef],
  );
  const debouncedUpdateGroup = useCallback(debounce(updateGroup, 500), [updateGroup]);

  const groupElements = useMemo(
    () =>
      validGroups.map((element) => (
        <GroupContentItem
          key={element.id}
          element={element}
          validateAssetClass={validateAssetClass}
          updateGroup={debouncedUpdateGroup}
          watchlistWidget={watchlistWidget}
        />
      )),
    [validGroups, validateAssetClass, debouncedUpdateGroup, watchlistWidget],
  );

  const onClick = useCallback(() => {
    if (!widget.data?.mainTicker?.symbol && type === "ticker") {
      toast.error("Please select a widget with a ticker to create a group");
      return;
    }

    const newGroup = getNewGroup(widget, groups, widgetAssetClasses, type, groupById);

    addGroup(activeDashboardId, newGroup);
    setWidgetGroupId(activeDashboardId, widget?.id, newGroup);

    if (currentTutorial === "grouping") {
      if (currentStep === 2) {
        setTimeout(() => {
          goToStep(3);
        }, 500);
      }
    }
  }, [widget, groups, widgetAssetClasses, type, groupById]);

  return (
    <div className="flex flex-col gap-2 group-dropdown">
      <GroupPanelHeader onCreate={onClick} />
      <div className="py-1 space-y-3">
        {validGroups.length === 0 ? (
          <p className="text-ds-text-caption text-xs group-dropdown">
            No Active Groups
          </p>
        ) : (
          groupElements
        )}
      </div>
    </div>
  );
}

const GroupContentItem = memo(
  (props: {
    element: Group;
    watchlistWidget?: Widget;
    validateAssetClass: (group: Group) => boolean;
    updateGroup: (tabId: string, groupId: string, group: Group) => void;
  }) => {
    const { element, watchlistWidget, validateAssetClass, updateGroup } = props;

    const {
      widget: {
        external,
        paramGroups,
        groupId,
        id: widgetUUid,
        data: { mainTicker } = {},
      } = {},
      activeDashboardId,
    } = useWidgetContext();
    const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
      (state) => ({
        currentTutorial: state.currentTutorial,
        currentStep: state.currentStep,
        goToStep: state.goToStep,
      }),
    );
    const groupedInfo = useMemo(() => {
      const canGroup = validateAssetClass(element);
      const groupedValue = getGroupLabel(element);

      const selected =
        Object.values(paramGroups || {}).includes(element.id) || groupId === element.id;

      return { canGroup, groupedValue, selected };
    }, [element, validateAssetClass, paramGroups, groupId]);

    const { setWidgetGroupId, deleteGroup } = useShallowAppStore((state) => ({
      setWidgetGroupId: state.setWidgetGroupId,
      deleteGroup: state.deleteGroup,
    }));

    const onCheckboxClick = useCallback(
      (e: ReactMouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();

        // Assuming element.assetClass represents the asset class of the group
        // and widgetAssetClasses represents the asset classes of the widget

        const { canGroup, selected } = groupedInfo;

        if (!canGroup && external) {
          toast.error("Widget from a different asset class", {
            description:
              "Widgets can only be grouped together if they share the same endpoint parameters.",
          });
          return;
        }

        if (!canGroup) {
          toast.error("Widget from a different asset class", {
            description: `Widgets can only be grouped together if they belong to the same asset class,
              with the exception of News, Price Performance, and Watchlist`,
          });
          return;
        }

        if (currentTutorial === "grouping") {
          if (currentStep === 4) {
            setTimeout(() => {
              goToStep(5);
            }, 500);
          }
        }

        // For the single widget, check if it's already in the group
        if (selected) {
          // If it is, remove it from the group
          return setWidgetGroupId(activeDashboardId, widgetUUid, element, true);
        }

        if (watchlistWidget?.groupId === element.id) {
          addTickerToWatchlist({
            watchlistWidget,
            mainTicker: mainTicker,
            tabId: activeDashboardId,
          });
        }
        // If it's not, add it to the group
        setWidgetGroupId(activeDashboardId, widgetUUid, element);
      },
      [
        groupedInfo,
        currentStep,
        currentTutorial,
        deleteGroup,
        element,
        updateGroup,
        watchlistWidget,
        mainTicker,
        external,
        widgetUUid,
        activeDashboardId,
      ],
    );

    const onDeleteGroupClick = useCallback(() => {
      const widgetsInGroup = useAppStore
        .getState()
        .getTabById(activeDashboardId)
        ?.data?.widgets.filter(
          (w) =>
            w.groupId === element.id ||
            Object.values(w.paramGroups || {}).includes(element.id),
        );

      if (widgetsInGroup?.length > 0) {
        // If there are, show a warning message
        return showNotificationWithRememberMe({
          id: NotificationId.GroupNotEmpty,
          message: "Group not empty",
          description:
            "There are one or more widgets associated with this group. By deleting this group all widgets within this group will become unlinked. Do you wish to proceed?",
          toastType: "error",
          cancel: {
            label: "Cancel",
            onClick: () => {},
          },
          action: {
            label: "Yes, delete",
            onClick: () => deleteGroup(activeDashboardId, element.id),
          },
        });
      }

      // If there are no widgets in the group, delete the group
      deleteGroup(activeDashboardId, element.id);
    }, [activeDashboardId, deleteGroup, element.id]);

    const onColorChange = useCallback(
      (newColor: string) => {
        updateGroup(activeDashboardId, element.id, {
          ...element,
          color: newColor,
        });
      },
      [element, activeDashboardId, updateGroup],
    );

    const content = useMemo(
      () => (
        <GroupRow
          name={element.name}
          color={element.color}
          valueLabel={groupedInfo?.groupedValue}
          valueTooltip={groupedInfo?.groupedValue}
          selectable={true}
          selected={groupedInfo?.selected}
          onToggleSelect={onCheckboxClick}
          onColorChange={onColorChange}
          onDelete={onDeleteGroupClick}
          disabled={!groupedInfo?.canGroup}
        />
      ),
      [
        element.name,
        element.color,
        groupedInfo?.groupedValue,
        groupedInfo?.selected,
        groupedInfo?.canGroup,
        onCheckboxClick,
        onColorChange,
        onDeleteGroupClick,
      ],
    );

    return groupedInfo?.canGroup ? (
      <Fragment key={element.id}>{content}</Fragment>
    ) : (
      <Tooltip key={element.id} message="Group from different asset class">
        <div>{content}</div>
      </Tooltip>
    );
  },
);

function addTickerToWatchlist(params: {
  watchlistWidget?: Widget;
  mainTicker?: Ticker;
  tabId: string;
}) {
  const { watchlistWidget, mainTicker, tabId } = params;
  if (
    mainTicker &&
    !watchlistWidget.data?.secondaryTickers?.find(
      (ticker) => ticker.symbol === mainTicker.symbol,
    )
  ) {
    useAppStore.getState().updateWidget(tabId, {
      ...watchlistWidget,
      data: {
        ...watchlistWidget.data,
        secondaryTickers: [...watchlistWidget.data.secondaryTickers, mainTicker],
      },
    });
  }
}

export function getNewGroup(
  widget: Widget,
  groups: Group[],
  widgetAssetClasses?: string[],
  type?: GroupTypes,
  groupById?: string,
): Group {
  const baseGroupName = "Group ";
  let newGroupName = baseGroupName + (groups.length + 1);
  let groupNameSuffix = groups.length;

  // Ensure the group name is unique
  while (groups.some((group) => group.name === newGroupName)) {
    groupNameSuffix++;
    newGroupName = baseGroupName + groupNameSuffix;
  }

  // Get color palette from theme store or fall back to COLORS
  const currentTheme = useThemeStore.getState().theme;
  const themeStore = useTableChartThemesStore.getState();
  const palette = themeStore[currentTheme]?.appTheme?.grouping?.palette || COLORS;

  // Select a unique color for the new group
  const existingColors = groups.map((group) => group.color);
  let color: string;

  // Directly select a random color if all palette colors are already used
  if (existingColors.length >= palette.length) {
    color = palette[Math.floor(Math.random() * palette.length)];
  } else {
    // Attempt to find a unique color
    const availableColors = palette.filter((c) => !existingColors.includes(c));
    if (availableColors.length > 0) {
      color = availableColors[0]; // Take the first available unique color
    } else {
      // Fallback to a random color if the filter fails for any reason
      color = palette[Math.floor(Math.random() * palette.length)];
    }
  }
  const newGroup = { id: uuidv4(), name: newGroupName, color };

  if (type === "param") {
    return {
      ...newGroup,
      type: "param",
      groupById,
      value: widget?.storage?.params?.[groupById] ?? null,
    } as Group;
  }

  if (type === "endpointParam") {
    const paramName = getEndpointParamName(getEndpointParams(widget), groupById);

    if (paramName) {
      return {
        ...newGroup,
        type: "endpointParam",
        groupById,
        value: widget?.storage?.params?.[paramName] ?? null,
      } as Group;
    }
  }

  return {
    ...newGroup,
    type: "ticker",
    value: widget.data?.mainTicker,
    acceptAssetClasses: widgetAssetClasses,
  } as Group;
}
