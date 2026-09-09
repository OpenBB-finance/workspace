import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { fetchAgentsData } from "~/api/auth.api";
import useIsMobile from "~/hooks/useIsMobile";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import {
  type Copilot,
  type CopilotWidget,
  type HierarchicalMention,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { cn } from "~/lib/utils";
import { showNotification } from "~/lib/utils/toast";
import { HintLabel } from "../ds/atoms/HintLabel";
import { Input } from "../ds/atoms/Input";
import { Popover, PopoverTrigger } from "../ds/atoms/Popover";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "../ds/atoms/Select";
import { Switch } from "../ds/atoms/Switch";
import SnowflakeHide from "../General/SnowflakeHide";
import { someTruthy } from "../General/Table/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { useCopilotContextSuggestions } from "./hooks/useCopilotAddToContext";
import { useGetCopilotRequestHeaders } from "./hooks/useGetCopilotRequestHeaders";
import { McpToolsButton } from "./McpToolsButton";
import { SemanticViewsButton } from "./SemanticViewsDropdown";

export function CopilotContext() {
  const isMobile = useIsMobile();

  // MCP Tools state
  const {
    contextEnabled,
    selectedCopilot,
    setSelectedCopilot,
    initializeCustomFeatures,
    enableSettings,
  } = useShallowCopilotStore((s) => {
    const featureFlags = s.selectedCopilot?.features || {};
    const widgetDashboardSelectFF = Boolean(featureFlags?.["widget-dashboard-select"]);
    const customEntries = Object.entries(featureFlags || {}).filter(
      ([, val]) => typeof val === "object" && val !== null,
    ) as [string, FeatureMeta][];
    const widgetGlobalSearchFF = Boolean(featureFlags?.["widget-global-search"]);
    const generativeUiFF = Boolean(featureFlags?.["generative-ui"]);
    return {
      contextEnabled: widgetDashboardSelectFF,
      selectedCopilot: s.selectedCopilot,
      setSelectedCopilot: s.setSelectedCopilot,
      initializeCustomFeatures: s.initializeCustomFeatures,
      enableSettings: someTruthy(widgetGlobalSearchFF, generativeUiFF, customEntries),
    };
  });

  // @ Dropdown state
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Settings dropdown state
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const {
    searchSuggestions,
    getRichWidgetTooltip,
    handleKeyDown,
    suggestionElements,
    handleRemoveMentionFromText,
  } = useCopilotContextSuggestions({
    inputRef,
    suggestionsRef,
    setIsDropdownOpen: setPopoverOpen,
  });

  const getCopilotRequestHeaders = useGetCopilotRequestHeaders();

  // Ensure custom features default state is initialized globally (not only when settings open)

  useEffect(() => {
    initializeCustomFeatures?.(selectedCopilot?.features || {});
  }, [selectedCopilot?.features]);

  // Merge backend custom features from agents.json into default copilot (global)
  useEffect(() => {
    const ctrl = new AbortController();

    async function hydrateDefaultAgentFeatures() {
      const headers = getCopilotRequestHeaders();
      try {
        const apiUrl = getConfig().urls.ai as string;
        const data = await fetchAgentsData({ url: apiUrl, headers }, ctrl.signal);
        const ada = data.find((agent) => agent.id === "openbb_ada");
        if (!ada) return;
        ada.id = "openbb-copilot"; // Ensure id matches default copilot id

        if (inSnowflakeNativeApp) {
          const { "workspace-web-search": _, ...rest } = ada.features || {};
          ada.features = rest;
        }
        setSelectedCopilot?.({ ...selectedCopilot, ...ada });
      } catch (_) {
        // ignore
      }
    }

    // openbb-copilot is the only copilot without a holderUuid
    if (!selectedCopilot?.holderUuid) hydrateDefaultAgentFeatures();

    return () => ctrl.abort();
  }, [selectedCopilot?.holderUuid]);

  const handleOnButtonClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setPopoverOpen((prev) => {
        const isDropdownOpen = !prev;
        if (isDropdownOpen) {
          searchSuggestions(""); // Clear search on open
        }

        return isDropdownOpen;
      });
    },
    [searchSuggestions],
  );

  const handleSettingsButtonClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setSettingsPopoverOpen((prev) => !prev);
    },
    [],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      const searchQuery = value.trim();
      searchSuggestions(searchQuery);
    },
    [searchSuggestions],
  );

  const handleOnOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        searchSuggestions(null); // Clear search suggestions
        if (inputRef.current) inputRef.current.value = "";
      }
      setPopoverOpen(isOpen);
    },
    [inputRef, searchSuggestions],
  );

  return (
    <div className="flex flex-wrap gap-2 items-start text-xs w-full">
      <div className="flex flex-wrap gap-2 text-xs w-full items-center">
        <SnowflakeHide>
          <Popover
            open={settingsPopoverOpen}
            onOpenChange={setSettingsPopoverOpen}
            side="top"
            align="start"
            id="copilot-settings-dropdown"
            className="w-80 z-50 overflow-hidden text-xs flex flex-col p-2.5"
            content={<SettingsContent />}
          >
            <PopoverTrigger asChild={true}>
              <Tooltip
                message={
                  enableSettings ? "Settings" : "No settings available for this copilot"
                }
              >
                <button
                  aria-label="Copilot settings"
                  ref={(el) => (settingsButtonRef.current = el)}
                  onClick={enableSettings ? handleSettingsButtonClick : undefined}
                  disabled={!enableSettings}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                    {
                      "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                        !settingsPopoverOpen,
                      "opacity-25 cursor-default": !enableSettings,
                    },
                  )}
                >
                  <Icon id="settings-01" className="w-4 h-4" />
                </button>
              </Tooltip>
            </PopoverTrigger>
          </Popover>
          <div className="h-8 w-px bg-surface-divider" />

          <McpToolsButton />
        </SnowflakeHide>

        {inSnowflakeNativeApp && (
          <>
            <SemanticViewsButton />
            <div className="h-8 w-px bg-surface-divider" />
          </>
        )}

        <Popover
          open={popoverOpen}
          onOpenChange={handleOnOpenChange}
          side="top"
          align="start"
          id="copilot-context-dropdown"
          className="flex! flex-col! p-2.5 sm:min-w-[400px]! max-w-[28rem]! only-sm:max-w-[calc(100vw-2rem)]! only-sm:max-h-[60vh]!"
          content={
            <>
              <div className="pb-2.5 border-b border-surface-divider flex-shrink-0">
                <Input
                  ref={inputRef}
                  type="text"
                  prefix={<Icon id="search" />}
                  defaultValue=""
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search widgets or tabs"
                />
              </div>
              <div className="flex-1 min-h-0">{suggestionElements}</div>
            </>
          }
        >
          <PopoverTrigger asChild={true}>
            <Tooltip
              message={
                contextEnabled
                  ? "Add widgets or tabs to context"
                  : "Searching across all widgets is not enabled for this copilot."
              }
              hide={isMobile}
            >
              <button
                ref={(el) => (buttonRef.current = el)}
                onClick={handleOnButtonClick}
                disabled={!contextEnabled}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                  {
                    "opacity-25 cursor-default": !contextEnabled,
                    "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                      !popoverOpen && contextEnabled,
                  },
                )}
              >
                <span className="text-base font-medium leading-none flex items-center justify-center -translate-y-px">
                  @
                </span>
              </button>
            </Tooltip>
          </PopoverTrigger>
        </Popover>

        <SelectedWidgetBadges
          handleRemoveMentionFromText={handleRemoveMentionFromText}
          getRichWidgetTooltip={getRichWidgetTooltip}
        />
      </div>
    </div>
  );
}

