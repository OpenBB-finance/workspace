import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import cloneDeep from "lodash/cloneDeep";
import { usePostHog } from "posthog-js/react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import useIsMobile from "~/hooks/useIsMobile";
import {
  type Extension,
  inSnowflakeNativeApp,
  validImageExtension,
} from "~/lib/constants";
import { useAppStore } from "~/lib/state/app";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, dispatchSaveState } from "~/lib/utils";
import type { ExtraActionT } from "./DraggableCard/NavBar";
import FeatureLock from "./General/FeatureLock";
import {
  useChartBarFillQuickAction,
  useChartQuickActions,
} from "./General/Table/Chart/hooks/useChartOptions";
import Icon from "./Icon";
import { MoveToTabsDropdownMenu } from "./MoveToDropDown";
import type { EllipsisDropdownMenuProps } from "./MoveToDropDown/types";
import { getExportFns } from "./MoveToDropDown/utils";
import Tooltip from "./Tooltip";
import type { WidgetT } from "./types";
import { useWidgetContext } from "./Widget.context";

const excelAddInEnabled = import.meta.env.VITE_EXCEL_ADD_IN_ENABLED === "true";

function getExtensionFromWidget(widget: WidgetT): Extension | undefined {
  if (widget?.connectionType !== "file") return undefined;
  const extension = widget?.endpoint?.url?.split(".")?.pop()?.toLowerCase();
  return validImageExtension(extension) ? extension : undefined;
}

