import {
  type ComponentType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { IconId } from "~/components/Icon.types";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { useShallowAppStore } from "~/lib/state/app";
import { isExcludedWidgetId } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { useShallowStreamingStore } from "../AI/hooks/useStreaming";
import BrandedLogo from "../General/BrandedLogo";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import { ensureAgGrid, useAgGridContext } from "../General/Table/hooks";
import { useSizeColumns } from "../General/Table/hooks/useUpdateColumnState";
import { useIsFirstRender } from "../General/Table/hooks/utils";
import Icon from "../Icon";
import { useWidgetContext } from "../Widget.context";
import type { WidgetId } from "../Widgets";

const showDemoRequestButton = getShowDemoRequestButton();

type LoadingElementProps = {
  className?: string;
  loading?: boolean;
  displayBlock?: boolean;
  errorMessage?: ReactNode | string | null;
  secondaryMessage?: ReactNode | string | null;
  errorChildren?: ReactNode;
  children?: ReactNode;
  failingUrl?: string;
  widgetId?: WidgetId;
  icon?: boolean | IconId;
};

interface ChildrenProps {
  children: ReactNode;
}

function UnshareableElement() {
  return (
    <div
      className="relative overflow-auto flex px-2.5 mb-2.5
      h-[calc(100%-38px)] w-full flex-col items-center justify-center gap-4"
    >
      <BrandedLogo animate={false} />
      <p className="text-xs text-ds-text-caption">
        SQL Database and Snowflake widgets are not supported in shared dashboards yet.
      </p>
    </div>
  );
}

function UnfetchableURL({ url }: { url: string }) {
  const widgetUUID = useWidgetContext(true)?.widgetRef?.current?.id;
  return (
    <div
      className="relative overflow-auto flex px-2.5 mb-2.5
      h-[calc(100%-38px)] w-full flex-col items-center justify-center gap-2"
    >
      <Icon id="warning-icon" className="size-6 text-ds-text-caption" />
      <p
        id={`widget-error-${widgetUUID}`}
        className="text-sm text-ds-text-body font-bold"
      >
        Widget Unavailable
      </p>
      <p className="text-xs text-ds-text-caption break-words">
        The URL: {url} is currently not accessible.
      </p>
    </div>
  );
}

export const LoadingElement = forwardRef<HTMLElement, LoadingElementProps>(
  (props, _ref) => {
    const {
      children,
      displayBlock = false,
      errorMessage,
      secondaryMessage = null,
      errorChildren,
      loading,
      failingUrl,
      widgetId,
      icon = true,
    } = props;

    const childrenExist = !!children;
    const isMinimized = useWidgetContext(true)?.widget?.isMinimized;
    const showLoading = !isMinimized && (!!loading || !childrenExist);

    const setBookingOpen = useShallowThemeStore((s) => s.setBookingOpen);

    const loadingElement = useMemo(() => {
      return (
        <div
          className={cn(
            "flex h-[calc(100%-38px)] w-full items-center justify-center overflow-hidden p-4",
            props.className,
          )}
        >
          <BrandedLogo />
        </div>
      );
    }, [props.className]);

    if (isExcludedWidgetId(widgetId)) {
      return (
        <SearchResultsNotFound
          icon={true}
          iconClassName="text-ds-text-caption"
          firstMessage="This widget is not available in your current plan."
          secondMessage={null}
        >
          {showDemoRequestButton && (
            <p className="text-xs text-light-500">
              Please{" "}
              <button
                className="text-xs text-brand-main dark:text-brand-lighter underline"
                onClick={() => setBookingOpen(true)}
              >
                Upgrade
              </button>{" "}
              to access this widget.
            </p>
          )}
        </SearchResultsNotFound>
      );
    }

    if (failingUrl && !isMinimized) return <UnfetchableURL url={failingUrl} />;

    if (errorMessage && !isMinimized) {
      return (
        <SearchResultsNotFound
          icon={Boolean(icon)}
          iconClassName={typeof icon === "string" ? icon : ""}
          firstMessage={errorMessage}
          secondMessage={secondaryMessage}
        >
          {errorChildren}
        </SearchResultsNotFound>
      );
    }

    if (displayBlock && !isMinimized) return <UnshareableElement />;

    if (childrenExist && !showLoading) return children;

    if (showLoading) return loadingElement;
  },
);

LoadingElement.displayName = "LoadingElement";

interface SetLoadingOnResizeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  chartView?: boolean;
}

