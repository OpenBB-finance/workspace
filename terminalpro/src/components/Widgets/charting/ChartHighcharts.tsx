import Highcharts from "highcharts/highcharts";
import HighchartsGantt from "highcharts/highcharts-gantt";
import HighchartsMaps from "highcharts/highmaps";
import HighchartsStocks from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { useRawDataToggle } from "~/components/Widgets/charting/useRawDataToggle";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";

type ConstructorType = "stockChart" | "mapChart" | "chart" | "ganttChart";

const constructorTypes: Record<ConstructorType, any> = {
  stockChart: HighchartsStocks,
  mapChart: HighchartsMaps,
  chart: Highcharts,
  ganttChart: HighchartsGantt,
};

export default function ChartHighcharts() {
  const { widget } = useWidgetContext();
  const theme = useShallowThemeStore((s) => s.theme);

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
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

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={showTable ? rawData : data}
      lastUpdated={dataUpdatedAt}
      //failingUrl={state.failingUrl}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={toggle}
      loading={showTable ? rawLoading : isLoading}
      error={showTable ? rawError || !rawData : error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <SetLoadingOnResize>
        {showTable
          ? tableNode
          : !isLoading &&
            data?.userOptions && (
              <HighchartsReact
                highcharts={constructorTypes[data?.constructorType ?? "chart"]}
                constructorType={data?.constructorType ?? "chart"}
                options={data?.userOptions}
              />
            )}
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
