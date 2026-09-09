import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { isCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import { getAllowedDataVendors } from "~/lib/onPremFeatureFlags";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import WIDGET_BUNDLES from "../../lib/widget_bundles.json";
import WIDGETS from "../../lib/widgets.json";
import { Checkbox } from "../ds/atoms/Checkbox";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";
import {
  LIBRARY_CARD_CLASS,
  LibraryItem,
  LibraryRow,
  LibrarySection,
} from "../ds/molecules/LibraryList";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import TerminalProOnlyTag from "../General/TerminalProOnlyTag";
import WidgetInfoTooltip from "../General/WidgetInfoTooltip";
import Icon from "../Icon";
import { TabPageLayout, TabPageSearchInput, TabPageToolbar } from "../shared/TabPage";
import Tooltip from "../Tooltip";

type BundleType = {
  icon?: string;
  name: string;
  description: string;
  enabled_by_default: boolean;
  pro_only?: boolean;
  widgets: string[];
  id: string;
  disabled?: boolean;
};

interface SearchableWidget {
  name: string;
  description?: string;
  category?: string;
  subCategory?: string;
}

function widgetMatchesSearch(widget: SearchableWidget, searchTerm: string) {
  return Boolean(
    widget.name.toLowerCase().includes(searchTerm) ||
      widget.description?.toLowerCase().includes(searchTerm) ||
      widget.category?.toLowerCase().includes(searchTerm) ||
      widget.subCategory?.toLowerCase().includes(searchTerm),
  );
}

function bundleMatchesSearch(
  bundle: { name: string; description: string },
  bundleId: string,
  searchTerm: string,
) {
  return (
    bundle.name.toLowerCase().includes(searchTerm) ||
    bundle.description.toLowerCase().includes(searchTerm) ||
    bundleId.toLowerCase().includes(searchTerm)
  );
}

export function Bundle({ bundle, filter }: { bundle: BundleType; filter?: string }) {
  const { enabledBundles, toggleBundle, disabledWidgets, toggleWidgetDisabled } =
    useShallowAuthStore((state) => ({
      enabledBundles: state.enabledBundles,
      toggleBundle: state.toggleBundle,
      disabledWidgets: state.disabledWidgets,
      toggleWidgetDisabled: state.toggleWidgetDisabled,
    }));

  // Sections auto-expand while searching; a manual toggle overrides that until
  // the query changes again.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setManualOpen(null);
  }, [filter]);

  const bundleWidgets = useMemo(() => {
    return bundle.widgets
      .map((widgetId) => WIDGETS[widgetId])
      .filter((widget) => widget !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bundle.widgets]);

  const searchTerm = filter?.toLowerCase().trim() ?? "";

  const bundleMatches = useMemo(() => {
    if (!searchTerm) return true;
    return bundleMatchesSearch(
      { name: bundle.name, description: bundle.description },
      bundle.id,
      searchTerm,
    );
  }, [bundle.name, bundle.description, bundle.id, searchTerm]);

  const filteredWidgets = useMemo(() => {
    if (!searchTerm || bundleMatches) return bundleWidgets;
    return bundleWidgets.filter((widget) => widgetMatchesSearch(widget, searchTerm));
  }, [bundleWidgets, searchTerm, bundleMatches]);

  const { theme } = useShallowThemeStore((state) => ({
    theme: state.theme,
  }));

  const isBundleEnabled = enabledBundles.includes(bundle.id);
  const enabledWidgetsCount = bundleWidgets.filter(
    (widget) => !disabledWidgets.includes(widget.widgetId),
  ).length;
  const isIndeterminate =
    isBundleEnabled &&
    enabledWidgetsCount > 0 &&
    enabledWidgetsCount < bundleWidgets.length;
  const isChecked = isBundleEnabled && enabledWidgetsCount === bundleWidgets.length;

  const { isProTier } = useShallowFeatureFlagsStore((state) => ({
    isProTier: state.featureFlags?.tier === "pro",
  }));

  const handleBundleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    toggleBundle(bundle.id);
    if (bundle.id === "tradingview" && !enabledBundles.includes(bundle.id)) {
      if (isCopilotAvailable()) {
        toast.info("TradingView not available with Copilot", {
          description:
            "You can still add TradingView widgets to your Dashboard but you won't be able to import them into Copilot.",
        });
      }
    }
  };

  const BundleIcon = useCallback(() => {
    return (
      <div
        className="bg-light-50 dark:bg-[#36363F] min-w-6 size-6
        rounded-sm overflow-hidden flex items-center justify-center"
      >
        <img
          src={`/assets/images/bundles/${bundle.id}_${theme}.png`}
          className={cn("size-6 object-contain", {
            "size-4": bundle.id === "pyth",
          })}
        />
      </div>
    );
  }, [bundle.id, theme]);

  return (
    <LibrarySection
      title={bundle.name}
      description={
        <div className="flex items-center grow mr-2 overflow-hidden">
          <span className="text-light-500 dark:text-light-400 font-medium truncate overflow-hidden whitespace-nowrap text-ellipsis mr-2.5 text-xs">
            {bundle.description}
          </span>
          {bundle.pro_only && <TerminalProOnlyTag isVisible={!isProTier} />}
        </div>
      }
      leftSection={
        <Tooltip
          position="right"
          message={
            enabledBundles.includes(bundle.id)
              ? "If you disable this bundle, the widgets will be removed from the search menu but will remain on your dashboards."
              : "If you enable this bundle, the widgets will be added to the search menu."
          }
        >
          <span>
            <Checkbox
              disabled={bundle.disabled || (bundle.pro_only && !isProTier)}
              checked={
                bundle.pro_only && !isProTier
                  ? false
                  : isIndeterminate
                    ? "indeterminate"
                    : isChecked
              }
              onClick={handleBundleToggle}
            />
          </span>
        </Tooltip>
      }
      tooltip={
        <WidgetInfoTooltip
          name={bundle.name}
          description={bundle.description}
          connectionType="packaged"
          source={bundle.id}
          customIcon={<BundleIcon />}
        />
      }
      open={manualOpen ?? !!searchTerm}
      onOpenChange={setManualOpen}
    >
      <div className="z-50 mb-2 mt-4 ml-5 text-xs flex flex-col gap-2">
        {filteredWidgets.map(
          ({
            widgetId,
            name,
            description,
            category,
            subCategory,
            imgUrl,
            disableRetrievalForCopilot,
          }) => (
            <LibraryItem
              key={`${widgetId}-widget-container`}
              title={name}
              description={description}
              variant="row"
              className={cn(LIBRARY_CARD_CLASS, "flex h-10 items-center w-full", {
                "bg-general-bg-secondary! opacity-50": bundle.pro_only && !isProTier,
              })}
              leftSection={
                <Checkbox
                  disabled={bundle.disabled || (bundle.pro_only && !isProTier)}
                  checked={
                    bundle.pro_only && !isProTier
                      ? false
                      : !disabledWidgets.includes(widgetId) && isBundleEnabled
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWidgetDisabled(widgetId);
                  }}
                />
              }
              tooltip={
                <WidgetInfoTooltip
                  name={name}
                  description={description}
                  connectionType="packaged"
                  source={bundle.id}
                  category={category}
                  subCategory={subCategory}
                  imgUrl={imgUrl}
                  customIcon={<BundleIcon />}
                />
              }
              rightSection={
                disableRetrievalForCopilot ? (
                  <div className="pointer-events-auto relative">
                    <Tooltip
                      position="top"
                      message="Copilot is not allowed to retrieve data from this widget."
                      className="pointer-events-auto"
                    >
                      <span className="inline-block">
                        <Icon
                          id="message-plus-square"
                          className="size-4 text-light-300 dark:text-dark-300"
                        />
                      </span>
                    </Tooltip>
                  </div>
                ) : undefined
              }
            />
          ),
        )}
      </div>
    </LibrarySection>
  );
}