const SelectedWidgetBadges = memo(
  ({
    handleRemoveMentionFromText,
    getRichWidgetTooltip,
  }: {
    handleRemoveMentionFromText: (uuid: string) => void;
    getRichWidgetTooltip: (
      data: CopilotWidget | HierarchicalMention,
      withTooltip?: boolean,
    ) => string | ReactNode;
  }) => {
    const isMobile = useIsMobile();
    const { id: currentDashboardId } = useParams();

    const copilot = useShallowCopilotDataStore((state) => ({
      selectedWidgets: state.copilotWidgets.selectedWidgets,
      toggleSelectedWidget: state.toggleSelectedWidget,
      extraWidgetsEnabled: state.extraWidgetsEnabled,
      isMentionTrackedWidget: state.isMentionTrackedWidget,
      getCopilotWidgets: state.getCopilotWidgets,
      removeMentionTrackedWidget: state.removeMentionTrackedWidget,
      isWidgetSelected: state.isWidgetSelected,
      setCopilotWidgets: state.setCopilotWidgets,
      removeDataFromDashboardWidget: state.removeDataFromDashboardWidget,
      removePreSelectedWidget: state.removePreSelectedWidget,
    }));

    // Get the tab highlighting function to highlight tabs on hover
    const { setHovered, setHoveredTabId, hoveredTabId } = useShallowCopilotStore(
      (state) => ({
        setHovered: state.setHovered,
        setHoveredTabId: state.setHoveredTabId,
        hoveredTabId: state.hoveredTabId,
      }),
    );

    const { contextEnabled, widgetDashboardSearchFF, widgetGlobalSearchFF } =
      useShallowCopilotStore((s) => {
        const featureFlags = s.selectedCopilot?.features || {};
        return {
          contextEnabled: Boolean(featureFlags?.["widget-dashboard-select"]),
          widgetDashboardSearchFF: Boolean(featureFlags?.["widget-dashboard-search"]),
          widgetGlobalSearchFF: Boolean(featureFlags?.["widget-global-search"]),
        };
      });

    const elementsMemo = useMemo(
      () =>
        copilot.selectedWidgets
          .map((widget) => {
            if (!widget) return null;
            const widgetTooltipElement = getRichWidgetTooltip(widget) as any;
            const tooltipMessage = widgetTooltipElement?.props?.message;
            const tooltipDisplay = widgetTooltipElement?.props?.children;

            const isMentionTracked = widget.uuid
              ? copilot.isMentionTrackedWidget(widget.uuid)
              : false;

            return (
              <Tooltip
                id={`widget-badge-tooltip-${widget.uuid || widget.widget_id}`}
                key={`widget-badge-${widget.uuid || widget.widget_id}`}
                message={tooltipMessage ?? widget.name}
                position="top"
                hide={isMobile}
              >
                <div
                  className={cn(
                    "flex shrink-0 px-1.5 py-[3px] rounded dark:text-light-50 text-light-800",
                    "border items-center justify-center gap-1 min-w-fit transition-colors duration-200",
                    "dark:bg-dark-500 bg-light-50 dark:border-dark-400 border-light-300",
                    {
                      "opacity-25": !contextEnabled,
                      // Mention-tracked widgets get blue background
                      "!text-light-500 !dark:text-light-400": isMentionTracked,
                    },
                  )}
                  onMouseEnter={() => {
                    const hoveredUpdate = { tabId: null, widgetUuid: null };

                    // Handle different highlighting for tabs vs widgets in context
                    if (widget.widget_id?.startsWith("tab_")) {
                      hoveredUpdate.tabId = widget.metadata?.innerTabId;
                    } else if (widget.uuid) {
                      hoveredUpdate.widgetUuid = widget.uuid;
                    }
                    setHovered(hoveredUpdate);
                  }}
                  onMouseLeave={() => setHovered()}
                >
                  {tooltipDisplay}
                  <Tooltip
                    message={
                      widget.widget_id?.startsWith("tab_")
                        ? "Remove tab from context"
                        : "Remove widget from context"
                    }
                    hide={isMobile}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!widget.uuid) return;

                        // Clear any active highlights when the widget is removed
                        setHovered();

                        const isMentionTracked = copilot.isMentionTrackedWidget(
                          widget.uuid,
                        );
                        if (isMentionTracked) {
                          handleRemoveMentionFromText(widget.uuid);
                          copilot.removeMentionTrackedWidget(widget.uuid);
                        }

                        if (widget.widget_id?.startsWith("tab_")) {
                          const tabId = widget.metadata?.innerTabId;
                          if (hoveredTabId === tabId) {
                            setHoveredTabId(null);
                          }

                          const currentWidgets = copilot.getCopilotWidgets();
                          copilot.setCopilotWidgets({
                            selectedWidgets: currentWidgets.selectedWidgets.filter(
                              (w) => w.uuid !== widget.uuid,
                            ),
                          });

                          if (copilot.isWidgetSelected(widget.uuid)) {
                            copilot.toggleSelectedWidget(widget.uuid);
                          }

                          copilot.removeDataFromDashboardWidget(widget.uuid);

                          // Remove from pre-selected tracking since it was removed via CopilotContext
                          copilot.removePreSelectedWidget(widget.uuid);
                        } else {
                          // Ensure widget highlight is cleared for non-tab widgets
                          copilot.toggleSelectedWidget(widget.uuid);

                          // Remove from pre-selected tracking since it was removed via CopilotContext
                          copilot.removePreSelectedWidget(widget.uuid);
                        }
                      }}
                      disabled={!contextEnabled}
                    >
                      <Icon id="circled-cross-icon" className="h-4 w-4 -mb-0.5" />
                    </button>
                  </Tooltip>
                </div>
              </Tooltip>
            );
          })
          .filter(Boolean),
      [
        contextEnabled,
        copilot,
        getRichWidgetTooltip,
        handleRemoveMentionFromText,
        setHovered,
        setHoveredTabId,
        hoveredTabId,
        isMobile,
      ],
    );

    return elementsMemo && elementsMemo.length > 0 ? (
      elementsMemo
    ) : (
      <span
        className={cn(
          "truncate py-[3px] dark:text-light-400 text-light-700 overflow-hidden text-ellipsis",
          { "opacity-25": !contextEnabled },
        )}
      >
        {contextEnabled
          ? currentDashboardId
            ? copilot.extraWidgetsEnabled && widgetGlobalSearchFF
              ? "Using all widgets available"
              : widgetDashboardSearchFF
                ? "Using dashboard widgets"
                : "Add widgets to context"
            : "Widget context is available on dashboards only"
          : "Context not available for this copilot"}
      </span>
    );
  },
);

