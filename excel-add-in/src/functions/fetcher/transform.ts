import moment from "moment";
import { Cell, FormattedNumber } from "~/types/excel.types";
import { getShortDatePattern, toOADate } from "./dates";
import { CFError } from "./errors";

function dropEmptyCols(matrix: Cell[][], start: number): Cell[][] {
  const numCols = matrix[0].length;
  const nonEmptyColumns =
    matrix.length > start
      ? (matrix[0]
          .map((_, col) =>
            matrix.slice(start).every((row) => row[col] === "") ? null : col,
          )
          .filter((col) => col !== null) as number[])
      : Array.from({ length: numCols }, (_, i) => i);

  const resultMatrix = matrix.map((row) =>
    nonEmptyColumns.map((col) => row[col]),
  );

  return resultMatrix;
}

function toFormattedNumber(
  value: number,
  numberFormat: string,
): FormattedNumber {
  return {
    type: "FormattedNumber",
    basicValue: value,
    numberFormat,
  };
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function parseValue(value: any): string | number | FormattedNumber {
  if (value === null || value === undefined || value === "") return "";
  // Parse value to string or number, Excel only supports these two types
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Check if value can be parsed to a number, API sometimes returns numbers as strings
    const castedValue = Number(value);
    if (!isNaN(castedValue) && !(Array.isArray(value) && value.length === 0))
      return castedValue;
    // Check if value is a date
    const momentDate = moment(value, moment.ISO_8601, true);
    if (momentDate.isValid()) {
      const oaDate = toOADate(momentDate.utc(true));
      return toFormattedNumber(oaDate, getShortDatePattern() || "");
    }
    return value;
  }
  return JSON.stringify(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformObject(rec: Record<string, any>): Cell[][] {
  // Balance object to 2D array by adding empty strings to arrays, e.g.: {a: [1,2,3], b: [4,5]} => {a: [1,2,3], b: [4,5,""]}
  const keys: string[] = Object.keys(rec);
  const maxLen: number = Math.max(
    ...Object.values(rec).map((v) => (Array.isArray(v) ? v.length : 1)),
  );
  const output: Cell[][] = [keys];

  for (let i = 0; i < maxLen; i++) {
    const row: Cell[] = [];
    for (const k of keys) {
      const value = rec[k];

      if (Array.isArray(value)) {
        row.push(i < value.length ? parseValue(value[i]) : "");
      } else {
        row.push(i === 0 ? parseValue(value) : "");
      }
    }
    output.push(row);
  }
  return output;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformArray(arr: any[]): Cell[][] {
  // Check if first element is an object, if so, use its keys as header row
  if (arr[0] !== null && typeof arr[0] === "object" && !Array.isArray(arr[0])) {
    const headerRow: string[] = Object.keys(arr[0]);
    const transformedArray: Cell[][] = [headerRow];
    for (const item of arr) {
      const row: Cell[] = [];
      for (const key of headerRow) {
        const value = item[key as keyof typeof item];
        row.push(parseValue(value));
      }
      transformedArray.push(row);
    }
    return transformedArray;
  }

  const transformedArray: Cell[][] = [[]];
  for (const item of arr) {
    transformedArray[0].push(parseValue(item));
  }
  return transformedArray;
}

/**
 * @description Transforms data received from the API to a 2D array
 *
 * @param {Array<Record<string, any>> | Record<string, any>} data
 * @returns {Cell[][]}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function transformData(data: Array<Record<string, any>> | object | null | undefined): Cell[][] {

  if (data === null || data === undefined) throw CFError("Data not found");

  if (Array.isArray(data)) {
    if (data.length === 0) throw CFError("Data not found");
    return dropEmptyCols(transformArray(data), 1);
  }
  if (typeof data === "object") {
    if (Object.keys(data).length === 0) throw CFError("Data not found");
    return dropEmptyCols(transformObject(data), 1);
  }
  if (typeof data === "string" || typeof data === "number") {
    return [[data]];
  }
  throw CFError("Unknown data type");
}
