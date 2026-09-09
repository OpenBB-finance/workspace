import { describe, expect, it } from "vitest";
import {
  convertToReadableLabel,
  determineFilterType,
  formatDate,
  formatTime,
  getColumnDefs,
  getQuarterColumnDefs,
  inferChartDataType,
  isBigNumber,
  isDate,
  isDateTime,
  isDateorYearField,
  isLink,
} from "~/components/General/Table/AgGridUtils";

describe("isDate", () => {
  it("returns true for valid date string in ISO format", () => {
    expect(isDate("2024-01-15")).toBe(true);
  });

  it("returns false for invalid date string", () => {
    expect(isDate("not-a-date")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isDate(12345)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDate(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isDate(undefined)).toBe(false);
  });
});

describe("isDateTime", () => {
  it("returns true for valid datetime string", () => {
    expect(isDateTime("2024-01-15 10:30:00")).toBe(true);
  });

  it("returns true for datetime with milliseconds", () => {
    expect(isDateTime("2024-01-15 10:30:00.123456")).toBe(true);
  });

  it("returns false for date without time", () => {
    expect(isDateTime("2024-01-15")).toBe(false);
  });

  it("returns false for invalid string", () => {
    expect(isDateTime("not-a-datetime")).toBe(false);
  });
});

describe("isDateorYearField", () => {
  it("returns true for field containing 'date'", () => {
    expect(isDateorYearField("publish_date")).toBe(true);
  });

  it("returns true for field containing 'year'", () => {
    expect(isDateorYearField("fiscal_year")).toBe(true);
  });

  it("returns true for field containing 'day'", () => {
    expect(isDateorYearField("trading_day")).toBe(true);
  });

  it("returns false for unrelated field", () => {
    expect(isDateorYearField("price")).toBe(false);
  });

  it("returns true for field starting with 'date'", () => {
    expect(isDateorYearField("date")).toBe(true);
  });
});

describe("isBigNumber", () => {
  it("returns true for very large positive number", () => {
    expect(isBigNumber(1e16)).toBe(true);
  });

  it("returns true for very large negative number", () => {
    expect(isBigNumber(-2000000)).toBe(true);
  });

  it("returns true for number just over 1 million", () => {
    expect(isBigNumber(1000001)).toBe(true);
  });

  it("returns false for number at 1 million", () => {
    expect(isBigNumber(1000000)).toBe(false);
  });

  it("returns false for regular number", () => {
    expect(isBigNumber(12345)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isBigNumber("12345")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isBigNumber(null)).toBe(false);
  });
});

describe("isLink", () => {
  it("returns true for http URL", () => {
    expect(isLink("http://example.com")).toBe(true);
  });

  it("returns true for https URL", () => {
    expect(isLink("https://example.com/path")).toBe(true);
  });

  it("returns false for regular string", () => {
    expect(isLink("not a link")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isLink(12345)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLink(null)).toBe(false);
  });
});

describe("formatDate", () => {
  it("formats date with default template", () => {
    const result = formatDate("2024-01-15");
    expect(result).toBe("2024-01-15");
  });

  it("formats date with custom template", () => {
    const result = formatDate("2024-01-15", "MMM D, YYYY");
    expect(result).toBe("Jan 15, 2024");
  });

  it("handles Date object", () => {
    const result = formatDate(new Date("2024-01-15"));
    expect(result).toBe("2024-01-15");
  });
});

describe("formatTime", () => {
  it("formats datetime to 12-hour time string with AM/PM", () => {
    const result = formatTime("2024-01-15 14:30:00");
    expect(result).toBe("02:30 PM");
  });

  it("formats morning time correctly", () => {
    const result = formatTime("2024-01-15 09:15:00");
    expect(result).toBe("09:15 AM");
  });
});

describe("convertToReadableLabel", () => {
  it("converts snake_case to Title Case", () => {
    expect(convertToReadableLabel("market_cap")).toBe("Market Cap");
  });

  it("converts camelCase to Title Case", () => {
    expect(convertToReadableLabel("marketCap")).toBe("Market Cap");
  });

  it("handles single word", () => {
    expect(convertToReadableLabel("price")).toBe("Price");
  });

  it("handles all caps abbreviations", () => {
    expect(convertToReadableLabel("EPS")).toBe("EPS");
  });

  it("handles multiple underscores", () => {
    expect(convertToReadableLabel("price_to_earnings_ratio")).toBe(
      "Price To Earnings Ratio",
    );
  });
});

describe("determineFilterType", () => {
  it("returns number filter for numeric data", () => {
    expect(determineFilterType("number", "price", 100)).toBe("agNumberColumnFilter");
  });

  it("returns date filter for date fields", () => {
    expect(determineFilterType("text", "date", "2024-01-15")).toBe(
      "agDateColumnFilter",
    );
  });

  it("returns text filter for text data", () => {
    expect(determineFilterType("text", "name", "Apple")).toBe("agTextColumnFilter");
  });

  it("returns text filter when cellDataType is undefined", () => {
    expect(determineFilterType(undefined, "description", "test")).toBe(
      "agTextColumnFilter",
    );
  });
});

describe("inferChartDataType", () => {
  it("returns category for string value", () => {
    expect(inferChartDataType("Apple")).toBe("category");
  });

  it("returns series for numeric value", () => {
    expect(inferChartDataType(123.45)).toBe("series");
  });

  it("returns category when isDateCol is true", () => {
    expect(inferChartDataType("2024-01-15", { isDateCol: true })).toBe("category");
  });

  it("returns category when isIndex is true", () => {
    expect(inferChartDataType("Index Value", { isIndex: true })).toBe("category");
  });

  it("returns category for boolean", () => {
    expect(inferChartDataType(true)).toBe("category");
  });
});

describe("getColumnDefs", () => {
  const mockWidget = {
    widgetId: "test-widget",
    external: false,
    storage: { enableAdvanced: false },
    data: {
      table: {
        columnsDefs: [],
        transpose: false,
      },
    },
  };

  it("generates column definitions from data array", () => {
    const data = [
      { name: "Apple", price: 150, volume: 1000000 },
      { name: "Microsoft", price: 350, volume: 2000000 },
    ];

    const result = getColumnDefs(data, mockWidget as any);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((col) => col.field === "name")).toBe(true);
    expect(result.some((col) => col.field === "price")).toBe(true);
  });

  it("handles empty data array", () => {
    const result = getColumnDefs([], mockWidget as any);
    expect(result).toEqual([]);
  });

  it("handles single object data", () => {
    const data = { name: "Apple", price: 150 };
    const result = getColumnDefs(data, mockWidget as any);
    expect(result.length).toBeGreaterThan(0);
  });

  it("uses custom column definitions from widget", () => {
    const data = [{ name: "Apple", price: 150 }];
    const widgetWithCols = {
      ...mockWidget,
      data: {
        table: {
          columnsDefs: [{ field: "name", headerName: "Company Name", width: 200 }],
        },
      },
    };

    const result = getColumnDefs(data, widgetWithCols as any);
    const nameCol = result.find((col) => col.field === "name");
    expect(nameCol?.headerName).toBe("Company Name");
  });

  it("sets correct filter type for numeric columns", () => {
    const data = [{ price: 150.25, volume: 1000000 }];
    const result = getColumnDefs(data, mockWidget as any);

    const priceCol = result.find((col) => col.field === "price");
    expect(priceCol?.filter).toBe("agNumberColumnFilter");
  });

  it("sets correct filter type for date columns", () => {
    const data = [{ date: "2024-01-15", price: 150 }];
    const result = getColumnDefs(data, mockWidget as any);

    const dateCol = result.find((col) => col.field === "date");
    expect(dateCol?.filter).toBe("agDateColumnFilter");
  });

  it("enables row grouping for advanced mode", () => {
    const data = [{ name: "Apple", category: "Tech", price: 150 }];
    const advancedWidget = {
      ...mockWidget,
      storage: { enableAdvanced: true },
    };

    const result = getColumnDefs(data, advancedWidget as any);

    // Check that category columns have enableRowGroup
    const categoryCol = result.find((col) => col.chartDataType === "category");
    expect(categoryCol?.enableRowGroup).toBe(true);
  });

  it("respects decimal places parameter", () => {
    const data = [{ price: 123.456789 }];
    const result = getColumnDefs(data, mockWidget as any, 4);

    expect(result.length).toBeGreaterThan(0);
  });

  it("applies global formatterFn to columns without explicit formatterFn", () => {
    const data = [{ name: "Apple", price: 150, volume: 1000000 }];
    const widgetWithGlobalFormatter = {
      ...mockWidget,
      data: {
        table: {
          columnsDefs: [
            { field: "name", headerName: "Name" },
            { field: "price", headerName: "Price" },
          ],
          formatterFn: "percent",
        },
      },
    };

    const result = getColumnDefs(data, widgetWithGlobalFormatter as any);

    // Columns with explicit defs but no formatterFn should get the global formatter
    const priceCol = result.find((col) => col.field === "price");
    expect((priceCol?.cellRendererParams as any)?.widgetColDefs?.price?.formatterFn).toBe(
      "percent",
    );

    // Columns without explicit defs should also get the global formatter
    const volumeCol = result.find((col) => col.field === "volume");
    expect(
      (volumeCol?.cellRendererParams as any)?.widgetColDefs?.volume?.formatterFn,
    ).toBe("percent");
  });

  it("does not override column-level formatterFn with global formatterFn", () => {
    const data = [{ name: "Apple", price: 150 }];
    const widgetWithBothFormatters = {
      ...mockWidget,
      data: {
        table: {
          columnsDefs: [
            { field: "price", headerName: "Price", formatterFn: "int" },
          ],
          formatterFn: "percent",
        },
      },
    };

    const result = getColumnDefs(data, widgetWithBothFormatters as any);

    // Column-level formatterFn should take precedence
    const priceCol = result.find((col) => col.field === "price");
    expect((priceCol?.cellRendererParams as any)?.widgetColDefs?.price?.formatterFn).toBe(
      "int",
    );
  });

  it("does not apply formatterFn when global formatterFn is not set", () => {
    const data = [{ name: "Apple", price: 150 }];

    const result = getColumnDefs(data, mockWidget as any);

    const priceCol = result.find((col) => col.field === "price");
    expect(
      (priceCol?.cellRendererParams as any)?.widgetColDefs?.price?.formatterFn,
    ).toBeUndefined();
  });
});