function SettingsContent() {
  const copilot = useShallowCopilotStore((state) => ({
    customFeatureStates: state.customFeatureStates,
    toggleCustomFeature: state.toggleCustomFeature,
    setCustomFeatureValue: state.setCustomFeatureValue,
  }));

  const { customEntries, widgetGlobalSearchFF, generativeUiFF } =
    useShallowCopilotStore((s) => {
      const featureFlags = s.selectedCopilot?.features || {};
      const customEntries = Object.entries(featureFlags || {}).filter(
        ([, val]) => typeof val === "object" && val !== null,
      ) as [string, FeatureMeta][];
      const widgetGlobalSearchFF = Boolean(featureFlags?.["widget-global-search"]);
      const generativeUiFF = Boolean(featureFlags?.["generative-ui"]);
      return {
        widgetGlobalSearchFF,
        generativeUiFF,
        customEntries,
      };
    });

  const handleToggleCustomFeature = useCallback(
    (key: string, label: string) => {
      const newState = copilot.toggleCustomFeature?.(key);
      const enabled = Boolean(newState);
      showNotification({
        id: `copilot-feature-toggle-${key}`,
        message: enabled ? `${label} Enabled` : `${label} Disabled`,
        description: enabled
          ? `The copilot can now use ${label.toLowerCase()}.`
          : `The copilot will no longer use ${label.toLowerCase()}.`,
        toastType: "info",
      });
    },
    [copilot.toggleCustomFeature],
  );

  const handleSetCustomFeatureValue = useCallback(
    (key: string, label: string, value: string) => {
      copilot.setCustomFeatureValue?.(key, value);
      showNotification({
        id: `copilot-feature-set-${key}`,
        message: `${label} updated`,
        toastType: "info",
      });
    },
    [copilot.setCustomFeatureValue],
  );

  return (
    <>
      {(widgetGlobalSearchFF || generativeUiFF) && <BuiltInFeatureToggles />}

      {customEntries.length > 0 && (
        <>
          {(widgetGlobalSearchFF || generativeUiFF) && (
            <div className="mx-3 my-1 border-t border-light-200 dark:border-dark-500" />
          )}
          {customEntries.map(([key, val]) => {
            if (typeof val !== "object" || val === null) return null;
            const featureType = val.type || "toggle";

            if (featureType === "text") {
              return (
                <CustomFeatureText
                  key={`custom-feature-text-${key}`}
                  featureKey={key}
                  meta={val}
                  value={String(copilot.customFeatureStates?.[key] ?? "")}
                  onChange={handleSetCustomFeatureValue}
                />
              );
            }

            if (featureType === "select" && val.options?.length) {
              return (
                <CustomFeatureSelect
                  key={`custom-feature-select-${key}`}
                  featureKey={key}
                  meta={val}
                  value={String(copilot.customFeatureStates?.[key] ?? "")}
                  onChange={handleSetCustomFeatureValue}
                />
              );
            }

            const enabled = Boolean(copilot.customFeatureStates?.[key]);
            return (
              <CustomFeatureToggle
                key={`custom-feature-toggle-${key}`}
                featureKey={key}
                meta={val}
                enabled={enabled}
                onToggle={handleToggleCustomFeature}
              />
            );
          })}
        </>
      )}
    </>
  );
}

