import posthog from "posthog-js";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import DraggableCard from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { FILE_EXTENSIONS } from "~/lib/constants";
import { useTabContext } from "~/lib/contexts/TabContext";
import { useAppStore } from "~/lib/state/app";
import { getCleanWidgetId } from "~/lib/utils";
import WIDGETS from "~/lib/widgets.json";
import EmptyDashboardCTA from "./General/EmptyDashboardCTA";
import SearchResultsNotFound from "./General/SearchResultsNotFound";
import { Table } from "./General/Table/hooks/useTableContext";
import RenderIfVisible from "./RenderIfVisible";
import { useWidgetContext, WidgetProvider } from "./Widget.context";
import Widgets, { getWidgetComponent, isAgGridWidget, type WidgetId } from "./Widgets";

const WidgetFallback = () => {
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions(false);

  return (
    <DraggableCard
      loading={true}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      children={null}
    />
  );
};

export function WidgetWrapper(props: { uuid: string; activeDashboardId: string }) {
  const { uuid, activeDashboardId } = props;

  const { getWidget, isShared } = useTabContext();
  const { widgetId, ...value } = useMemo(
    () => ({
      uuid,
      isShared,
      activeDashboardId,
      widgetId: getWidget(uuid)?.widgetId,
    }),
    [uuid, activeDashboardId],
  );

  const element = useMemo(
    () => (
      <WidgetProvider {...value}>
        <RenderIfVisible>
          <Suspense fallback={<WidgetFallback key={`widget-fallback-${uuid}`} />}>
            <WidgetComponent />
          </Suspense>
        </RenderIfVisible>
      </WidgetProvider>
    ),
    [value],
  );

  const errorBoundaryProps = useMemo(
    () => ({
      onError: (error: Error) => {
        if (posthog) {
          const widget = getWidget(uuid);
          const newWidget = Object.fromEntries(
            Object.entries(widget || {}).filter(([key]) => key !== "data"),
          );
          posthog.capture("Error_widget", {
            widget: newWidget,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          });
        }
      },
      fallback: (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-general-border-secondary bg-general-bg-primary p-2">
          <SearchResultsNotFound
            firstMessage={`Something went wrong with the widget: ${widgetId ?? uuid}`}
            secondMessage="Please try again later or remove the widget."
            children={
              <Button
                className="mt-2.5"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (widgetId)
                    useAppStore.getState().removeWidget(activeDashboardId, uuid);
                }}
              >
                Remove widget
              </Button>
            }
          />
        </div>
      ),
    }),
    [uuid, widgetId, activeDashboardId, posthog],
  );

  // empty dashboard cta widget - https://openbb.atlassian.net/browse/AA-3818
  if (uuid === "empty-dashboard-cta") return <EmptyDashboardCTA />;

  return <ErrorBoundary {...errorBoundaryProps}>{element}</ErrorBoundary>;
}

function loadWidgetComponent(widgetId: WidgetId) {
  const Component = getWidgetComponent(widgetId);

  if (!Component) {
    return null;
  }

  if (isAgGridWidget(widgetId)) {
    return (
      <Table>
        <Component />
      </Table>
    );
  }

  return <Component />;
}

export function WidgetComponent() {
  const { widget, widgetFromJSON } = useWidgetContext();
  if (!widget?.widgetId) {
    return null;
  }

  const endpointUrl = widget?.endpoint?.url;
  const cleanWidgetId = getCleanWidgetId(widget.widgetId, widget.connectionType);

  // Handle YouTube widgets - both built-in (widgetId="youtube-xxx") and backend (type="youtube")
  if (cleanWidgetId === "youtube" || widget?.type === "youtube") {
    return <Widgets.YouTube />;
  }

  if (
    cleanWidgetId.startsWith("ag_grid_file") &&
    FILE_EXTENSIONS.some((ext) => endpointUrl.endsWith(ext))
  ) {
    return endpointUrl.endsWith(".pdf") ? (
      <Widgets.PdfViewer />
    ) : endpointUrl.endsWith(".html") ? (
      <Widgets.HtmlViewer />
    ) : endpointUrl.endsWith(".txt") ||
      endpointUrl.endsWith(".md") ||
      endpointUrl.endsWith(".docx") ? (
      <Widgets.Markdown />
    ) : (
      <Widgets.ImageViewer />
    );
  }

  const hasComponent = loadWidgetComponent(cleanWidgetId as WidgetId);

  if (hasComponent) return hasComponent;

  if (cleanWidgetId === "news") {
    return (
      <Widgets.News
        //showFilter TODO: figure how the filter would work
        title={widget.name}
        showTickersChange={widget.widgetId === "company_news"}
        showMain={false}
      />
    );
  }

  const widgetType = widgetFromJSON?.type ?? widget?.type;
  const widgetTypeComponent = loadWidgetComponent(widgetType as WidgetId);

  if (widgetTypeComponent) return widgetTypeComponent;

  if (
    widget?.endpoint ||
    widget?.sdkFunc ||
    Object.keys(WIDGETS).includes(widget.widgetId)
  ) {
    return (
      <Table>
        <Widgets.AgGridTable />
      </Table>
    );
  }
  return (
    <DraggableCard>
      <SearchResultsNotFound
        icon={true}
        firstMessage="Widget is not implemented yet"
        secondMessage={`ID: ${widget.widgetId}`}
      />
    </DraggableCard>
  );
}

/*if (widget.widgetId === "table_chart") {
  return <TableChart/>;
}
if (widget.widgetId === "flashing_table") {
  return <FlashingTable/>;
}
if (widget.widgetId === "pyscript") {
  return <PyScript/>;
}
if (widget.widgetId === "html_widget") {
  return <HtmlWidget/>;
}
 */
