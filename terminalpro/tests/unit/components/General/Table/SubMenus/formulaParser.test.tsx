import { describe, expect, it } from "vitest";
import {
  compileExpression,
  expressionToText,
  parseExpression,
  validateTokens,
} from "~/components/General/Table/SubMenus/formulaParser";
import type { Expression } from "~/components/types";

type ColumnInfo = { label: string; value: string };

const COLUMNS: ColumnInfo[] = [
  { label: "Revenue", value: "revenue" },
  { label: "Cost", value: "cost" },
  { label: "Change in Shares", value: "change_in_shares" },
  { label: "Portfolio Weight [%]", value: "portfolio_weight_pct" },
  { label: "Price", value: "price" },
];

// ── expressionToText ──────────────────────────────────────────────────────────

describe("expressionToText", () => {
  it("converts empty expression to empty string", () => {
    expect(expressionToText([], COLUMNS)).toBe("");
  });

  it("converts a single column token", () => {
    const expr: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("[Revenue]");
  });

  it("converts a number token", () => {
    const expr: Expression[] = [{ type: "number", value: "34.5" }];
    expect(expressionToText(expr, COLUMNS)).toBe("34.5");
  });

  it("converts operator tokens with space padding", () => {
    const expr: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("[Revenue] + [Cost]");
  });

  it("converts parenthesis tokens", () => {
    const expr: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("([Revenue] + [Cost]) * 2");
  });

  it("handles columns with brackets in name", () => {
    const expr: Expression[] = [
      {
        type: "column",
        value: "portfolio_weight_pct",
        headerName: "Portfolio Weight [%]",
      },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("[Portfolio Weight [%]]");
  });

  it("falls back to looking up column value when headerName is missing", () => {
    const expr: Expression[] = [{ type: "column", value: "revenue" }];
    expect(expressionToText(expr, COLUMNS)).toBe("[Revenue]");
  });

  it("uses value as-is when headerName missing and column not found", () => {
    const expr: Expression[] = [{ type: "column", value: "unknown_col" }];
    expect(expressionToText(expr, [])).toBe("[unknown_col]");
  });
});

// ── parseExpression ───────────────────────────────────────────────────────────

describe("parseExpression", () => {
  it("parses empty string to empty tokens", () => {
    const result = parseExpression("", COLUMNS);
    expect(result.tokens).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses whitespace-only string to empty tokens", () => {
    const result = parseExpression("   ", COLUMNS);
    expect(result.tokens).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses a single column reference", () => {
    const result = parseExpression("[Revenue]", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      { type: "column", value: "revenue", headerName: "Revenue" },
    ]);
  });

  it("parses a number", () => {
    const result = parseExpression("42", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([{ type: "number", value: "42" }]);
  });

  it("parses a decimal number", () => {
    const result = parseExpression("34.2145", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([{ type: "number", value: "34.2145" }]);
  });

  it("parses operators", () => {
    const result = parseExpression("[Revenue] + [Cost]", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toHaveLength(3);
    expect(result.tokens[1]).toEqual({ type: "operator", value: "+" });
  });

  it("parses all operator types", () => {
    for (const op of ["+", "-", "*", "/"]) {
      const result = parseExpression(`[Revenue] ${op} [Cost]`, COLUMNS);
      expect(result.errors).toEqual([]);
      expect(result.tokens[1]).toEqual({ type: "operator", value: op });
    }
  });

  it("parses parentheses", () => {
    const result = parseExpression("([Revenue] + [Cost]) * 2", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ]);
  });

  it("handles column names with internal brackets", () => {
    const result = parseExpression("[Portfolio Weight [%]]", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      {
        type: "column",
        value: "portfolio_weight_pct",
        headerName: "Portfolio Weight [%]",
      },
    ]);
  });

  it("handles complex expression with bracket-containing column", () => {
    const result = parseExpression(
      "[Change in Shares] + [Portfolio Weight [%]] * 34.2145",
      COLUMNS,
    );
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      {
        type: "column",
        value: "change_in_shares",
        headerName: "Change in Shares",
      },
      { type: "operator", value: "+" },
      {
        type: "column",
        value: "portfolio_weight_pct",
        headerName: "Portfolio Weight [%]",
      },
      { type: "operator", value: "*" },
      { type: "number", value: "34.2145" },
    ]);
  });

  it("returns error for unknown column reference", () => {
    const result = parseExpression("[Unknown Column]", COLUMNS);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Unknown column");
    expect(result.errors[0]).toContain("Unknown Column");
  });

  it("returns error for unexpected character", () => {
    const result = parseExpression("[Revenue] @ [Cost]", COLUMNS);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Unexpected character");
    expect(result.errors[0]).toContain("@");
  });

  it("handles extra whitespace between tokens", () => {
    const result = parseExpression("  [Revenue]   +   [Cost]  ", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toHaveLength(3);
  });

  it("handles no whitespace between tokens", () => {
    const result = parseExpression("[Revenue]+[Cost]", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toHaveLength(3);
    expect(result.tokens[0]).toEqual({
      type: "column",
      value: "revenue",
      headerName: "Revenue",
    });
    expect(result.tokens[1]).toEqual({ type: "operator", value: "+" });
    expect(result.tokens[2]).toEqual({
      type: "column",
      value: "cost",
      headerName: "Cost",
    });
  });

  it("is case-insensitive for column names", () => {
    const result = parseExpression("[revenue]", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      { type: "column", value: "revenue", headerName: "Revenue" },
    ]);
  });

  it("parses number starting with decimal point", () => {
    const result = parseExpression(".5", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([{ type: "number", value: ".5" }]);
  });

  it("handles unmatched opening bracket gracefully", () => {
    const result = parseExpression("[Revenue", COLUMNS);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Unmatched");
  });
});

// ── validateTokens ────────────────────────────────────────────────────────────

describe("validateTokens", () => {
  it("returns no errors for empty tokens array", () => {
    expect(validateTokens([])).toEqual([]);
  });

  it("returns empty errors for valid expression: col op col", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });

  it("returns empty errors for valid expression with parentheses", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });

  it("returns empty errors for single operand", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });

  it("returns error when expression starts with operator", () => {
    const tokens: Expression[] = [
      { type: "operator", value: "+" },
      { type: "column", value: "revenue", headerName: "Revenue" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("start with an operator"))).toBe(true);
  });

  it("returns error when expression ends with operator", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("end with an operator"))).toBe(true);
  });

  it("returns error for two adjacent operands without operator", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Missing operator"))).toBe(true);
  });

  it("returns error for two adjacent operators", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "operator", value: "-" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Consecutive operators"))).toBe(true);
  });

  it("returns error for unbalanced parentheses - more opens", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Unbalanced parentheses"))).toBe(true);
  });

  it("returns error for unbalanced parentheses - more closes", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Unbalanced parentheses"))).toBe(true);
  });

  it("returns error for empty parentheses", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Empty parentheses"))).toBe(true);
  });

  it("returns error for operator after open paren", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "operator", value: "+" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for operator before close paren", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for close paren followed by operand without operator", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
      { type: "number", value: "5" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Missing operator"))).toBe(true);
  });

  it("returns error for operand followed by open paren without operator", () => {
    const tokens: Expression[] = [
      { type: "number", value: "5" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Missing operator"))).toBe(true);
  });

  it("validates nested parentheses", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
      { type: "parenthesis", value: ")" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe("round-trip: expressionToText -> parseExpression", () => {
  it("round-trips a simple expression", () => {
    const original: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    const text = expressionToText(original, COLUMNS);
    const { tokens, errors } = parseExpression(text, COLUMNS);
    expect(errors).toEqual([]);
    expect(tokens).toEqual(original);
  });

  it("round-trips expression with parentheses", () => {
    const original: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    const text = expressionToText(original, COLUMNS);
    const { tokens, errors } = parseExpression(text, COLUMNS);
    expect(errors).toEqual([]);
    expect(tokens).toEqual(original);
  });

  it("round-trips expression with bracket-containing column", () => {
    const original: Expression[] = [
      {
        type: "column",
        value: "change_in_shares",
        headerName: "Change in Shares",
      },
      { type: "operator", value: "+" },
      {
        type: "column",
        value: "portfolio_weight_pct",
        headerName: "Portfolio Weight [%]",
      },
    ];
    const text = expressionToText(original, COLUMNS);
    const { tokens, errors } = parseExpression(text, COLUMNS);
    expect(errors).toEqual([]);
    expect(tokens).toEqual(original);
  });

  it("round-trips a function expression", () => {
    const original: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ];
    const text = expressionToText(original, COLUMNS);
    expect(text).toBe("SUM([Revenue], [Cost])");
    const { tokens, errors } = parseExpression(text, COLUMNS);
    expect(errors).toEqual([]);
    expect(tokens).toEqual(original);
  });
});

// ── expressionToText (functions) ──────────────────────────────────────────────

describe("expressionToText — functions", () => {
  it("converts a function token", () => {
    const expr: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("SUM([Revenue])");
  });

  it("converts separator tokens as comma-space", () => {
    const expr: Expression[] = [
      { type: "function", value: "AVG" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "number", value: "100" },
      { type: "parenthesis", value: ")" },
    ];
    expect(expressionToText(expr, COLUMNS)).toBe("AVG([Revenue], 100)");
  });
});

// ── parseExpression (functions) ───────────────────────────────────────────────

describe("parseExpression — functions", () => {
  it("parses SUM([col1], [col2])", () => {
    const result = parseExpression("SUM([Revenue], [Cost])", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ]);
  });

  it("parses AVG with a number argument", () => {
    const result = parseExpression("AVG([Revenue], 5)", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toEqual([
      { type: "function", value: "AVG" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "number", value: "5" },
      { type: "parenthesis", value: ")" },
    ]);
  });

  it("parses function names case-insensitively", () => {
    const result = parseExpression("sum([Revenue], [Cost])", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens[0]).toEqual({ type: "function", value: "SUM" });
  });

  it("parses function in larger expression", () => {
    const result = parseExpression("SUM([Revenue], [Cost]) * 2", COLUMNS);
    expect(result.errors).toEqual([]);
    expect(result.tokens).toHaveLength(8);
    expect(result.tokens[0]).toEqual({ type: "function", value: "SUM" });
    expect(result.tokens[6]).toEqual({ type: "operator", value: "*" });
    expect(result.tokens[7]).toEqual({ type: "number", value: "2" });
  });

  it("parses comma as separator token", () => {
    const result = parseExpression("SUM([Revenue], [Cost], [Price])", COLUMNS);
    expect(result.errors).toEqual([]);
    const separators = result.tokens.filter((t) => t.type === "separator");
    expect(separators).toHaveLength(2);
  });

  it("returns error for unknown function name", () => {
    const result = parseExpression("UNKNOWN([Revenue])", COLUMNS);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Unknown function");
    expect(result.errors[0]).toContain("UNKNOWN");
  });
});

// ── validateTokens (functions) ────────────────────────────────────────────────

describe("validateTokens — functions", () => {
  it("validates SUM([col], [col]) as valid", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });

  it("validates function in larger expression", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    expect(validateTokens(tokens)).toEqual([]);
  });

  it("returns error when function not followed by open paren", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "column", value: "revenue", headerName: "Revenue" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("must be followed by ("))).toBe(true);
  });

  it("returns error for comma outside function call", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("outside"))).toBe(true);
  });

  it("returns error for empty function args: SUM()", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for trailing comma in function: SUM([col],)", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for leading comma in function: SUM(,[col])", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "separator", value: "," },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("returns error for operand directly before function without operator", () => {
    const tokens: Expression[] = [
      { type: "number", value: "5" },
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "parenthesis", value: ")" },
    ];
    const errors = validateTokens(tokens);
    expect(errors.some((e) => e.includes("Missing operator"))).toBe(true);
  });
});

