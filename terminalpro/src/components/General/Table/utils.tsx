import type { WithoutGridCommon } from "ag-grid-community";
import type { IHeaderParams } from "ag-grid-enterprise";
import type { AgGridReact } from "ag-grid-react";
import dayjs from "dayjs";
import type { AgGridSSRMOptions, WidgetColumnDefT, WidgetT } from "~/components/types";
import { cleanSearchParams, convertHeadersToRecord } from "~/lib/api";
import type { Widget } from "~/lib/state/app";
import { parseValue } from "~/lib/utils";
import { convertToReadableLabel } from "./AgGridUtils";
import type { AgGridElement, AgGridEvents } from "./hooks/types";

export type Data = {
  [key: string]: any;
};

export function trimDataForQuarters(data, date: string) {
  if (!data || data.length === 0) {
    return [];
  }

  const inputDate = dayjs(date);
  const year = inputDate.year();
  const quarter = inputDate.quarter();

  const dates = Object.keys(data[0]).filter((item) => item !== "Index"); // array of dates in [YYYY-MM-DD] format from most recent to oldest

  let closestQuarterDateString = dates.find((item) => {
    const date = dayjs(item);
    return date.year() === year && date.quarter() === quarter;
  });

  if (closestQuarterDateString === undefined) {
    closestQuarterDateString =
      dates.find((item) => {
        const date = dayjs(item);
        return date.year() === year && date.quarter() === quarter - 1;
      }) ?? dates?.[0];
  }

  // previousQuarterDateString is the date of the quarter before the closestQuarterDateString
  const previousQuarterDateString = dates[dates.indexOf(closestQuarterDateString) + 1];

  const filteredData = data.map((item) => {
    const percentage = item[closestQuarterDateString]
      ? (item[closestQuarterDateString] - item[previousQuarterDateString]) /
        item[previousQuarterDateString]
      : null;
    return {
      Index: item.Index,
      Current: item[closestQuarterDateString],
      PastQuarter: item[previousQuarterDateString],
      Change:
        (item[closestQuarterDateString] | 0) - (item[previousQuarterDateString] | 0),
      Percentage: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].includes(
        percentage,
      )
        ? null
        : percentage,
    };
  });

  return filteredData;
}

export function getDeepObjectValue(obj: unknown, key: string) {
  if (Array.isArray(obj) || typeof obj !== "object" || typeof key !== "string")
    return obj;

  const keys = key.replace(/\.+/g, ".").split(".");
  const value = keys.reduce((acc, key) => {
    return acc?.[key];
  }, obj);
  return value;
}

type FinancialData = {
  date?: string;
  fiscal_period?: string;
  period?: string;
  calendar_year?: number;
  fiscal_year?: number;
};

type TableData<T> = (T & FinancialData) | (T & FinancialData)[];

export function getTableData<T>(
  data: TableData<T>,
  widget?: Partial<Widget>,
  options: {
    period?: "annual" | "quarter" | "ttm";
    ignoreUndefined?: boolean;
  } = {},
): T[] {
  const { period, ignoreUndefined = true } = options;
  const table = widget?.data?.table || {};
  const dataKey = widget?.data?.dataKey || "";
  const reversed = widget?.storage?.reversed ?? false;

  if (dataKey) {
    data = getDeepObjectValue(data, dataKey);
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    data = [data];
  }
  if (!data || data?.length === 0) {
    return [];
  }

  const headers = [];

  if (table?.showAll && (table?.columnsDefs ?? []).length > 0) {
    // if showAll is true, we need to show all the data
    for (const key of Object.keys(data[0] || {})) {
      const column = table.columnsDefs.find((col) => col.field === key);
      headers.push({
        ...(column ?? {}),
        field: key,
        headerName: column?.headerName ?? convertToReadableLabel(key),
      });
    }
  } else {
    headers.push(...(table?.columnsDefs ?? []));
  }

  const allKeys = Object.keys(data[0]);
  const noDataFields = new Set<string>();

  const dateField =
    table?.columnsDefs?.find(
      (column) => column.headerName === "Date" || column.cellDataType === "date",
    )?.field ??
    allKeys?.find((key) => key.toLowerCase().includes("date")) ??
    "date";

  if (!widget?.external) {
    data.sort((a, b) => {
      const first = reversed ? a : b;
      const second = reversed ? b : a;
      return dayjs(first?.[dateField]).diff(dayjs(second?.[dateField]));
    });
  }

  const newData = [];

  // we need to filter out the TTM data if the period is not TTM
  for (const [index, obj] of data.entries()) {
    const newRow = {};
    const fiscalPeriod = obj?.fiscal_period || obj?.period;
    const calendarYear = obj?.fiscal_year || obj?.calendar_year;

    if (
      !widget?.external &&
      ((period === "ttm" && fiscalPeriod !== "TTM") ||
        (period !== "ttm" && fiscalPeriod === "TTM"))
    ) {
      continue;
    }

    if (
      typeof obj?.[dateField] === "number" &&
      obj?.[dateField]?.toString()?.length >= 10
    ) {
      obj[dateField] = dayjs.unix(obj[dateField]).format("YYYY-MM-DD");
    }

    if (!widget?.external && period === "quarter" && fiscalPeriod && calendarYear) {
      obj[dateField] = dayjs(obj[dateField])
        .quarter(Number.parseInt(fiscalPeriod.replace("Q", ""), 10))
        .year(calendarYear)
        .startOf("quarter")
        .format("YYYY-MM-DD");
    }

    if (!widget?.external && period === "annual" && calendarYear) {
      obj[dateField] = dayjs(obj[dateField]).year(calendarYear).format("YYYY-MM-DD");
    }

    if (widget?.widgetId === "eod_price" && obj?.date) {
      obj.date = obj?.date?.split("T")?.[0];
    }

    if (!table?.transpose && headers.length > 0) {
      for (const column of headers) {
        if (!(column.field && column.headerName)) continue;

        if (obj?.[column.field] === undefined) {
          noDataFields.add(column.field);
          continue;
        }

        const isPeriod = ["fiscal_period", "period"].some(
          (item) => item === column.field,
        );
        if (!(isPeriod && ["annual", "ttm"].includes(period)) || widget?.external) {
          // edge case for string series data
          newRow[column.field] = parseValue(obj[column.field], column?.chartDataType);

          if (noDataFields.has(column.field) && newData[0]) {
            newData[0][column.field] = newData[0][column.field] ?? null;
            noDataFields.delete(column.field);
          }
        }
      }

      newData.push(newRow);
      continue;
    }

    // correctly parse the data for the table
    for (const key in obj) {
      obj[key] = parseValue(obj[key]);
      if (index > 0 && newData[0] && newData[0][key] === undefined)
        newData[0][key] = null;
    }

    newData.push(obj);
  }

  for (const [key, value] of Object.entries(newData[0] || {})) {
    if (value === undefined) delete newData[0][key];
  }

  if (table?.transpose) {
    return transposeData(newData, table, { colDefs: headers, dateField });
  }

  return newData;
}

