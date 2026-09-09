import { type Cell } from "~/types/excel.types";
import excelDateToString from "./fetcher/dates";
import { CFError } from "./fetcher/errors";

function isOutOfBounds(index: number, length: number) {
  return index < 0 || index >= length;
}

function isEqual(a: Cell, b: Cell): boolean {
  if (a === b) {
    return true;
  }
  try {
    if (excelDateToString(a as string) === excelDateToString(b as string)) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

function findSubArrayIndices(searchSpace: Cell[], items: Cell[][]): number[] {
  return items.flatMap((row) =>
    row.map((item) => {
      const index = searchSpace.findIndex((e) => isEqual(e, item));
      if (index === -1) {
        if (typeof item === "number") {
          if (item > 0 && item < searchSpace.length + 1) return item - 1;
          if (item < 0 && item > -(searchSpace.length + 1))
            return searchSpace.length + item;
          if (item === 0) throw CFError(`'0' is not a valid index`);
          throw CFError(`'${item}' is out of bounds`);
        }
        throw CFError(`'${item}' not found`);
      }
      return index;
    }),
  );
}

function slice(array: Cell[][], indices: number[], dim: "rows" | "columns") {
  const filteredIndices = indices.filter((index) => index !== -1);
  if (filteredIndices.length === 0) {
    throw CFError(`'${dim}' not found`);
  }

  switch (dim) {
    case "columns":
      return array.map((row) =>
        filteredIndices.map((index) => {
          if (isOutOfBounds(index, row.length)) {
            throw CFError(`Columns -> index ${index + 1} is out of bounds`);
          }
          return row[index];
        }),
      );

    case "rows":
      return filteredIndices.map((index) => {
        return array[index];
      });

    default:
      throw CFError(`Invalid dimension: ${dim}`);
  }
}

/**
 * Slices data based on row and column indices or labels.
 * @param array The two-dimensional array to be sliced.
 * @param row Range of row labels or indices.
 * @param column Range of column labels or indices.
 * @returns Sliced data.
 */
export function sliceArray(
  array: Cell[][],
  rows: Cell[][],
  columns: Cell[][],
): Cell[][] {
  let slicedData = array;
  if (columns) {
    const colIndices = findSubArrayIndices(array[0], columns);
    slicedData = slice(array, colIndices, "columns");
  }
  if (rows) {
    const rowIndices = findSubArrayIndices(
      array.map((row) => row[0]),
      rows,
    );
    slicedData = slice(slicedData, rowIndices, "rows");
  }
  return slicedData;
}
