import type { Expression } from "~/components/types";

export type ColumnInfo = { label: string; value: string };

export type ParseResult = {
  tokens: Expression[];
  errors: string[];
};

const OPERATORS = new Set(["+", "-", "*", "/"]);

/** Supported formula functions with metadata for the UI dropdown. */
export const FORMULA_FUNCTIONS = [
  {
    name: "SUM",
    description: "Sum of all arguments",
    signature: "SUM(value, value, ...)",
  },
  {
    name: "AVG",
    description: "Average of all arguments",
    signature: "AVG(value, value, ...)",
  },
] as const;

const FUNCTION_NAMES: Set<string> = new Set(FORMULA_FUNCTIONS.map((f) => f.name));

/**
 * Convert an Expression[] array to a human-readable text string.
 * column → [headerName], number → raw value, operator → ` op `,
 * parenthesis → ( or ), function → name, separator → ", "
 */
export function expressionToText(
  expression: Expression[],
  columns: ColumnInfo[],
): string {
  if (expression.length === 0) return "";

  const expressionText = expression.reduce((text, expr) => {
    switch (expr.type) {
      case "column": {
        const name =
          expr.headerName ||
          columns.find((c) => c.value === expr.value)?.label ||
          expr.value;
        return `${text}[${name}]`;
      }
      case "number":
        return text + expr.value;
      case "operator":
        return `${text} ${expr.value} `;
      case "parenthesis":
        return text + expr.value;
      case "function":
        return text + expr.value;
      case "separator":
        return `${text}, `;
      default:
        return text + expr.value;
    }
  }, "");

  return expressionText.trim();
}

/**
 * Tokenize a raw text string into Expression[] tokens.
 * Handles column names with internal brackets (e.g. "Portfolio Weight [%]")
 * by matching against known columns sorted by name length (longest first).
 */
export function parseExpression(text: string, columns: ColumnInfo[]): ParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { tokens: [], errors: [] };

  // Sort columns by label length descending for longest-match-first
  const sortedColumns = [...columns].sort((a, b) => b.label.length - a.label.length);

  const tokens: Expression[] = [];
  const errors: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Skip whitespace
    if (/\s/.test(text[pos])) {
      pos++;
      continue;
    }

    const ch = text[pos];

    // Column reference: [...]
    if (ch === "[") {
      const result = matchColumnAt(text, pos, sortedColumns);
      if (result) {
        tokens.push({
          type: "column",
          value: result.column.value,
          headerName: result.column.label,
        });
        pos = result.endPos;
        continue;
      }

      // No match — extract what's between brackets for the error
      const closeIdx = findClosingBracket(text, pos);
      if (closeIdx === -1) {
        errors.push(`Unmatched opening bracket at position ${pos + 1}`);
        pos = text.length; // skip to end
      } else {
        const name = text.slice(pos + 1, closeIdx);
        errors.push(`Unknown column: [${name}]`);
        pos = closeIdx + 1;
      }
      continue;
    }

    // Parentheses
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "parenthesis", value: ch });
      pos++;
      continue;
    }

    // Comma (separator)
    if (ch === ",") {
      tokens.push({ type: "separator", value: "," });
      pos++;
      continue;
    }

    // Operators
    if (OPERATORS.has(ch)) {
      tokens.push({ type: "operator", value: ch });
      pos++;
      continue;
    }

    // Numbers (digits or leading decimal point)
    if (/[\d.]/.test(ch)) {
      let num = "";
      let hasDot = false;
      while (pos < text.length && /[\d.]/.test(text[pos])) {
        if (text[pos] === ".") {
          if (hasDot) break; // second dot ends the number
          hasDot = true;
        }
        num += text[pos];
        pos++;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Alpha chars: try to match a function name
    if (/[a-zA-Z_]/.test(ch)) {
      let word = "";
      const wordStart = pos;
      while (pos < text.length && /[a-zA-Z_]/.test(text[pos])) {
        word += text[pos];
        pos++;
      }
      const upper = word.toUpperCase();
      if (FUNCTION_NAMES.has(upper)) {
        tokens.push({ type: "function", value: upper });
      } else {
        errors.push(`Unknown function: '${word}' at position ${wordStart + 1}`);
      }
      continue;
    }

    // Unrecognized character
    errors.push(`Unexpected character: '${ch}' at position ${pos + 1}`);
    pos++;
  }

  return { tokens, errors };
}

/**
 * Try to match a column name starting at position `pos` (which should be `[`).
 * Tries longest column name first (columns must be pre-sorted by label length descending).
 */