type FeatureMeta = Exclude<Copilot["features"][string], boolean | undefined>;

type CustomFeatureToggleProps = {
  featureKey: string;
  meta?: FeatureMeta;
  enabled: boolean;
  onToggle: (key: string, label: string) => void;
};

const CustomFeatureToggle = memo((props: CustomFeatureToggleProps) => {
  const { featureKey, meta, enabled, onToggle } = props;

  return (
    <div className="px-3 py-2 group" key={featureKey}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HintLabel
            tooltip={meta?.description || `Toggle ${meta?.label || featureKey}`}
            tooltipPosition="top"
            tooltipAlign="start"
            tooltipSideOffset={2}
          >
            {meta?.label || featureKey}
          </HintLabel>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={() => onToggle(featureKey, meta?.label || featureKey)}
          aria-label={`Toggle ${meta?.label || featureKey}`}
        />
      </div>
    </div>
  );
});

type CustomFeatureTextProps = {
  featureKey: string;
  meta?: FeatureMeta;
  value: string;
  onChange: (key: string, label: string, value: string) => void;
};

const CustomFeatureText = memo((props: CustomFeatureTextProps) => {
  const { featureKey, meta, value, onChange } = props;
  const [localValue, setLocalValue] = useState(value);
  const label = meta?.label || featureKey;

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(featureKey, label, localValue);
    }
  }, [featureKey, label, localValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onChange(featureKey, label, localValue);
      }
    },
    [featureKey, label, localValue, onChange],
  );

  return (
    <div className="px-3 py-2 group" key={featureKey}>
      <div className="flex items-center justify-between gap-2">
        <HintLabel
          tooltip={meta?.description || label}
          tooltipPosition="top"
          tooltipAlign="start"
          tooltipSideOffset={2}
          className="shrink-0 max-w-[40%] block truncate"
        >
          {label}
        </HintLabel>
        <Input
          type="text"
          value={localValue}
          onChange={setLocalValue}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={meta?.placeholder || ""}
          className="text-xs min-w-0 flex-1"
        />
      </div>
    </div>
  );
});