export default function EllipsisDropdownMenu(props: EllipsisDropdownMenuProps) {
  const { dispatch, settings, exportFns, isMinimized, onMinimizeToggle } = props;

  const chartBarFilledAction = useChartBarFillQuickAction();
  const chartQuickActions = useChartQuickActions();

  const extraSettings = useMemo<ExtraActionT[]>(() => {
    const extraSettings = props.extraSettings || [];
    const quickActions = [chartBarFilledAction, ...chartQuickActions].filter(Boolean);
    if (quickActions.length === 0) return extraSettings;

    const quickActionsIndex = extraSettings.findIndex(
      (item) => item.id === "quick-actions",
    );
    if (quickActionsIndex !== -1) {
      const settings = cloneDeep(extraSettings || []);
      settings[quickActionsIndex].children.push(...quickActions);
      return settings;
    }

    return [
      {
        icon: "columns-03",
        id: "quick-actions",
        label: "Quick actions",
        children: quickActions,
      },
      ...extraSettings,
    ];
  }, [props.extraSettings, chartBarFilledAction, chartQuickActions]);

  const posthog = usePostHog();
  const { widgetRef, widgetFromJSON, activeDashboardId, isShared, isPreview } =
    useWidgetContext();
  const setExportWidgetData = useShallowThemeStore(
    (state) => state.setExportWidgetData,
  );
  const isMobile = useIsMobile();
  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );

  const exportFunctions = useMemo(() => {
    return getExportFns(
      exportFns,
      widgetRef?.current?.type,
      getExtensionFromWidget(widgetRef?.current),
    );
  }, [exportFns, widgetRef, widgetRef?.current?.type]);

  const duplicateWidgetCallback = useCallback(async () => {
    await dispatchSaveState();
    const widget = useAppStore
      .getState()
      .getTabWidgetById(activeDashboardId, widgetRef.current?.id);
    if (!widget) return toast.error("Widget not found");

    useAppStore.getState().duplicateWidget(activeDashboardId, widget);
    setTimeout(() => {
      const element =
        document.getElementsByClassName("react-grid-layout")?.[0].lastElementChild;
      element?.scrollIntoView();
    }, 500);
  }, [activeDashboardId]);

  const copyToClipboardCallback = useCallback(() => {
    const widget = widgetRef.current;
    if (widget?.storage?.rowsData && widget?.storage?.columns) {
      const headers = widget.storage.columns.join("\t");
      const rows = widget.storage.rowsData
        .map((row) => widget.storage.columns.map((col) => row[col]).join("\t"))
        .join("\n");
      const content = `${headers}\n${rows}`;

      navigator.clipboard
        .writeText(content)
        .then(() => {
          toast.success("Widget data copied to clipboard");
        })
        .catch((err) => {
          toast.error("Failed to copy widget data to clipboard", {
            description: err.message,
          });
        });
    } else {
      toast.error("No data available to copy");
    }
  }, [widgetRef.current?.storage?.rowsData, widgetRef.current?.storage?.columns]);

  const defaultItems = useMemo(() => {
    const regularItems = [];
    const proTierItems = [];
    const widget = widgetRef.current;

    if (settings?.showMetadata) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-metadata`}
          className="obb-dropdown-item"
          onSelect={() => {
            dispatch({ metadataModal: true });
          }}
        >
          <Icon id="metadata-icon" key={`${widget?.id}-metadata-icon`} />
          Metadata
        </DropdownMenuPrimitive.Item>,
      );
    }
    if (settings?.showSettings) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-settings`}
          className="obb-dropdown-item"
          onSelect={() => {
            dispatch({ settingsModal: true });
          }}
        >
          <Icon id="cog-icon" key={`${widget?.id}-settings-icon`} />
          Settings
        </DropdownMenuPrimitive.Item>,
      );
    }
    // Only show Parameters for widgets that are NOT from OpenBB sandbox
    // OpenBB sandbox widgets have external === false (or undefined)
    // User-created backend widgets have external === true
    const isOpenBBSandbox = !widget?.external;

    if (!inSnowflakeNativeApp && widget?.params?.length > 0 && !isOpenBBSandbox) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-parameters`}
          className="obb-dropdown-item"
          onSelect={() => {
            dispatch({ parametersModal: true });
          }}
        >
          <Icon id="filters-icon" key={`${widget?.id}-parameters-icon`} />
          Parameters
        </DropdownMenuPrimitive.Item>,
      );
    }
    if (settings?.showDuplicate) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-duplicate`}
          className={cn("obb-dropdown-item", {
            "opacity-30": isShared,
          })}
          onSelect={() => duplicateWidgetCallback()}
          disabled={isShared}
        >
          <Icon id="duplicate-icon" />
          Duplicate
        </DropdownMenuPrimitive.Item>,
      );
    }
    if (settings?.showMove && widget?.widgetId !== "ag_chart_from_table") {
      regularItems.push(<MoveToTabsDropdownMenu key={`${widget?.id}-move`} />);
    }
    if (settings?.showMinimize && onMinimizeToggle) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-minimize`}
          className={cn("obb-dropdown-item", {
            "opacity-30": isShared,
          })}
          onSelect={onMinimizeToggle}
          disabled={isShared}
        >
          <Icon id={isMinimized ? "expand-03" : "minimize-03"} />
          {isMinimized ? "Expand" : "Minimize"}
        </DropdownMenuPrimitive.Item>,
      );
    }
    if (settings?.showCopyToClipboard) {
      regularItems.push(
        <DropdownMenuPrimitive.Item
          key={`${widget?.id}-copy-to-clipbard`}
          className="obb-dropdown-item"
          onSelect={() => copyToClipboardCallback()}
        >
          <Icon id="file-shared" />
          Copy to Clipboard
        </DropdownMenuPrimitive.Item>,
      );
    }

    // Pro tier items
    if (
      !inSnowflakeNativeApp &&
      excelAddInEnabled &&
      settings?.showFunctions &&
      widget?.storage?.chartView &&
      widget?.connectionType === "advanced-backend"
    ) {
      proTierItems.push(
        <FeatureLock isLocked={!isProTier} key={`${widget?.id}-excel-lock`}>
          <DropdownMenuPrimitive.Item
            key={`${widget?.id}-functions`}
            className="obb-dropdown-item"
            onSelect={() => {
              if (posthog) {
                posthog.capture("opened_functions_menu", {
                  widget_name: widget.widgetId,
                });
              }
              dispatch({ functionsModal: true });
            }}
          >
            <Icon id="excel-file" key={`${widget?.id}-functions-icon`} />
            Excel formula
          </DropdownMenuPrimitive.Item>
        </FeatureLock>,
      );
    }
    if (settings?.showExport) {
      const isExportable = (widgetFromJSON?.exportable ?? widget?.exportable) !== false;
      proTierItems.push(
        <FeatureLock isLocked={!isProTier} key={`${widget?.id}-export-lock`}>
          <DropdownMenuPrimitive.Item
            key={`export-${widget?.id}`}
            className={cn("obb-dropdown-item", {
              "opacity-30": !isExportable,
            })}
            disabled={!isExportable}
            onSelect={() => {
              setExportWidgetData({
                possibleExportFormats: exportFns ? exportFunctions : [],
                widgetId: widget.id,
                widgetName: widget.name,
                selectedExportFormat: exportFns ? exportFunctions[0].value : "",
              });
            }}
          >
            <Icon id="download-icon" key={`export-${widget?.id}-icon`} />
            Export
          </DropdownMenuPrimitive.Item>
        </FeatureLock>,
      );
    }

    return { regularItems, proTierItems };
  }, [
    settings,
    widgetRef,
    isShared,
    exportFunctions,
    exportFns,
    setExportWidgetData,
    dispatch,
    duplicateWidgetCallback,
    copyToClipboardCallback,
    isProTier,
    isMinimized,
    onMinimizeToggle,
  ]);

  const dropDownItems = useMemo(() => {
    const { regularItems, proTierItems } = defaultItems;
    const widget = widgetRef.current;

    // Process extra settings
    const extras = extraSettings
      .filter((item) => {
        if (item.hide) return false;
        if (item.showId && !settings?.[item.showId]) return false;
        return true;
      })
      .map((item, index) => {
        const childKey = `${widget?.id}-${item.id}`;

        if (item.children) {
          return (
            <DropdownMenuPrimitive.Sub key={childKey}>
              <DropdownMenuPrimitive.SubTrigger
                className="obb-dropdown-item"
                key={`${childKey}-sub-trigger`}
              >
                <Icon id={item.icon} key={`${childKey}-${item.icon}`} />
                {item.label}
                <Icon
                  id="chevron-right"
                  className="ml-auto w-[12px] h-[18px]"
                  key={`${childKey}-chevron`}
                />
              </DropdownMenuPrimitive.SubTrigger>
              <DropdownMenuPrimitive.SubContent
                key={`${childKey}-content`}
                className="obb-dropdown-container z-50 w-[172px]"
              >
                {item.children
                  .filter((child) => !child.hide)
                  .map((child) => {
                    const element = (
                      <DropdownMenuPrimitive.Item
                        key={`${childKey}-${child.id}`}
                        className={cn({
                          "obb-dropdown-item": !child.disabled,
                          "obb-dropdown-item-noclick opacity-30 select-none":
                            child.disabled,
                        })}
                        onSelect={child.onClick}
                        disabled={child.disabled}
                      >
                        <Icon
                          id={child.icon}
                          key={`${childKey}-${child.id}-${child.icon}`}
                        />
                        {child.label}
                      </DropdownMenuPrimitive.Item>
                    );

                    if (child.tooltipMessage) {
                      return (
                        <Tooltip
                          key={`${childKey}-${child.id}-tooltip`}
                          className="max-w-[180px] whitespace-pre-wrap break-words"
                          message={child.tooltipMessage}
                          position="right"
                        >
                          {element}
                        </Tooltip>
                      );
                    }
                    return element;
                  })}
              </DropdownMenuPrimitive.SubContent>
            </DropdownMenuPrimitive.Sub>
          );
        }
        return (
          <DropdownMenuPrimitive.Item
            key={`${childKey}-${index}`}
            className="obb-dropdown-item"
            onSelect={() => {
              item.onClick();
            }}
          >
            <Icon id={item.icon} key={`${childKey}-${item.icon}`} />
            {item.label}
          </DropdownMenuPrimitive.Item>
        );
      });

    // Combine all items in the desired order: regular items -> extras -> pro tier items
    return [...regularItems, ...extras, ...proTierItems];
  }, [defaultItems, settings, extraSettings, widgetRef]);

  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <Tooltip
        message={isPreview ? "Options are not available in preview mode" : "Options"}
        hide={isMobile}
      >
        <DropdownMenuPrimitive.Trigger
          className={cn("obb-small-navbar-btn", {
            "opacity-30": isPreview,
          })}
          disabled={isPreview}
        >
          <Icon id="list-unordered" />
        </DropdownMenuPrimitive.Trigger>
      </Tooltip>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          onCloseAutoFocus={(e) => e.preventDefault()}
          align="end"
          sideOffset={5}
          className="obb-dropdown-container z-50 w-[172px]"
        >
          {dropDownItems}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