export function PackagedDataTab() {
  const [requestDataModal, setRequestDataModal] = useState(false);
  const [filter, setFilter] = useState("");
  const [debouncedFilter] = useDebounceValue(filter, 300);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onInputChange = useCallback(
    (val: string) => {
      setFilter(val);
      if (inputRef.current && !val) {
        inputRef.current.value = val;
      }
    },
    [inputRef],
  );

  const handleCloseRequestDataModal = () => {
    setRequestDataModal(false);
  };
  const enabledDataVendorsFF = getAllowedDataVendors();

  const entries = useMemo(() => {
    return Object.entries(WIDGET_BUNDLES).filter(([bundleId]) =>
      enabledDataVendorsFF.includes(bundleId),
    );
  }, [enabledDataVendorsFF]);

  const filteredEntries = useMemo(() => {
    const searchTerm = debouncedFilter.toLowerCase().trim();
    if (!searchTerm) return entries;

    return entries.filter(
      ([bundleId, bundle]) =>
        bundleMatchesSearch(bundle, bundleId, searchTerm) ||
        (bundle.widgets as string[]).some((widgetId) => {
          const widget = WIDGETS[widgetId];
          return widget !== undefined && widgetMatchesSearch(widget, searchTerm);
        }),
    );
  }, [entries, debouncedFilter]);

  return (
    <TabPageLayout>
      <BaseDialog
        open={requestDataModal}
        onClose={handleCloseRequestDataModal}
        className="min-h-[80vh] max-h-[80vh] lg:max-w-3xl xl:max-w-5xl h-full z-999999"
      >
        <DialogTitle>Request Data</DialogTitle>
        <DialogDescription className="sr-only">
          Request data that we don't currently offer.
        </DialogDescription>
        <iframe
          className="w-full h-full"
          src="https://app.formbricks.com/s/cqx6ygvxkpy0gydm9jafz57w?embed=true"
        />
      </BaseDialog>
      <TabPageToolbar>
        <TabPageSearchInput
          ref={inputRef}
          placeholder="Search for data"
          defaultValue={debouncedFilter}
          onChange={onInputChange}
        />
      </TabPageToolbar>
      <div className="overflow-y-auto only-sm:max-h-[calc(40vh)] flex flex-col mt-2">
        {filteredEntries.length === 0 && debouncedFilter ? (
          <SearchResultsNotFound
            extraClassName="rounded-lg bg-general-bg-primary p-12 h-[200px]"
            icon={true}
          />
        ) : (
          filteredEntries.map(([bundleId, bundle]) => (
            <LibraryRow key={bundleId}>
              <Bundle
                bundle={{
                  ...bundle,
                  id: bundleId,
                }}
                filter={debouncedFilter}
              />
            </LibraryRow>
          ))
        )}
      </div>
    </TabPageLayout>
  );
}