export function matchColumnAt(
  text: string,
  pos: number,
  sortedColumns: ColumnInfo[],
): { column: ColumnInfo; endPos: number } | null {
  // text[pos] is '[', try to match [columnLabel] starting at pos
  const remaining = text.slice(pos + 1).toLowerCase();

  for (const col of sortedColumns) {
    const lowerLabel = col.label.toLowerCase();
    if (remaining.startsWith(lowerLabel) && text[pos + 1 + col.label.length] === "]") {
      return {
        column: col,
        endPos: pos + 1 + col.label.length + 1, // past the closing ]
      };
    }
  }

  return null;
}

/**
 * Find the first `]` after pos.
 */
function findClosingBracket(text: string, openPos: number): number {
  for (let i = openPos + 1; i < text.length; i++) {
    if (text[i] === "]") return i;
  }
  return -1;
}

/**
 * Validate a token sequence and return an array of error messages.
 * Returns empty array if valid.
 */
export function validateTokens(tokens: Expression[]): string[] {
  if (tokens.length === 0) return [];

  const errors: string[] = [];

  // Check balanced parentheses
  let parenDepth = 0;
  for (const token of tokens) {
    if (token.type === "parenthesis") {
      if (token.value === "(") parenDepth++;
      else parenDepth--;
      if (parenDepth < 0) break;
    }
  }
  if (parenDepth !== 0) {
    errors.push("Unbalanced parentheses");
  }

  // Classify tokens for adjacency checks
  type Role = "operand" | "operator" | "open" | "close" | "function" | "separator";
  function classify(t: Expression): Role {
    if (t.type === "operator") return "operator";
    if (t.type === "separator") return "separator";
    if (t.type === "parenthesis") return t.value === "(" ? "open" : "close";
    if (t.type === "function") return "function";
    return "operand"; // column, number
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  // Starts with operator
  if (first.type === "operator") {
    errors.push("Expression cannot start with an operator");
  }

  // Ends with operator
  if (last.type === "operator") {
    errors.push("Expression cannot end with an operator");
  }

  // Ends with separator
  if (last.type === "separator") {
    errors.push("Expression cannot end with a comma");
  }

  // Track function nesting to validate commas
  // A comma is valid only inside function call parens
  let funcParenDepth = 0;
  const funcParenStack: boolean[] = []; // true if this paren level is a function call

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "function") {
      // Function must be followed by (
      if (
        i + 1 >= tokens.length ||
        tokens[i + 1].type !== "parenthesis" ||
        tokens[i + 1].value !== "("
      ) {
        errors.push(`Function ${token.value} must be followed by (`);
      }
    }

    if (token.type === "parenthesis" && token.value === "(") {
      // Check if previous token was a function
      const isFunc = i > 0 && tokens[i - 1].type === "function";
      funcParenStack.push(isFunc);
      if (isFunc) funcParenDepth++;
    }

    if (token.type === "parenthesis" && token.value === ")") {
      const wasFunc = funcParenStack.pop();
      if (wasFunc) funcParenDepth--;
    }

    if (token.type === "separator") {
      if (funcParenDepth === 0) {
        errors.push("Comma used outside of a function call");
      }
    }
  }

  // Adjacency checks
  for (let i = 0; i < tokens.length - 1; i++) {
    const curr = classify(tokens[i]);
    const next = classify(tokens[i + 1]);

    const tokenDisplay = (t: Expression) =>
      t.type === "column" ? `[${t.headerName || t.value}]` : t.value;

    // Function followed by open paren is valid (skip normal "operand before open" check)
    if (curr === "function" && next === "open") {
      continue;
    }

    // Function NOT followed by open is already reported above, skip
    if (curr === "function") {
      continue;
    }

    // Empty parentheses (but not function parens — those are caught separately)
    if (curr === "open" && next === "close") {
      // Check if this is a function call: SUM()
      if (i > 0 && tokens[i - 1].type === "function") {
        errors.push(`${tokens[i - 1].value}() requires at least one argument`);
      } else {
        errors.push("Empty parentheses");
      }
      continue;
    }

    // Separator followed by close paren: trailing comma SUM([col],)
    if (curr === "separator" && next === "close") {
      errors.push("Trailing comma before )");
      continue;
    }

    // Open paren followed by separator: leading comma SUM(,[col])
    if (curr === "open" && next === "separator") {
      errors.push("Leading comma after (");
      continue;
    }

    // Two separators adjacent
    if (curr === "separator" && next === "separator") {
      errors.push("Empty argument between commas");
      continue;
    }

    // Separator acts like open/close boundary — skip normal adjacency for it
    if (curr === "separator" || next === "separator") {
      // separator followed by operator
      if (curr === "separator" && next === "operator") {
        errors.push("Operator after comma");
      }
      // operator followed by separator
      if (curr === "operator" && next === "separator") {
        errors.push("Comma after operator");
      }
      continue;
    }

    // Two operands adjacent (missing operator)
    if (curr === "operand" && next === "operand") {
      errors.push(
        `Missing operator between ${tokenDisplay(tokens[i])} and ${tokenDisplay(tokens[i + 1])}`,
      );
    }

    // Operand followed by open paren (missing operator)
    if (curr === "operand" && next === "open") {
      errors.push("Missing operator before (");
    }

    // Operand followed by function (missing operator)
    if (curr === "operand" && next === "function") {
      errors.push(`Missing operator before ${tokens[i + 1].value}`);
    }

    // Close paren followed by operand (missing operator)
    if (curr === "close" && next === "operand") {
      errors.push("Missing operator after )");
    }

    // Close paren followed by open paren (missing operator)
    if (curr === "close" && next === "open") {
      errors.push("Missing operator between ) and (");
    }

    // Close paren followed by function (missing operator)
    if (curr === "close" && next === "function") {
      errors.push(`Missing operator before ${tokens[i + 1].value}`);
    }

    // Two operators adjacent
    if (curr === "operator" && next === "operator") {
      errors.push(`Consecutive operators: ${tokens[i].value} ${tokens[i + 1].value}`);
    }

    // Operator after open paren
    if (curr === "open" && next === "operator") {
      errors.push("Operator after opening parenthesis");
    }

    // Operator before close paren
    if (curr === "operator" && next === "close") {
      errors.push("Operator before closing parenthesis");
    }
  }

  return errors;
}

