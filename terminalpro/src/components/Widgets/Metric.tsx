import get from "lodash/get";
import { useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useJsonData } from "~/lib/api";
import { colorVariants } from "../General/Table/CellRenderers/CellOnHover";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import { useWidgetContext } from "../Widget.context";

export default function MetricWidget() {
  const { widget } = useWidgetContext();

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      params: newParams,
    };
  }, [widget?.endpoint, widget?.storage?.params]);

  const { data, isLoading, error, dataUpdatedAt } = useJsonData(
    {
      ...options,
      responseCb: async (data, resolve) => {
        const dataKey = widget?.data?.dataKey;

        const jsonData = await data.json();
        return resolve(get(jsonData, dataKey, jsonData));
      },
    },
    {
      enabled: true,
      staleTime: widget?.staleTime ?? 1000 * 60 * 15,
    },
  );

  const metricData = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }, [data]);

  const element = useMemo(() => {
    return metricData?.map((metric, index) => {
      const deltaValue = Number.parseFloat(metric?.delta);
      const isZero = deltaValue === 0;
      const isNegative = !isZero && metric?.delta?.toString()?.startsWith("-");
      const deltaColor = isZero ? "default" : isNegative ? "red" : "green";
      return (
        <div
          key={index}
          className="flex flex-col items-center justify-center text-base pb-3"
        >
          <div>{metric?.label}</div>
          <div className="text-lg!">{metric?.value}</div>
          {metric?.delta && (
            <div
              style={{
                color: deltaColor === "default" ? "inherit" : colorVariants[deltaColor],
              }}
            >
              {isZero ? "" : isNegative ? "↓" : "↑"} {metric?.delta}
            </div>
          )}
        </div>
      );
    });
  }, [metricData]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={data}
      loading={isLoading}
      lastUpdated={dataUpdatedAt}
      showTitle={widget?.showTitle}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      error={!!error || metricData?.length === 0}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <div
        className="grid dark:text-white"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        {element}
      </div>
    </DraggableCard>
  );
}