export const SetLoadingOnResize = forwardRef<HTMLDivElement, SetLoadingOnResizeProps>(
  ({ children, chartView = false, ...rootProps }, ref) => {
    const isResizingGridElement = useShallowThemeStore(
      (state) => state.isResizingGridElement,
    );
    const widgetRef = useWidgetContext()?.widgetRef;

    const widgetId = widgetRef?.current?.id;
    const disable = widgetRef?.current?.storage?.chartView?.enabled && !chartView;
    const isResizing = isResizingGridElement === widgetId;
    const { className = "relative h-full w-full", ...props } = rootProps;

    return (
      <>
        {isResizing ? !disable && <LoadingElement /> : null}
        <div className={cn(className, { hidden: isResizing })} ref={ref} {...props}>
          {children}
        </div>
      </>
    );
  },
);

SetLoadingOnResize.displayName = "LoadingOnResize";

export function HideOnResize({ children }: { children: ReactNode }) {
  const isResizingGridElement = useShallowThemeStore(
    (state) => state.isResizingGridElement,
  );
  const widgetRef = useWidgetContext()?.widgetRef;

  return isResizingGridElement === widgetRef?.current?.id ? null : children;
}

export const AgGridSetLoadingOnResize = forwardRef<HTMLElement, ChildrenProps>(
  ({ children }, _ref) => {
    const isResizingGridElement = useShallowThemeStore(
      (state) => state.isResizingGridElement,
    );
    const { widgetRef, activeDashboardId } = useWidgetContext();
    const { gridRef, updateAgGrid } = useAgGridContext();
    const resizedData = useAgGridContext()?.gridState?.resized;

    const sizeColumns = useSizeColumns();

    const widgetLayout = useShallowAppStore((s) =>
      s.getWidgetGridData(activeDashboardId, widgetRef?.current?.id),
    );

    const chartView = widgetRef?.current?.storage?.chartView?.enabled;
    const isResizing = isResizingGridElement === widgetRef?.current?.id;
    const isFirstRender = useIsFirstRender();
    const childrenMemo = useMemo(() => children, [children]);

    const resizedCb = useCallback(
      (prev: { from: number; to: number }) => {
        const from = prev?.to ?? widgetLayout?.w;
        return { from, to: widgetLayout?.w };
      },
      [widgetLayout?.w],
    );

    useEffect(() => {
      if (isFirstRender) return updateAgGrid({ resized: resizedCb });

      if (ensureAgGrid(gridRef.current) && !(isResizing || chartView)) {
        updateAgGrid({ resized: resizedCb });
      }
    }, [isResizing]);

    useEffect(() => {
      const { from, to } = resizedData ?? {};
      const wasResized = (from < to || from > to) && resizedData;
      if (ensureAgGrid(gridRef.current) && !(isResizing || chartView) && wasResized) {
        sizeColumns(gridRef.current, resizedData);
      }
    }, [gridRef, resizedData]);

    return (
      <>
        {isResizing ? !chartView && <LoadingElement /> : null}
        <div className={cn("relative h-full w-full", { hidden: isResizing })}>
          {childrenMemo}
        </div>
      </>
    );
  },
);

AgGridSetLoadingOnResize.displayName = "AgGridOnResize";

interface CopilotOnResizeProps extends ChildrenProps {
  as?: "div" | "main";
  className?: string;
  id?: string;
  rootComponent?: ComponentType<ChildrenProps>;
}

const CopilotOnResize = forwardRef<HTMLDivElement, CopilotOnResizeProps>(
  (props, ref) => {
    const {
      children,
      id,
      className = "relative h-full w-full",
      as: Component = "div",
      rootComponent: RootComponent,
    } = props;

    const isDragging = useShallowStreamingStore((state) => state.isDragging);
    const childrenMemo = useMemo(() => children, [children]);

    const element = (
      <Component ref={ref} id={id} className={cn(className, { hidden: isDragging })}>
        {childrenMemo}
      </Component>
    );

    return (
      <>
        {isDragging ? <LoadingElement /> : null}
        {RootComponent ? <RootComponent>{element}</RootComponent> : element}
      </>
    );
  },
);

CopilotOnResize.displayName = "CopilotSetLoadingOnResize";
export const CopilotSetLoadingOnResize = CopilotOnResize;

export default SetLoadingOnResize;
