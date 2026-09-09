import ExcelJS from "exceljs";
import type { Figure } from "react-plotly.js";

export const non_blocking = (func: any, delay: number) => {
  let timeout: NodeJS.Timeout;
  return function () {
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

export function dateIsValid(date: string | number | Date) {
  return !Number.isNaN(new Date(date).getTime());
}

export function parse(text: string) {
  const rows = text.split("\n");
  const headers = rows[0].split(",");
  const data = rows.slice(1).map((row) => {
    const values = row.split(",");
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index];
      return acc;
    }, {});
  });
  return {
    headers,
    data,
  };
}

export function suggestDataType(headers: string[]) {
  const dateHeaders = headers.filter((header) => {
    return (
      header.toLowerCase().includes("date") || header.toLowerCase().includes("time")
    );
  });
  if (dateHeaders.length > 0) {
    const high = headers.find((header) => header.toLowerCase().includes("high"));
    const low = headers.find((header) => header.toLowerCase().includes("low"));
    const open = headers.find((header) => header.toLowerCase().includes("open"));
    const close = headers.find((header) => header.toLowerCase().includes("close"));
    if (high && low && open && close) {
      return "candlestick";
    }
    return "line";
  }
  // TODO: add more suggestions
  return "line";
}

export const saveToFile = (blob: Blob, fileName: string) => {
  // console.error("oops, something went wrong!", error);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return new Promise((resolve) => {
    resolve(true);
  });
};

export async function getExportData(gd: Figure | any | any[]) {
  const data = gd.data as any[];
  let columns: string[] = [];
  const rows: any[] = [];

  const xaxis = gd?.layout?.xaxis?.title?.text || "x";
  const yaxis = gd?.layout?.yaxis?.title?.text || "y";

  if (!Array.isArray(data)) return [];

  for (const trace of data) {
    const xIsArray = Array.isArray(trace.x);
    const yIsArray = Array.isArray(trace.y);

    if (trace.type === "candlestick") {
      if (columns.length === 0) {
        columns = ["Date", "Open", "High", "Low", "Close"];
      }
      for (let i = 0; i < trace.x.length; i++) {
        const x = trace.x[i];
        rows.push([x, trace.open[i], trace.high[i], trace.low[i], trace.close[i]]);
      }
      continue;
    }

    if (["scatter", "bar", undefined].includes(trace.type) && yIsArray && xIsArray) {
      if (columns.length === 0) {
        columns.push(xaxis);
      }
      columns.push(trace.name !== undefined ? trace.name : yaxis);
      for (let i = 0; i < trace.x.length; i++) {
        const x = trace.x[i];

        const row = rows.find((row) => row[0] === x);
        if (row === undefined) {
          rows.push([x, trace.y[i]]);
          continue;
        }

        row.push(trace.y[i]);
      }
      continue;
    }

    if (xIsArray || yIsArray) {
      if (columns.length === 0) {
        columns.push(xaxis);
      }
      const yColumn = trace.name !== undefined ? trace.name : yaxis;
      columns.push(yColumn);
      const columnIdx = columns.indexOf(yColumn);

      if (xIsArray) {
        for (let i = 0; i < trace.x.length; i++) {
          const x = trace.x[i];
          const row = rows.find((row) => row[0] === x);
          if (row === undefined) {
            rows.push([x]);
          }
          const index = rows.findIndex((row) => row[0] === x);
          if (yIsArray) rows[index].push(trace.y[i]);
        }
        continue;
      }

      if (!yIsArray) continue;

      for (const y of trace.y) {
        const row = rows?.[columnIdx];
        if (row === undefined) {
          rows.push([y]);
          continue;
        }

        rows[columnIdx].push(y);
      }
    }
  }

  return rows.map((row) =>
    columns.reduce((acc, column, index) => {
      acc[column] = row[index] || null;
      return acc;
    }, {}),
  );
}

export async function prepareData(gd: Figure | any | any[]) {
  const data = gd.data as any[];
  let columns: string[] = [];
  const rows: any[] = [];

  const xrange = gd.layout.xaxis.range;
  const x0_min = new Date(xrange[0].replace(" ", "T").split(".")[0]).getTime();
  const x1_max = new Date(xrange[1].replace(" ", "T").split(".")[0]).getTime();

  const xaxis = gd?.layout?.xaxis?.title?.text || "x";

  const yaxis = gd?.layout?.yaxis?.title?.text || "y";

  for (const trace of data) {
    if (trace.type === "candlestick") {
      if (columns.length === 0) {
        columns = ["Date", "Open", "High", "Low", "Close"];
      }
      for (let i = 0; i < trace.x.length; i++) {
        const x = trace.x[i];
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (isoDateRegex.test(x.toString())) {
          const date = new Date(x.toString()).getTime();
          if (date >= x0_min && date <= x1_max) {
            rows.push([x, trace.open[i], trace.high[i], trace.low[i], trace.close[i]]);
          }
        }
      }
    }

    if (["scatter", "bar"].includes(trace.type)) {
      if (columns.length === 0) {
        columns.push(xaxis);
      }
      columns.push(trace.name !== undefined ? trace.name : yaxis);
      for (let i = 0; i < trace.x.length; i++) {
        const x = trace.x[i];
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (isoDateRegex.test(x.toString())) {
          const date = new Date(x.toString()).getTime();
          if (date >= x0_min && date <= x1_max) {
            const row = rows.find((row) => row[0] === x);
            if (row === undefined) {
              rows.push([x]);
            }
            const index = rows.findIndex((row) => row[0] === x);
            rows[index].push(trace.y[i]);
          }
        }
      }
    }
  }

  return { columns, data: rows };
}

export async function downloadData(
  gd: Figure | any | any[],
  title = "data",
  type = "csv" as "csv" | "excel",
  isFigure = true,
) {
  const { columns, data } = isFigure
    ? await prepareData(gd)
    : {
        columns: Array.isArray(gd) ? Object.keys(gd[0] || {}) : Object.keys(gd || {}),
        data: Array.isArray(gd)
          ? gd?.map((row: any) => Object.values(row || {}))
          : [Object.values(gd || {})],
      };

  const headers = columns;
  const rows = data.map((row: any) =>
    row.map((cell: any) => {
      if (cell == null || cell === undefined) {
        return "";
      }
      if (typeof cell === "object") {
        return JSON.stringify(cell);
      }
      return cell.toString().replace(/"/g, '""');
    }),
  );
  const csvData = [headers, ...rows];
  let blob: Blob;
  let filename: string;

  if (type === "csv") {
    const csvContent = csvData.map((e) => e.join(",")).join("\n");
    blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    filename = `${title}.csv`;
  }

  if (type === "excel") {
    const workbook = new ExcelJS.Workbook();

    const wb = workbook.addWorksheet("Sheet1");
    wb.columns = headers.map((header) => ({ header, key: header }));
    for (const row of data) wb.addRow(row);

    const wbout = await workbook.xlsx.writeBuffer();
    blob = new Blob([wbout], { type: "application/octet-stream" });
    filename = `${title}.xlsx`;
  }

  try {
    non_blocking(async () => {
      saveToFile(blob, filename).then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      });
    }, 2)();
  } catch (error) {
    console.error(error);
  }
}

export async function lazyLoadPlotly() {
  if (window.Plotly) return window.Plotly;

  const Plotly = await import("plotly.js-dist-min");
  window.Plotly = Plotly;
  return Plotly;
}
