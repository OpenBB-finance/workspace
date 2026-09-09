import transformData from "~/functions/fetcher/transform";

describe("transformData", () => {

  test("null", () => {
    const input = null;
    expect(() => {
      transformData(input);
    }).toThrowError("Data not found");
  });

  test("empty1", () => {
    const input = {};
    expect(() => {
      transformData(input);
    }).toThrowError("Data not found");
  });

  test("empty2", () => {
    const input: any[] = [];
    expect(() => {
      transformData(input);
    }).toThrowError("Data not found");
  });

  test("full", () => {
    const input = { a: [1, 2, 3], b: [4, 5, 6] };
    const expected = [
      ["a", "b"],
      [1, 4],
      [2, 5],
      [3, 6],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("partial1", () => {
    const input = { a: [1, 2, 3], b: [4] };
    const expected = [
      ["a", "b"],
      [1, 4],
      [2, ""],
      [3, ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("partial2", () => {
    const input = { a: [1, 2, 3], b: [4], c: [5, "", 6] };
    const expected = [
      ["a", "b", "c"],
      [1, 4, 5],
      [2, "", ""],
      [3, "", 6],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("mixed1", () => {
    const input = { a: [1, 2, 3], b: 4 };
    const expected = [
      ["a", "b"],
      [1, 4],
      [2, ""],
      [3, ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("mixed2", () => {
    const input = { a: 1, b: [4, 5, 6], c: [7] };
    const expected = [
      ["a", "b", "c"],
      [1, 4, 7],
      ["", 5, ""],
      ["", 6, ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("objectWithNulls", () => {
    const input = { a: [1, null, 3], b: [4, 5, null] };
    const expected = [
      ["a", "b"],
      [1, 4],
      ["", 5],
      [3, ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("nested", () => {
    const input = { a: ["str", [2.25, 2.5, 2.75], 3], b: { c: [4, 5, 6] } };
    const expected = [
      ["a", "b"],
      ["str", '{"c":[4,5,6]}'],
      ["[2.25,2.5,2.75]", ""],
      [3, ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("array1", () => {
    const input: any[] = ["a", 2, 3, { c: [4, 5, 6] }];
    const expected = [["a", 2, 3, '{"c":[4,5,6]}']];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("array2", () => {
    const input: any[] = [null, 2, 3, { c: [4, 5, 6] }];
    const expected = [["", 2, 3, '{"c":[4,5,6]}']];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("array3", () => {
    const input: any[] = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    const expected = [
      ["a", "b"],
      [1, 2],
      [3, 4],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("arrayWithNulls", () => {
    const input: any[] = [
      { a: 1, b: null },
      { a: null, b: 4 },
    ];
    const expected = [
      ["a", "b"],
      [1, ""],
      ["", 4],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("arrayWithEmptyCols", () => {
    const input: any[] = [
      { a: 1, b: null, c: 3, d: null, e: 99 },
      { a: 5, b: null, c: null, d: null },
    ];
    const expected = [
      ["a", "c", "e"],
      [1, 3, 99],
      [5, "", ""],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });

  test("arrayWithDates", () => {
    const input: any[] = [
      { date: "2023-11-10", a: 0 },
      { date: "2023-11-13T00:00:00", a: 2 },
      { date: "2021-09-01T08:02:24", a: 4 },
    ];
    const expected = [
      ["date", "a"],
      [
        {
          basicValue: 45240,
          numberFormat: "m/d/yyyy",
          type: "FormattedNumber",
        },
        0,
      ],
      [
        {
          basicValue: 45243,
          numberFormat: "m/d/yyyy",
          type: "FormattedNumber",
        },
        2,
      ],
      [
        {
          basicValue: 44440.335,
          numberFormat: "m/d/yyyy",
          type: "FormattedNumber",
        },
        4,
      ],
    ];
    const actual = transformData(input);
    expect(actual).toEqual(expected);
  });
});