describe("getQuarterColumnDefs", () => {
  it("groups columns by quarter", () => {
    const rowData = [{ Index: "Revenue", "2024-01-15": 100, "2024-04-15": 110 }];
    const columnDefs = [
      { field: "Index", headerName: "Index" },
      { field: "2024-01-15", headerName: "2024-01-15" },
      { field: "2024-04-15", headerName: "2024-04-15" },
    ];

    const result = getQuarterColumnDefs(rowData, columnDefs as any);

    expect(result.length).toBeGreaterThan(0);
  });

  it("handles empty row data", () => {
    const result = getQuarterColumnDefs([], []);
    expect(result).toEqual([]);
  });

  it("preserves non-date columns", () => {
    const rowData = [{ Index: "Revenue", text_column: "value" }];
    const columnDefs = [
      { field: "Index", headerName: "Index" },
      { field: "text_column", headerName: "Text Column" },
    ];

    const result = getQuarterColumnDefs(rowData, columnDefs as any);
    expect(result.some((col: any) => col.field === "Index")).toBe(true);
  });

  it("can reverse column order", () => {
    const rowData = [{ Index: "Revenue", "2024-01-15": 100, "2024-04-15": 110 }];
    const columnDefs = [
      { field: "Index", headerName: "Index" },
      { field: "2024-01-15", headerName: "2024-01-15" },
      { field: "2024-04-15", headerName: "2024-04-15" },
    ];

    const normalResult = getQuarterColumnDefs(rowData, columnDefs as any, false);
    const reversedResult = getQuarterColumnDefs(rowData, columnDefs as any, true);

    // Both should have the same number of columns
    expect(normalResult.length).toBe(reversedResult.length);
  });
});