/**
 * Compile an Expression[] into an AG Grid valueGetter string.
 * Handles functions (SUM, AVG) by inlining their logic.
 */
export function compileExpression(tokens: Expression[]): string {
  if (tokens.length === 0) return "";
  return compileTokens(tokens, 0, tokens.length).result;
}

function compileTokens(
  tokens: Expression[],
  start: number,
  end: number,
): { result: string; nextIdx: number } {
  let result = "";
  let i = start;

  while (i < end) {
    const token = tokens[i];

    if (token.type === "function") {
      const funcName = token.value;
      // Skip past function name and opening paren
      i += 2; // skip function token and "(" token

      // Find matching ")" respecting nesting
      const { args, closeIdx } = collectFunctionArgs(tokens, i, end);

      // Compile each argument
      const compiledArgs = args.map((arg) => compileTokens(arg, 0, arg.length).result);

      if (funcName === "SUM") {
        result += `(${compiledArgs.join(" + ")})`;
      } else if (funcName === "AVG") {
        result += `((${compiledArgs.join(" + ")}) / ${compiledArgs.length})`;
      }

      i = closeIdx + 1; // skip past ")"
      continue;
    }

    if (token.type === "column") {
      const escaped = token.value.replace(/"/g, '\\"');
      result += `getValue("${escaped}")`;
    } else if (token.type === "number") {
      result += token.value;
    } else if (token.type === "operator") {
      result += ` ${token.value} `;
    } else if (token.type === "parenthesis") {
      result += token.value;
    }

    i++;
  }

  return { result, nextIdx: i };
}

/**
 * Collect function arguments from tokens starting after the opening paren.
 * Returns arrays of token subarrays (one per argument) and the close paren index.
 */
function collectFunctionArgs(
  tokens: Expression[],
  start: number,
  end: number,
): { args: Expression[][]; closeIdx: number } {
  const args: Expression[][] = [];
  let currentArg: Expression[] = [];
  let depth = 0;

  for (let i = start; i < end; i++) {
    const token = tokens[i];

    if (token.type === "parenthesis" && token.value === "(") {
      depth++;
      currentArg.push(token);
      continue;
    }

    if (token.type === "parenthesis" && token.value === ")") {
      if (depth === 0) {
        // This is the matching close paren for our function
        if (currentArg.length > 0) {
          args.push(currentArg);
        }
        return { args, closeIdx: i };
      }
      depth--;
      currentArg.push(token);
      continue;
    }

    if (token.type === "separator" && depth === 0) {
      // Top-level comma — split argument
      args.push(currentArg);
      currentArg = [];
      continue;
    }

    currentArg.push(token);
  }

  // If we get here, there's no matching close paren (validation will catch this)
  if (currentArg.length > 0) {
    args.push(currentArg);
  }
  return { args, closeIdx: end - 1 };
}
