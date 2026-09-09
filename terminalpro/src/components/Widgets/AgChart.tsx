import type { AgChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useShallowThemeStore } from "~/lib/state/theme";
import { formatNumberMagnitude } from "~/lib/utils";
import DraggableCard, { SetLoadingOnResize } from "../DraggableCard";
import { useWidgetContext } from "../Widget.context";

export default function AgChart() {
  const { widget } = useWidgetContext();
  const { theme } = useShallowThemeStore((state) => ({
    theme: state.theme,
  }));
  const options = useMemo(() => {
    return {
      data: widget.storage.content,
      background: {
        visible: false,
      },
      theme: {
        baseTheme: theme === "dark" ? "ag-default-dark" : "ag-default",
        overrides: {
          common: {
            title: {
              fontSize: 12,
            },
          },
        },
      },
      series: widget.storage.chart_params.yKey.map((key) => ({
        type: widget.storage.chart_params.chartType,
        xKey: widget.storage.chart_params.xKey,
        yKey: key,
        tooltip: {
          enabled: true,
          renderer: (params) => {
            return {
              content: `<b>${params.datum[params.xKey]}:</b>  ${params.datum[
                params.yKey
              ]?.toLocaleString()}`,
            };
          },
        },
      })),
      padding: {
        top: 20,
        bottom: 5,
        left: 40,
        right: 40,
      },
      axes: [
        {
          type: "category",
          position: "bottom",
          label: {
            avoidCollisions: true,
            fontSize: 11,
            autoRotate: true,
            formatter: (params) => {
              if (
                dayjs(params.value).startOf("day").format("MMM DD\n YYYY") ===
                "Invalid Date"
              ) {
                return `${params.value}`.split(" ").reduce((acc, word, i) => {
                  if (i % 2 === 0 && `${acc} ${word}`.length < 20) {
                    return `${acc} ${word}`;
                  }
                  return `${acc} ${word}\n`;
                });
              }
              if (params.value.length <= 6) {
                return params.value;
              }
              return dayjs(params.value).startOf("day").format("MMM DD\n YYYY");
            },
          },
        },
        {
          type: "number",
          position: "left",
          label: {
            fontSize: 11,
            autoRotate: false,
            avoidCollisions: true,
            formatter: (params) => formatNumberMagnitude(params.value, 2),
          },
        },
      ],
      legend: {
        enabled: true,
        position: "top",
        maxHeight: 50,
        maxWidth: 500,
        spacing: 20,
        item: {
          paddingX: 10,
          paddingY: 3,
          marker: {
            shape: "square",
            size: 11,
          },
        },
      },
    } as AgChartOptions;
  }, [widget.storage]);

  return (
    <DraggableCard>
      <SetLoadingOnResize>
        <AgCharts options={options} />
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