export function transposeData<T extends { date?: string }>(
  arr: T[],
  table: Widget["data"]["table"] = {},
  options: {
    colDefs?: WidgetColumnDefT[];
    dateField?: string;
  } = { dateField: "date" },
) {
  if (!arr || arr.length === 0) {
    return [];
  }
  const transformedArray = [];
  const { colDefs, dateField } = options;

  const allKeys = Object.keys(arr[0]).filter(
    (key) => ![dateField, "date", "symbol", "fiscal_year"].some((item) => item === key),
  );

  const ignoreKeys = ["date", "symbol", "calendar_year", "fiscal_year", dateField];

  const headers =
    (colDefs || table?.columnsDefs)
      ?.filter((column) => !ignoreKeys.includes(column.field))
      ?.map((column) => column.field) || [];

  const hideColumns = table?.columnsDefs
    ?.filter((column) => column.hide)
    ?.map((column) => column.field);

  const keys = headers.length > 0 && !table.showAll ? headers : allKeys;

  for (const key of keys) {
    if (hideColumns?.includes(key)) {
      continue;
    }
    const transformedObject = { Index: key };

    for (const obj of arr) {
      const index = obj?.[dateField] || obj?.date || "Value";
      const value = obj[key];
      transformedObject[index] = value;
    }

    if (!["fiscal_period", "period"].some((item) => item === transformedObject.Index)) {
      transformedArray.push(transformedObject);
    }
  }

  return transformedArray;
}

export const isValidDate = (date: unknown): date is Date => {
  return date instanceof Date && !Number.isNaN(date.getTime());
};

export const safeDateParsing = (dateString: string): Date | null => {
  const date = new Date(dateString);

  if (isValidDate(date)) {
    return date;
  }
  return null;
};

export function transformStringToNormalLanguage(str: string): string {
  if (!str) {
    return "";
  }
  if (str.length <= 5) {
    return str;
  }
  const transformedString = str
    .split(/(?=[A-Z])/) // Split the string at uppercase letters
    .join(" ") // Join the split parts with a space
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Add a space before each uppercase letter preceded by a lowercase letter
    .replace(/(\b\w)/g, (match) => match.toUpperCase()); // Capitalize the first letter of each word
  return transformedString;
}

// Function to recursively count the number of items per key in a JSON object
export function countItemsPerKey(
  obj: any,
  path: string[] = [],
  counts: { path: string; count: number }[] = [],
) {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const currentPath = [...path, key].join(".");

    if (Array.isArray(obj[key])) {
      counts.push({ path: currentPath, count: obj[key].length });
    } else if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      countItemsPerKey(obj[key], [...path, key], counts);
    } else counts.push({ path: currentPath, count: 1 });
  }

  return counts as { path: string; count: number }[];
}

// Function to get the top 5 keys with the highest counts
export function getTop5KeysByCount(countsByKeys) {
  return Object.keys(countsByKeys)
    .sort((a, b) => countsByKeys[b] - countsByKeys[a])
    .slice(0, 5);
}

