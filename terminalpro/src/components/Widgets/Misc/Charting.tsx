import ExcelJS from "exceljs";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { formatNumberNoMagnitude } from "~/lib/utils";
import GroupDropdown from "../Helpers/GroupDropdown";
import useCopilotDataWidget from "../Helpers/useCopilotDataWidget";
import type { ChartingLibraryWidget } from "../TVChartContainer/TVChartContainerFunc";
import TvChart from "../TvChart";

type TVWidgetT = MutableRefObject<ChartingLibraryWidget | null>;

export function getHeaders(schema) {
  return schema.map((item) => {
    if (Object.keys(item).length === 1 && item.type === "time") {
      return "Date";
    }
    if (item.sourceType === "study") {
      return `${item.sourceTitle} - ${item.plotTitle}`.replace(/,/g, "");
    }
    return item.plotTitle.replace(/,/g, "");
  });
}

export function convertToCSV(data, schema) {
  let csv = `${getHeaders(schema).join(",")}\n`;

  for (const row of data) {
    const utcDate = new Date(row[0]).toUTCString().replace(/,/g, "");
    const newRow = [utcDate, ...row.slice(1)];
    csv += `${newRow.join(",")}\n`;
  }

  return csv;
}

function useTVCopilotData(tvWidget: TVWidgetT) {
  const [state, dispatch] = useStateReducer({ aiData: [], lastUpdated: 0 });

  useEffect(() => {
    if (!tvWidget.current) return;
    tvWidget.current.setOnDataHandler((aiData) =>
      dispatch({ aiData, lastUpdated: Date.now() }),
    );
  }, [tvWidget.current]);

  useCopilotDataWidget({
    ...state,
    aiEnabled: import.meta.env.VITE_TRADINGVIEW_ENABLED === "true",
  });
}

export default function Charting() {
  const tvWidget = useRef<ChartingLibraryWidget | null>(null);
  useTVCopilotData(tvWidget);
  const widgetFromJSON = useWidgetContext(true)?.widgetFromJSON;

  const elementBeforeTitle = useMemo(() => {
    const symbolParam = widgetFromJSON?.params?.find(
      (param) => param.paramName === "symbol",
    );
    const props = {
      paramDef: symbolParam,
      ...(!symbolParam ? { type: "ticker" as const } : {}),
    };

    return <GroupDropdown className="mr-1" {...props} />;
  }, [widgetFromJSON?.params]);

  const exportFns = useMemo(
    () => ({
      csvFunction: (title: string) => tvCVSExport(title, tvWidget),
      excelFunction: (title: string) => tvExcelExport(title, tvWidget),
    }),
    [tvWidget],
  );

  return (
    <DraggableCard
      aiEnabled={import.meta.env.VITE_TRADINGVIEW_ENABLED === "true"}
      aiData={import.meta.env.VITE_TRADINGVIEW_ENABLED === "true"}
      elementBeforeTitle={elementBeforeTitle}
      extraClassName="!px-0"
      exportFns={
        import.meta.env.VITE_TRADINGVIEW_ENABLED === "true" ? exportFns : undefined
      }
    >
      <TvChart tvRef={tvWidget} />
    </DraggableCard>
  );
}

async function tvCVSExport(title: string, tvWidget: TVWidgetT) {
  const chartType = tvWidget.current?.getTvWidget().activeChart().chartType();
  const data = await tvWidget.current
    ?.getTvWidget()
    .activeChart()
    .exportData({ includeDisplayedValues: true });

  if (![0, 1, 9].includes(chartType)) {
    const newSchema = data.schema.filter((item) => {
      // @ts-expect-error
      const { type, plotTitle, sourceType } = item;
      return type === "time" || plotTitle === "close" || sourceType === "study";
    });

    const schemaIndex = newSchema.map((item) => data.schema.indexOf(item));
    data.displayedData = data.displayedData.map((row) => {
      return row.filter((_, index) => schemaIndex.includes(index));
    });
    data.schema = newSchema;
  }

  const csv = convertToCSV(data.displayedData, data.schema);

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", `${title}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function tvExcelExport(title: string, tvWidget: TVWidgetT) {
  const data = await tvWidget.current
    ?.getTvWidget()
    .activeChart()
    .exportData({ includeDisplayedValues: true });

  const headers = getHeaders(data.schema);
  const dataAsObjects = data.displayedData.map((row) => {
    return row.reduce((obj, value: string | number, index) => {
      if (
        !(
          Number.isNaN(Number.parseFloat(value as string)) ||
          ["Date", "Time"].includes(headers[index])
        )
      )
        value = formatNumberNoMagnitude(value);

      obj[headers[index]] = value;
      return obj;
    }, {});
  });

  const workbook = new ExcelJS.Workbook();

  const wb = workbook.addWorksheet("Sheet1");
  wb.columns = headers.map((header) => ({ header, key: header }));
  for (const row of dataAsObjects) wb.addRow(row);

  const wbout = await workbook.xlsx.writeBuffer();
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("hidden", "");
  a.setAttribute("href", url);
  a.setAttribute("download", `${title}.xlsx`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
