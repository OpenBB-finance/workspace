import { lazy, Suspense, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { useRawDataToggle } from "~/components/Widgets/charting/useRawDataToggle";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";

const VegaEmbed = lazy(() =>
  import("react-vega").then((m) => ({ default: m.VegaEmbed })),
);

const EMBED_OPTIONS = { actions: false, renderer: "canvas" as const };

export default function ChartVegaLite() {
  const { widget } = useWidgetContext();
  const theme = useShallowThemeStore((s) => s.theme);

  const { width, height, ref } = useResizeDetector<HTMLDivElement>({
    refreshMode: "debounce",
    refreshRate: 50,
  });

  const options = useMemo(() => {
    const newParams: Record<string, unknown> = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );
    newParams.theme = theme;
    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
    };
  }, [widget?.endpoint, widget?.storage?.params, theme]);

  const { showTable, toggle, tableNode, rawData, rawLoading, rawError } =
    useRawDataToggle({ baseOptions: options });

  const { data, isLoading, error, dataUpdatedAt } = useJsonData(options, {
    enabled: !showTable,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const sizedSpec = useMemo(() => {
    if (!data || typeof data !== "object") return data;
    if (!width || !height) return data;
    return { ...data, width, height, autosize: "fit" };
  }, [data, width, height]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={showTable ? rawData : data}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={toggle}
      loading={showTable ? rawLoading : isLoading}
      error={showTable ? rawError || !rawData : error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <SetLoadingOnResize>
        <div ref={ref} className="h-full w-full">
          {showTable
            ? tableNode
            : !isLoading &&
              data &&
              width &&
              height && (
                <Suspense fallback={null}>
                  <VegaEmbed
                    spec={sizedSpec}
                    options={EMBED_OPTIONS}
                    className="chart-vegalite"
                  />
                </Suspense>
              )}
        </div>
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
