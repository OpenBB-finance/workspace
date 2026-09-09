import type {
  IToolPanelParams,
  ModelUpdatedEvent,
  ToolPanelDef,
} from "ag-grid-enterprise";

import {
  type ChangeEvent,
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebounceValue } from "usehooks-ts";
import { Button } from "~/components/ds/atoms/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ds/atoms/DropdownMenu";
import { Input } from "~/components/ds/atoms/Input";
import { Label, Message } from "~/components/ds/atoms/Label";
import { Select } from "~/components/ds/atoms/Select";
import Icon from "~/components/Icon";
import type { Formula } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { cn, uuidv4 } from "~/lib/utils";
import {
  type ColumnInfo,
  expressionToText,
  FORMULA_FUNCTIONS,
  matchColumnAt,
  parseExpression,
  validateTokens,
} from "./formulaParser";

export interface FormulasToolPanelProps extends IToolPanelParams {}

type FormulaT = Formula & { isNew?: boolean };

type Columns = { label: string; value: string }[];

function createColumnsList(api: IToolPanelParams["api"]) {
  const cols = api.getColumns();
  if (!cols) return [];
  return cols.reduce((acc, col) => {
    const colDef = col.getColDef();
    if (!(colDef.cellDataType === "number" || colDef.chartDataType === "series"))
      return acc; // Skip non-numeric/non-series columns for formula builder
    const colId = col.getColId();
    acc.push({
      label: colDef.headerName || colId,
      value: colId,
    });
    return acc;
  }, [] as Columns);
}

function createEmptyFormula(): FormulaT {
  return {
    id: uuidv4(),
    name: "",
    isNew: true,
    expression: [],
  };
}

type FormulaState = {
  formulas: Record<string, FormulaT>;
  selectedFormula: FormulaT | null;
  inPivotMode?: boolean;
};