describe("Edge Cases", () => {
  it("handles null values in data", () => {
    const data = [{ name: null, price: 150 }];
    const mockWidget = {
      widgetId: "test",
      data: { table: { columnsDefs: [] } },
    };

    const result = getColumnDefs(data, mockWidget as any);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles undefined values in data", () => {
    const data = [{ name: undefined, price: 150 }];
    const mockWidget = {
      widgetId: "test",
      data: { table: { columnsDefs: [] } },
    };

    const result = getColumnDefs(data, mockWidget as any);
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles mixed data types in same column", () => {
    const data = [{ value: 100 }, { value: "text" }, { value: null }];
    const mockWidget = {
      widgetId: "test",
      data: { table: { columnsDefs: [] } },
    };

    const result = getColumnDefs(data, mockWidget as any);
    expect(result.some((col) => col.field === "value")).toBe(true);
  });
});

describe("getColumnDefs sparkline valueGetter", () => {
  // AG Grid's agSparklineCellRenderer throws on a null cell value (null.length),
  // which crashes the whole widget via the error boundary. The renderer reads
  // params.value, which AG Grid computes from the TOP-LEVEL colDef.valueGetter —
  // a valueGetter inside cellRendererParams is ignored. It must coerce any
  // non-array value to [] so a row without data renders empty instead.
  const getSparklineValueGetter = (sparkline: object) => {
    const widget = {
      widgetId: "test-widget",
      external: false,
      storage: { enableAdvanced: false },
      data: {
        table: {
          columnsDefs: [{ field: "weekly_prices", sparkline }],
        },
      },
    };
    const data = [
      { symbol: "RS", weekly_prices: [1, 2, 3], history: [1, 2, 3] },
      { symbol: "NUE", weekly_prices: null, history: null },
    ];

    const result = getColumnDefs(data, widget as any);
    const col = result.find((c) => c.field === "weekly_prices");
    return col?.valueGetter as ((params: any) => unknown) | undefined;
  };

  it("returns [] when the dataField value is null", () => {
    const valueGetter = getSparklineValueGetter({
      type: "line",
      dataField: "history",
    });

    expect(valueGetter?.({ data: { symbol: "NUE", history: null } })).toEqual([]);
  });

  it("returns [] when the column field value is null and no dataField is set", () => {
    const valueGetter = getSparklineValueGetter({ type: "line" });

    expect(valueGetter?.({ data: { symbol: "NUE", weekly_prices: null } })).toEqual(
      [],
    );
  });

  it("returns [] when row data is missing", () => {
    const valueGetter = getSparklineValueGetter({
      type: "line",
      dataField: "history",
    });

    expect(valueGetter?.({ data: undefined })).toEqual([]);
  });

  it("returns [] for non-array values like strings and objects", () => {
    const valueGetter = getSparklineValueGetter({
      type: "line",
      dataField: "history",
    });

    expect(valueGetter?.({ data: { history: "N/A" } })).toEqual([]);
    expect(valueGetter?.({ data: { history: { close: 1 } } })).toEqual([]);
  });

  it("passes through valid array data unchanged", () => {
    const valueGetter = getSparklineValueGetter({
      type: "line",
      dataField: "history",
    });

    expect(valueGetter?.({ data: { history: [1, 2, 3] } })).toEqual([1, 2, 3]);
  });
});