// ── compileExpression ─────────────────────────────────────────────────────────

describe("compileExpression", () => {
  it("compiles a simple column + column expression", () => {
    const tokens: Expression[] = [
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
    ];
    expect(compileExpression(tokens)).toBe('getValue("revenue") + getValue("cost")');
  });

  it("compiles a number", () => {
    const tokens: Expression[] = [{ type: "number", value: "42" }];
    expect(compileExpression(tokens)).toBe("42");
  });

  it("compiles parentheses", () => {
    const tokens: Expression[] = [
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "operator", value: "+" },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    expect(compileExpression(tokens)).toBe(
      '(getValue("revenue") + getValue("cost")) * 2',
    );
  });

  it("compiles SUM to addition", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ];
    expect(compileExpression(tokens)).toBe('(getValue("revenue") + getValue("cost"))');
  });

  it("compiles AVG to sum divided by count", () => {
    const tokens: Expression[] = [
      { type: "function", value: "AVG" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
    ];
    expect(compileExpression(tokens)).toBe(
      '((getValue("revenue") + getValue("cost")) / 2)',
    );
  });

  it("compiles SUM with 3 args", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "separator", value: "," },
      { type: "number", value: "10" },
      { type: "parenthesis", value: ")" },
    ];
    expect(compileExpression(tokens)).toBe(
      '(getValue("revenue") + getValue("cost") + 10)',
    );
  });

  it("compiles function in larger expression", () => {
    const tokens: Expression[] = [
      { type: "function", value: "SUM" },
      { type: "parenthesis", value: "(" },
      { type: "column", value: "revenue", headerName: "Revenue" },
      { type: "separator", value: "," },
      { type: "column", value: "cost", headerName: "Cost" },
      { type: "parenthesis", value: ")" },
      { type: "operator", value: "*" },
      { type: "number", value: "2" },
    ];
    expect(compileExpression(tokens)).toBe(
      '(getValue("revenue") + getValue("cost")) * 2',
    );
  });

  it("compiles empty tokens to empty string", () => {
    expect(compileExpression([])).toBe("");
  });

  it("escapes double quotes in column ids", () => {
    const tokens: Expression[] = [
      { type: "column", value: 'col"name', headerName: "Col" },
    ];
    expect(compileExpression(tokens)).toBe('getValue("col\\"name")');
  });
});