const FormulasToolPanel = forwardRef<unknown, FormulasToolPanelProps>((props, ref) => {
  const [columns, setColumns] = useState(() => createColumnsList(props.api));
  const updateWidget = useWidgetContext().updateWidget;
  const widgetFormulas: Formula[] = useWidgetContext().widget.storage?.formulas || [];

  // Track formulas as a record for easy lookup
  // Auto-create a new formula if none exist
  const [state, dispatch] = useStateReducer<FormulaState>(null, () => {
    let formulas: Record<string, FormulaT>;
    let selectedFormula: FormulaT | null = null;

    if (widgetFormulas.length === 0) {
      const newFormula = createEmptyFormula();
      formulas = { [newFormula.id]: newFormula };
      selectedFormula = { ...newFormula };
    } else {
      formulas = widgetFormulas.reduce(
        (acc, formula) => {
          acc[formula.id] = formula;
          return acc;
        },
        {} as Record<string, FormulaT>,
      );
      selectedFormula = { ...widgetFormulas[0] };
    }

    return { formulas, selectedFormula, inPivotMode: props.api.isPivotMode() };
  });

  const updateColumns = useCallback((event: ModelUpdatedEvent) => {
    setColumns(createColumnsList(event.api));
    dispatch({
      inPivotMode: event.api.isPivotMode(),
      // Trigger re-render to update column references
      selectedFormula: (prev) => (prev ? { ...prev } : null),
    });
    return true;
  }, []);

  // AG Grid requires tool panels to implement refresh method
  useImperativeHandle(ref, () => ({
    refresh: updateColumns,
  }));

  useEffect(() => {
    props.api.addEventListener("modelUpdated", updateColumns);

    return () => {
      if (!props.api.isDestroyed()) {
        props.api.removeEventListener("modelUpdated", updateColumns);
      }
    };
  }, []);

  const setSelectedFormula = useCallback((selectedFormulaId: string) => {
    dispatch((prev) => {
      const formula = prev.formulas[selectedFormulaId] || null;
      if (!formula) return prev; // Invalid ID, ignore
      return { ...prev, selectedFormula: { ...formula } };
    });
  }, []);

  // Get the active formula being edited

  // Derived list of formula options for the dropdown
  const formulaOptions = useMemo(() => {
    return Object.values(state.formulas).map((f) => ({
      label: f.name || "Untitled",
      value: f.id,
    }));
  }, [state.formulas]);

  const onNewFormula = useCallback(() => {
    const newFormula = createEmptyFormula();
    dispatch({
      selectedFormula: { ...newFormula },
      formulas: (prev) => ({ ...prev, [newFormula.id]: newFormula }),
    });
  }, [dispatch]);

  const onSaveFormula = useCallback(() => {
    if (!state.selectedFormula) return;

    const { isNew, ...formula } = state.selectedFormula;

    // Update local state (remove isNew flag)
    dispatch({
      formulas: (prev) => ({
        ...prev,
        [formula.id]: formula,
      }),
    });

    // Persist to widget storage
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        formulas: isNew
          ? [...(prev.storage?.formulas || []), formula]
          : prev.storage?.formulas.map((f) => (f.id === formula.id ? formula : f)),
      },
    }));
  }, [state.selectedFormula, updateWidget]);

  // Directly update the active formula in state
  const setActiveFormula = useCallback(
    (updater: (prev: FormulaT) => FormulaT) => dispatch({ selectedFormula: updater }),
    [dispatch],
  );

  const onDeleteFormula = useCallback(() => {
    const { selectedFormula, formulas } = state;
    if (!selectedFormula?.id) return;

    const formulaToDelete = formulas[selectedFormula.id];
    const isNewFormula = formulaToDelete?.isNew;

    // Remove from widget storage if it was saved
    if (!isNewFormula) {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          formulas:
            prev.storage?.formulas?.filter((f) => f.id !== selectedFormula.id) || [],
        },
      }));
    }

    // Atomically remove formula and select next (or create empty) in one state update
    dispatch((prev) => {
      const { [selectedFormula.id]: _, ...rest } = prev.formulas;
      const remaining = Object.keys(rest);

      if (remaining.length > 0) {
        return { formulas: rest, selectedFormula: { ...rest[remaining[0]] } };
      }

      const newFormula = createEmptyFormula();
      return {
        formulas: { ...rest, [newFormula.id]: newFormula },
        selectedFormula: { ...newFormula },
      };
    });
  }, [state, updateWidget]);

  const isSaveDisabled = useMemo(() => {
    if (!state.selectedFormula) return true;
    if (state.selectedFormula.name.trim() === "") return true;
    if (state.selectedFormula.expression.length === 0) return true;
    const errors = validateTokens(state.selectedFormula.expression);
    return errors.length > 0;
  }, [state.selectedFormula]);

  // Disable "New Formula" if the current formula is unsaved (isNew)
  const isNewFormulaDisabled = state.selectedFormula?.isNew === true;

  // Get the active formula being edited
  const [activeFormulaDebounced] = useDebounceValue(state.selectedFormula, 200);

  const activeFormula =
    activeFormulaDebounced?.id === state.selectedFormula?.id
      ? activeFormulaDebounced
      : null;

  return (
    <div className="flex-1 overflow-y-auto w-full bg-white dark:bg-dark-900">
      <div className="p-4 flex flex-col gap-4">
        {/* Header Row: Formula Dropdown + Delete/New/Save Buttons */}
        <div className="flex items-center gap-2">
          {/* Formula Selector - using DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild={true}>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-light-900 dark:text-light-100 hover:text-brand-main dark:hover:text-brand-lighter transition-colors"
              >
                {state.selectedFormula?.name || (
                  <span className="text-light-400 dark:text-dark-400">Untitled</span>
                )}
                <Icon id="chevron-down" className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {formulaOptions.map((option) => (
                <FormulaSelectItem
                  key={option.value}
                  option={option}
                  isSelected={option.value === state.selectedFormula?.id}
                  onSelect={setSelectedFormula}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="xs"
            icon={true}
            onClick={onDeleteFormula}
            title="Delete Formula"
            className="text-light-500 hover:text-alert-error dark:text-light-400"
          >
            <Icon id="trash-icon" className="size-4" />
          </Button>

          <Button
            variant="outlined"
            size="sm"
            onClick={onNewFormula}
            disabled={isNewFormulaDisabled}
          >
            New
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSaveFormula}
            disabled={isSaveDisabled}
          >
            Save
          </Button>
        </div>

        {activeFormula && (
          <FormulaEditor
            formula={activeFormula}
            columns={columns}
            setFormula={setActiveFormula}
          />
        )}
      </div>
    </div>
  );
});

interface FormulaEditorProps {
  formula: FormulaT;
  columns: Columns;
  setFormula: (updater: (prev: FormulaT) => FormulaT) => void;
}

const FormulaEditor = memo(({ formula, columns, setFormula }: FormulaEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch] = useStateReducer(null, () => {
    const text = expressionToText(formula.expression, columns);
    const state = { formula, text, validationErrors: [] as string[] };
    if (text.trim() === "") return state;
    const { tokens, errors } = parseExpression(text, columns);
    state.validationErrors = errors.length > 0 ? errors : validateTokens(tokens);
    return state;
  });

  useEffect(
    () => setFormula((prev) => ({ ...prev, ...state.formula })),
    [state.formula],
  );

  const parseAndUpdate = useCallback(
    (newText: string) => {
      const update = { text: newText, validationErrors: [] as string[] };
      const trimmed = newText.trim();
      if (trimmed === "")
        return dispatch({
          ...update,
          formula: (prev) => ({ ...prev, expression: [] }),
        });
      const { tokens, errors: parseErrors } = parseExpression(newText, columns);
      update.validationErrors =
        parseErrors.length > 0 ? parseErrors : validateTokens(tokens);
      dispatch({ ...update, formula: (prev) => ({ ...prev, expression: tokens }) });
    },
    [columns, dispatch],
  );

  const onTextChange = useCallback(
    (value: string) => parseAndUpdate(value),
    [parseAndUpdate],
  );

  const insertAtCursor = useCallback(
    (insertText: string) => {
      const text = state.text;
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? text.length;
      const end = textarea?.selectionEnd ?? text.length;
      const newText = text.slice(0, start) + insertText + text.slice(end);

      parseAndUpdate(newText);

      // Restore cursor after insert
      requestAnimationFrame(() => {
        if (textarea) {
          const newPos = start + insertText.length;
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
          textarea.focus();
        }
      });
    },
    [state.text, parseAndUpdate],
  );

  const onNameChange = useCallback(
    (name: string) => {
      dispatch({ formula: (prev) => ({ ...prev, name }) });
      if (inputRef.current) {
        inputRef.current.value = name;
      }
    },

    [inputRef],
  );

  const addColumn = useCallback(
    (colId: string) => {
      const column = columns.find((col) => col.value === colId);
      if (column) {
        insertAtCursor(`[${column.label}]`);
      }
    },
    [columns, insertAtCursor],
  );

  const addOperation = useCallback(
    (value: string) => {
      insertAtCursor(` ${value} `);
    },
    [insertAtCursor],
  );

  const addFunction = useCallback(
    (name: string) => {
      const text = state.text;
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? text.length;
      const end = textarea?.selectionEnd ?? text.length;
      const insert = `${name}()`;
      const newText = text.slice(0, start) + insert + text.slice(end);

      parseAndUpdate(newText);

      // Place cursor between the parens
      requestAnimationFrame(() => {
        if (textarea) {
          const cursorPos = start + name.length + 1; // after "("
          textarea.selectionStart = cursorPos;
          textarea.selectionEnd = cursorPos;
          textarea.focus();
        }
      });
    },
    [state.text, parseAndUpdate],
  );

  const clearExpression = useCallback(() => {
    dispatch({
      text: "",
      validationErrors: [],
      formula: (prev) => ({ ...prev, expression: [] }),
    });
  }, [dispatch]);

  const columnOptions = useMemo(
    () => columns.map((col) => ({ label: col.label, value: col.value })),
    [columns],
  );

  const hasErrors = state.validationErrors.length > 0;

  // Detect which functions are used in the expression to show syntax hints
  const functionHints = useMemo(() => {
    const usedFunctions = new Set(
      state.formula.expression.filter((t) => t.type === "function").map((t) => t.value),
    );
    if (usedFunctions.size === 0) return [];
    return FORMULA_FUNCTIONS.filter((fn) => usedFunctions.has(fn.name));
  }, [state.formula.expression]);

  return (
    <>
      {/* Name Input */}
      <Input
        ref={inputRef}
        label="Name"
        placeholder="Formula Name"
        defaultValue={state.formula.name}
        onChange={onNameChange}
        size="sm"
      />

      {/* Columns and Operation Section - with card wrapper */}
      <div className="border border-light-200 dark:border-dark-600 rounded-lg p-4">
        <div className="flex gap-6 items-start">
          {/* Columns Section */}
          <div className="flex-1">
            <Label className="mb-2 block text-light-500 dark:text-light-400">
              Columns
            </Label>
            <Select
              value=""
              onValueChange={addColumn}
              options={columnOptions}
              placeholder="Column"
              size="sm"
              className="w-full"
            />
          </div>

          {/* Operation Section */}
          <div>
            <Label className="mb-2 block text-light-500 dark:text-light-400">
              Operation
            </Label>
            <div className="flex gap-1">
              {OPERATORS.map((op) => (
                <OperatorButton key={op.value} op={op} onClick={addOperation} />
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild={true}>
                  <Button variant="outlined" size="xs" icon={true} title="Functions">
                    <span className="body-sm-medium w-4 text-center">ƒx</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[220px]"
                  onCloseAutoFocus={preventAutoFocus}
                >
                  {FORMULA_FUNCTIONS.map((fn) => (
                    <FunctionMenuItem key={fn.name} fn={fn} onAdd={addFunction} />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Expression Section - inside the card */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-light-500 dark:text-light-400">Expression</Label>
            <Button
              variant="ghost"
              size="xs"
              icon={true}
              onClick={clearExpression}
              title="Clear expression"
              disabled={state.text.trim() === ""}
              className="text-light-500 hover:text-alert-error dark:text-light-400 disabled:opacity-30"
            >
              <Icon id="x" className="size-4" />
            </Button>
          </div>
          <HighlightedExpressionInput
            ref={textareaRef}
            text={state.text}
            columns={columns}
            onChange={onTextChange}
            error={hasErrors}
            placeholder="Add columns and operations to build your formula"
          />
          <Message error={hasErrors}>
            {hasErrors ? state.validationErrors[0] : undefined}
          </Message>
          {functionHints.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5">
              {functionHints.map((fn) => (
                <p
                  key={fn.name}
                  className="body-xs-regular text-light-400 dark:text-dark-400"
                >
                  Syntax: <span className="font-mono">{fn.signature}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
});

FormulaEditor.displayName = "FormulaEditor";

/**
 * Syntax-highlighted expression input.
 * Uses a transparent textarea over a colored highlight layer so
 * operators and functions render in blue while the user types.
 */
interface HighlightedExpressionInputProps {
  text: string;
  columns: ColumnInfo[];
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
}

const HighlightedExpressionInput = forwardRef<
  HTMLTextAreaElement,
  HighlightedExpressionInputProps
>(({ text, columns, onChange, error, placeholder }, fwRef) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(fwRef, () => internalRef.current!);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = internalRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
  }, [text]);

  const highlighted = useMemo(() => {
    if (!text) return null;
    return buildHighlightSpans(text, columns);
  }, [text, columns]);

  return (
    <div className="group">
      <div
        className={cn(
          "relative rounded-sm border min-h-[80px] w-full overflow-hidden",
          "border-light-300 dark:border-dark-600",
          error && "border-red-500!",
        )}
      >
        {/* Highlight layer */}
        <div
          aria-hidden={true}
          className="absolute inset-0 pointer-events-none body-xs-regular py-3 pl-3 pr-3 whitespace-pre-wrap break-words"
        >
          {highlighted ?? <span className="text-ds-text-caption">{placeholder}</span>}
        </div>

        {/* Editable textarea — transparent text, visible caret */}
        <textarea
          ref={internalRef}
          value={text}
          onChange={handleChange}
          placeholder=""
          className={cn(
            "relative w-full min-h-[80px] resize-none border-none bg-transparent",
            "body-xs-regular py-3 pl-3 pr-3",
            "focus-visible:outline-hidden",
            "text-transparent caret-ds-text-heading",
            "whitespace-pre-wrap break-words",
          )}
          spellCheck={false}
        />
      </div>
    </div>
  );
});
HighlightedExpressionInput.displayName = "HighlightedExpressionInput";

// Module-level constants for syntax highlighting (avoids recreating on every call)
const FUNC_NAMES: Set<string> = new Set(FORMULA_FUNCTIONS.map((f) => f.name));
const OP_CHARS = new Set(["+", "-", "*", "/"]);

/** Prevent Radix DropdownMenu from refocusing the trigger on close. */
const preventAutoFocus = (e: Event) => e.preventDefault();
/**
 * Tokenize raw formula text and return an array of colored React spans.
 * Walks the string character-by-character, matching column references ([Name]),
 * function names (SUM, AVG), operators (+ - *), parentheses, commas, and numbers.
 * Known tokens get brand-blue or default text color; unrecognized tokens get red.
 */
function buildHighlightSpans(text: string, columns: ColumnInfo[]): ReactNode[] {
  const sortedColumns = [...columns].sort((a, b) => b.label.length - a.label.length);

  const spans: ReactNode[] = [];
  let pos = 0;
  let key = 0;

  while (pos < text.length) {
    const ch = text[pos];

    // Whitespace — keep as-is
    if (/\s/.test(ch)) {
      let ws = "";
      while (pos < text.length && /\s/.test(text[pos])) {
        ws += text[pos];
        pos++;
      }
      spans.push(<span key={key++}>{ws}</span>);
      continue;
    }

    // Column reference: [...]
    if (ch === "[") {
      const match = matchColumnAt(text, pos, sortedColumns);
      if (match) {
        const colText = text.slice(pos, match.endPos);
        spans.push(
          <span key={key++} className="text-ds-text-heading">
            {colText}
          </span>,
        );
        pos = match.endPos;
        continue;
      }
      // Unmatched bracket — show as error-colored
      const closeIdx = text.indexOf("]", pos + 1);
      if (closeIdx !== -1) {
        const bracketText = text.slice(pos, closeIdx + 1);
        spans.push(
          <span key={key++} className="text-red-500">
            {bracketText}
          </span>,
        );
        pos = closeIdx + 1;
      } else {
        spans.push(
          <span key={key++} className="text-red-500">
            {text.slice(pos)}
          </span>,
        );
        pos = text.length;
      }
      continue;
    }

    // Operators — blue
    if (OP_CHARS.has(ch)) {
      spans.push(
        <span key={key++} className="text-brand-main dark:text-brand-lighter">
          {ch === "*" ? "\u00d7" : ch === "/" ? "÷" : ch}
        </span>,
      );
      pos++;
      continue;
    }

    // Parentheses and commas — blue
    if (ch === "(" || ch === ")" || ch === ",") {
      spans.push(
        <span key={key++} className="text-brand-main dark:text-brand-lighter">
          {ch}
        </span>,
      );
      pos++;
      continue;
    }

    // Numbers — default text
    if (/[\d.]/.test(ch)) {
      let num = "";
      while (pos < text.length && /[\d.]/.test(text[pos])) {
        num += text[pos];
        pos++;
      }
      spans.push(
        <span key={key++} className="text-ds-text-heading">
          {num}
        </span>,
      );
      continue;
    }

    // Alpha chars — check for function names (blue) or unknown (red)
    if (/[a-zA-Z_]/.test(ch)) {
      let word = "";
      while (pos < text.length && /[a-zA-Z_]/.test(text[pos])) {
        word += text[pos];
        pos++;
      }
      if (FUNC_NAMES.has(word.toUpperCase())) {
        spans.push(
          <span
            key={key++}
            className="text-brand-main dark:text-brand-lighter font-medium"
          >
            {word}
          </span>,
        );
      } else {
        spans.push(
          <span key={key++} className="text-red-500">
            {word}
          </span>,
        );
      }
      continue;
    }

    // Unrecognized char — red
    spans.push(
      <span key={key++} className="text-red-500">
        {ch}
      </span>,
    );
    pos++;
  }

  return spans;
}

// Operator definitions with display symbols
const OPERATORS = [
  { value: "+", display: "+" },
  { value: "-", display: "-" },
  { value: "*", display: "\u00d7" },
  { value: "/", display: "÷" },
] as const;

type OperatorDef = (typeof OPERATORS)[number];

/** Memoized function dropdown item to avoid inline arrow per list item. */
const FunctionMenuItem = memo(
  ({
    fn,
    onAdd,
  }: {
    fn: (typeof FORMULA_FUNCTIONS)[number];
    onAdd: (name: string) => void;
  }) => {
    const handleClick = useCallback(() => onAdd(fn.name), [fn.name, onAdd]);
    return (
      <DropdownMenuItem onClick={handleClick}>
        <div>
          <div className="body-sm-medium">{fn.name}</div>
          <div className="body-xs-regular text-light-400 dark:text-dark-400">
            {fn.description}
          </div>
          <div className="body-xs-regular font-mono text-light-500 dark:text-dark-300 mt-0.5">
            {fn.signature}
          </div>
        </div>
      </DropdownMenuItem>
    );
  },
);
FunctionMenuItem.displayName = "FunctionMenuItem";

/** Memoized formula dropdown item to avoid inline arrow per list item. */
const FormulaSelectItem = memo(
  ({
    option,
    isSelected,
    onSelect,
  }: {
    option: { label: string; value: string };
    isSelected: boolean;
    onSelect: (id: string) => void;
  }) => {
    const handleClick = useCallback(
      () => onSelect(option.value),
      [option.value, onSelect],
    );
    return (
      <DropdownMenuItem
        onClick={handleClick}
        className={cn(
          "body-sm-regular",
          isSelected && "text-brand-main dark:text-brand-lighter",
        )}
      >
        <span className="flex-1">{option.label}</span>
        {isSelected && <Icon id="check" className="size-4 ml-auto" />}
      </DropdownMenuItem>
    );
  },
);
FormulaSelectItem.displayName = "FormulaSelectItem";

/** Memoized operator button using design system Button */
const OperatorButton = memo(
  ({ op, onClick }: { op: OperatorDef; onClick: (op: string) => void }) => {
    const handleClick = useCallback(() => onClick(op.value), [op.value, onClick]);
    return (
      <Button variant="outlined" size="xs" icon={true} onClick={handleClick}>
        <span className="body-sm-medium w-4 text-center">{op.display}</span>
      </Button>
    );
  },
);
OperatorButton.displayName = "OperatorButton";

FormulasToolPanel.displayName = "FormulasToolPanel";

export const FormulasToolDef = {
  id: "formulas",
  labelDefault: "Formulas",
  labelKey: "formulas",
  iconKey: "aggregation",
  toolPanel: FormulasToolPanel,
  minWidth: 300,
  width: 450,
} as ToolPanelDef;

export default FormulasToolPanel;