type CustomFeatureSelectProps = {
  featureKey: string;
  meta?: FeatureMeta;
  value: string;
  onChange: (key: string, label: string, value: string) => void;
};

const CustomFeatureSelect = memo((props: CustomFeatureSelectProps) => {
  const { featureKey, meta, value, onChange } = props;
  const label = meta?.label || featureKey;
  const options = meta?.options || [];

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(featureKey, label, newValue);
    },
    [featureKey, label, onChange],
  );

  return (
    <div className="px-3 py-2 group" key={featureKey}>
      <div className="flex items-center justify-between gap-2">
        <HintLabel
          tooltip={meta?.description || label}
          tooltipPosition="top"
          tooltipAlign="start"
          tooltipSideOffset={2}
          className="shrink-0 max-w-[40%] block truncate"
        >
          {label}
        </HintLabel>
        <SelectRoot value={value} onValueChange={handleChange}>
          <SelectTrigger size="sm" className="text-xs min-w-0 flex-1">
            <SelectValue placeholder={meta?.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>
    </div>
  );
});

const BuiltInFeatureToggles = memo(() => {
  const copilot = useShallowCopilotDataStore((state) => ({
    extraWidgetsEnabled: state.extraWidgetsEnabled,
    toggleExtraWidgetsEnabled: state.toggleExtraWidgetsEnabled,
    generativeUiEnabled: state.generativeUiEnabled,
    toggleGenerativeUiEnabled: state.toggleGenerativeUiEnabled,
  }));

  const { widgetGlobalSearchFF, generativeUiFF } = useShallowCopilotStore((s) => {
    const featureFlags = s.selectedCopilot?.features || {};
    const widgetGlobalSearchFF = Boolean(featureFlags?.["widget-global-search"]);
    const generativeUiFF = Boolean(featureFlags?.["generative-ui"]);
    return {
      widgetGlobalSearchFF,
      generativeUiFF,
    };
  });

  const handleToggleGenerativeUI = useCallback(() => {
    const newState = copilot.toggleGenerativeUiEnabled();

    showNotification({
      id: "copilot-generative-ui-toggle",
      message: newState ? "Generative UI Enabled" : "Generative UI Disabled",
      description: newState
        ? "The copilot can now control your dashboard and automatically add or modify widgets based on your requests."
        : "The copilot will no longer be able to control your dashboard or modify widgets automatically.",
      toastType: "info",
    });
  }, [copilot.toggleGenerativeUiEnabled]);

  const handleToggleGlobalData = useCallback(() => {
    const newState = copilot.toggleExtraWidgetsEnabled();

    showNotification({
      id: "copilot-global-data-toggle",
      message: newState ? "Global Data Enabled" : "Global Data Disabled",
      description: newState
        ? "The copilot can now access data from any widget in the library, not just those on your dashboard."
        : "The copilot will only access data from widgets currently on your dashboard.",
      toastType: "info",
    });
  }, [copilot.toggleExtraWidgetsEnabled]);

  return (
    <>
      <div className="px-3 py-2 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HintLabel
              tooltip={
                widgetGlobalSearchFF
                  ? "Expands the copilot's data access beyond your current dashboard. When enabled, the copilot can retrieve data from any widget in the library — not just the ones you've added to your dashboard."
                  : "Global data is not enabled for this copilot"
              }
              tooltipClassName="max-w-[280px]"
              disabled={!widgetGlobalSearchFF}
            >
              Global data
            </HintLabel>
          </div>
          <Switch
            checked={copilot.extraWidgetsEnabled && widgetGlobalSearchFF}
            onCheckedChange={handleToggleGlobalData}
            disabled={!widgetGlobalSearchFF}
            aria-label="Toggle global data"
          />
        </div>
      </div>

      <div className="px-3 py-2 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HintLabel
              tooltip={
                generativeUiFF ? (
                  <div className="flex flex-col gap-1.5">
                    <span>Lets the copilot control your dashboard directly:</span>
                    <ul className="list-disc pl-3.5 space-y-0.5">
                      <li>Add widgets from the library with the right parameters</li>
                      <li>Update parameters on existing dashboard widgets</li>
                      <li>
                        Create widgets on the fly (e.g. HTML reports, notes, charts,
                        etc.)
                      </li>
                    </ul>
                    <span className="text-light-500 dark:text-light-400 italic">
                      Try: "Using the financial statements of AAPL, create an HTML
                      report with a DCF analysis and add it to the dashboard"
                    </span>
                    {/*Uncomment when add to docs <a
                      href="https://docs.openbb.co/workspace/generative-ui"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-main hover:underline mt-0.5"
                    >
                      See demo &rarr;
                    </a>*/}
                  </div>
                ) : (
                  "Generative UI is not enabled for this copilot"
                )
              }
              tooltipClassName="max-w-[320px]"
              disabled={!generativeUiFF}
            >
              Generative UI
            </HintLabel>
          </div>
          <Switch
            checked={copilot.generativeUiEnabled && generativeUiFF}
            onCheckedChange={handleToggleGenerativeUI}
            disabled={!generativeUiFF}
            aria-label="Toggle generative UI"
          />
        </div>
      </div>
    </>
  );
});