export function ensureAgGrid<T extends AgGridElement | AgGridReact | AgGridEvents>(
  agGrid: T | IHeaderParams<WithoutGridCommon<T> | T>,
  runIfValid?: () => void,
) {
  if (!agGrid) return false;
  if (!agGrid?.api) return false;
  if (agGrid?.api?.isDestroyed()) return false;

  runIfValid?.();
  return true;
}

export function clearCellSelection(agGrid: AgGridElement | AgGridReact | AgGridEvents) {
  if (!ensureAgGrid(agGrid)) return;
  agGrid.api.clearCellSelection();
}

export function agFlushAsyncTransactions(
  agGrid: AgGridElement | AgGridReact | AgGridEvents,
) {
  if (!ensureAgGrid(agGrid)) return;
  const rowModelType = agGrid?.api.getGridOption("rowModelType");
  if (rowModelType === "serverSide")
    return agGrid.api.flushServerSideAsyncTransactions();

  agGrid.api.flushAsyncTransactions();
}

function validateValue(value: unknown, checkValues = false): boolean {
  if (value === undefined || value === null) return false;

  switch (typeof value) {
    case "string":
      return value.trim().length > 0;

    case "object": {
      if (Array.isArray(value)) return value.length > 0;
      if (!checkValues) return Object.keys(value).length > 0;
      return Object.values(value).some((v) => validateValue(v, true));
    }

    case "boolean":
      return value;

    default:
      return !!value;
  }
}

/**
 * Function to check if all the arguments passed are truthy
 * @param args - Arguments to check if they are truthy
 * @returns boolean
 **/
export function areTruthy<T extends unknown[]>(...args: T): boolean {
  return args.every((arg) => validateValue(arg));
}

/**
 * Function to check if any of the arguments passed are truthy
 * @param args - Arguments to check if they are truthy
 * @returns boolean
 **/
export function someTruthy<T extends unknown[]>(...args: T): boolean {
  return args.some((arg) => validateValue(arg));
}

/**
 * Function to check if the value passed is truthy
 * @param value - Value to check if it is truthy
 * @returns boolean
 **/
export function isTruthy(value: unknown): boolean {
  return validateValue(value, true);
}

/**
 * Function to check if the value passed is a non-empty record
 * @param value - Value to check if it is a non-empty record
 * @returns boolean
 **/
export function isTruthyRecord(value: unknown): boolean {
  const isRecord = value && typeof value === "object" && !Array.isArray(value);
  return isRecord && Object.keys(value).length > 0;
}

export interface SSRResponse {
  rowCount: number;
  rowData: Record<string, any>[];
  schema: { [key: string]: string };
  timestamp: number;
  pivotFields: string[];

  error?: string;
}

export interface SSRMRunCompleteDetail {
  requestSucceeded: boolean;
  hasData: boolean;
  rowCount: number;
  rowData?: Record<string, any>[];
}

export async function getSSRRows(
  endpoint: WidgetT["endpoint"],
  params: Record<string, string>,
  request?: undefined | Partial<AgGridSSRMOptions>,
  signal?: AbortSignal,
): Promise<null | SSRResponse> {
  if (request)
    request.sortModel = request.sortModel?.filter(
      (item) => !item.colId.includes("ag-Grid-AutoColumn"),
    );
  const {
    headers,
    newParams: { query, ...restParams },
  } = convertHeadersToRecord(endpoint.headers, params || {});
  const cleanUrl = cleanSearchParams(endpoint.url, restParams);

  return await fetch(cleanUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: request ? JSON.stringify(request) : undefined,
    signal,
  })
    .then(async (res) => {
      if (!res.ok) return null;
      return await res.json();
    })
    .catch(() => null);
}

export type QueryState = {
  params: Record<string, string>;
  body: Partial<AgGridSSRMOptions> | undefined;
};

export function getQueryState(
  params: Record<string, string>,
  ssmRequest: Partial<AgGridSSRMOptions> | undefined = {},
  sqlQuery?: string,
  disableCache = false,
): QueryState {
  const { query, ...restParams } = params || {};
  if (sqlQuery) ssmRequest = { ...ssmRequest, query: sqlQuery, disableCache };
  return { params: restParams, body: ssmRequest };
}

export function getNewQuery(
  sqlValue: string,
  sqlParams?: { [key: string]: string },
): string {
  if (!sqlParams) return sqlValue;
  return Object.entries(sqlParams || {}).reduce((acc, [paramName, paramValue]) => {
    if (paramValue === null || paramValue === undefined) return acc;
    acc = acc.replace(
      new RegExp(`\\{\\{\\s*${paramName}\\s*\\}\\}`, "g"),
      Array.isArray(paramValue)
        ? paramValue.map((v) => `'${v.replace("'", "''")}'`).join(", ")
        : String(paramValue),
    );

    return acc;
  }, sqlValue);
}
