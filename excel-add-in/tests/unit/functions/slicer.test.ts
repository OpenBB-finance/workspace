import { sliceArray } from "~/functions/slicer";

// Tests
describe("sliceArray", () => {
  const originalData = [
    ["a", "b", "c"],
    ["1", "2", "3"],
    ["4", "5", "6"],
  ];

  test("onlyData", () => {
    const actual = sliceArray(originalData, null, null);
    const expected = [
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withRowsPositiveIndices", () => {
    const actual = sliceArray(originalData, [[3, 2]], null);
    const expected = [
      ["4", "5", "6"],
      ["1", "2", "3"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withRowsNegativeIndices", () => {
    const actual = sliceArray(originalData, [[-2]], null);
    const expected = [
      ["1", "2", "3"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withColumnsPositiveIndices", () => {
    const actual = sliceArray(originalData, null, [[1]]);
    const expected = [
      ["a"],
      ["1"],
      ["4"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withColumnsNegativeIndices", () => {
    const actual = sliceArray(originalData, null, [[-1]]);
    const expected = [
      ["c"],
      ["3"],
      ["6"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withRowsAndColumnsIndicesHorizontal", () => {
    const actual = sliceArray(originalData, [[3]], [[1, 2]]);
    const expected = [["4", "5"]];
    expect(actual).toEqual(expected);
  });

  test("withRowsAndColumnsIndicesVertical", () => {
    const actual = sliceArray(originalData, [[2, 3]], [[1]]);
    const expected = [["1"], ["4"]];
    expect(actual).toEqual(expected);
  });

  test("withRowsLabels", () => {
    const actual = sliceArray(originalData, [["a", "4"]], null);
    const expected = [
      ["a", "b", "c"],
      ["4", "5", "6"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withColumnsLabels", () => {
    const actual = sliceArray(originalData, null, [["c", "b"]]);
    const expected = [
      ["c", "b"],
      ["3", "2"],
      ["6", "5"],
    ];
    expect(actual).toEqual(expected);
  });

  test("withRowsAndColumnsLabelsHorizontal", () => {
    const actual = sliceArray(originalData, [["1"]], [["b", "c"]]);
    const expected = [["2", "3"]];
    expect(actual).toEqual(expected);
  });

  test("withRowsAndColumnsLabelsVertical", () => {
    const actual = sliceArray(originalData, [["1", "4"]], [["b"]]);
    const expected = [["2"], ["5"]];
    expect(actual).toEqual(expected);
  });

  test("outOfBoundsPositive", () => {
    expect(() => sliceArray(originalData, [[10]], null)).toThrow(
      "'10' is out of bounds",
    );
  });

  test("outOfBoundsNegative", () => {
    expect(() => sliceArray(originalData, [[-10]], null)).toThrow(
      "'-10' is out of bounds",
    );
  });
});
