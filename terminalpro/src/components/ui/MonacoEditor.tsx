import Editor, { DiffEditor, loader, useMonaco } from "@monaco-editor/react";
import {
  type EntityContext,
  EntityContextType,
  PostgreSQL,
  type SyntaxSuggestion,
  type WordRange,
} from "dt-sql-parser";
import debounce from "lodash/debounce";
import isEqual from "lodash.isequal";
import type { editor as EditorT } from "monaco-editor";
import * as monacoLib from "monaco-editor";
import { language as pythonLanguage } from "monaco-editor/esm/vs/basic-languages/python/python.js";
import { language as sqlLanguage } from "monaco-editor/esm/vs/basic-languages/sql/sql.js";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { getLanguageFromInputType } from "~/components/ui/monacoLanguageUtils";
import type { Selector } from "~/lib/state/app";
import {
  type Source,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import { triggerCustomEvent, useEventListener } from "~/lib/utils/utils";
import { cn } from "../ds/utils";
import { areTruthy } from "../General/Table/utils";
import { useWidgetContext } from "../Widget.context";

loader.config({ monaco: monacoLib });

if (!import.meta.env.VITEST) {
  // Define custom themes with flat backgrounds (no line highlight)
  // Colors match bg-white (light) and bg-dark-900 (dark)
  monacoLib.editor.defineTheme("vs-flat", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "#008000" },
      { token: "identifier", foreground: "#001080" },
      { token: "keyword", foreground: "#0000FF" },
      { token: "number", foreground: "#09885a" },
      { token: "string", foreground: "#a31515" },
      { token: "string.sql", foreground: "#a31515" },
      { token: "type", foreground: "#267f99" },
      { token: "variable", foreground: "#001080" },
      { token: "operator", foreground: "#000000" },

      { token: "identifier.db", foreground: "#800080" },
      { token: "identifier.schema", foreground: "#267f99" },
      { token: "identifier.table", foreground: "#001080" },
      { token: "identifier.method", foreground: "#795E26", fontStyle: "bold" },
      { token: "identifier.property", foreground: "#001080" },
      { token: "identifier.class", foreground: "#267f99", fontStyle: "bold" },
      { token: "delimiter", foreground: "#000000" },

      { token: "identifier.param", foreground: "#267f99", fontStyle: "italic" },
      { token: "identifier.param.escape", foreground: "#267f99", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#FFFFFF",
      "editor.lineHighlightBorder": "#FFFFFF00",
      "editorLineNumber.foreground": "#8899aa",
      "editorLineNumber.activeForeground": "#6688aa",
    },
  });

  monacoLib.editor.defineTheme("vs-dark-flat", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "#6a9955" },
      { token: "identifier", foreground: "#9cdcfe" },
      { token: "keyword", foreground: "#569cd6" },
      { token: "number", foreground: "#b5cea8" },
      { token: "string", foreground: "#ce9178" },
      { token: "string.sql", foreground: "#ce9178" },
      { token: "type", foreground: "#4ec9b0" },
      { token: "variable", foreground: "#9cdcfe" },
      { token: "operator", foreground: "#d4d4d4" },

      { token: "identifier.db", foreground: "#c586c0" },
      { token: "identifier.schema", foreground: "#4ec9b0" },
      { token: "identifier.table", foreground: "#9cdcfe" },
      { token: "identifier.method", foreground: "#dcdcaa" },
      { token: "identifier.property", foreground: "#9cdcfe" },
      { token: "identifier.class", foreground: "#4ec9b0" },
      { token: "delimiter", foreground: "#d4d4d4" },

      { token: "identifier.param", foreground: "#4ec9b0", fontStyle: "italic" },
      { token: "identifier.param.escape", foreground: "#4ec9b0", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#151518",
      "editor.lineHighlightBackground": "#151518",
      "editor.lineHighlightBorder": "#15151800",
      "editorLineNumber.foreground": "#556677",
      "editorLineNumber.activeForeground": "#7799aa",
    },
  });

  // fixes multi-line f-string highlighting bug in Monaco's Python tokenizer
  function fixFStringBug({ tokenizer }: monacoLib.languages.IMonarchLanguage): void {
    const pythonTokens = {
      fStringBody: [
        [/\{\{/, "string"],
        [/\}\}/, "string"],
        [/[^\\'{}]+/, "string"],
        [/\{[^}':!=]+/, "identifier", "@fStringDetail"],
        [/\\./, "string"],
        [/'/, "string.escape", "@popall"],
        [/\\$/, "string"],
      ],
      fDblStringBody: [
        [/\{\{/, "string"],
        [/\}\}/, "string"],
        [/[^\\"{}]+/, "string"],
        [/\{[^}':!=]+/, "identifier", "@fStringDetail"],
        [/\\./, "string"],
        [/"/, "string.escape", "@popall"],
        [/\\$/, "string"],
      ],
    };

    Object.assign(tokenizer, pythonTokens);

    // add rules for class.property.method recognition
    const pythonRootTokens = [
      [
        /([a-zA-Z_]\w*)(\.)([a-zA-Z_]\w*)(\.)([a-zA-Z_]\w*)(\()/,
        [
          "identifier.class",
          "delimiter",
          "identifier.property",
          "delimiter",
          "identifier.method",
          { token: "@rematch", next: "@push" },
        ],
      ],
      // Fallback for identifier.method(
      [
        /(\.)([a-zA-Z_]\w*)(\()/,
        ["delimiter", "identifier.method", { token: "@rematch", next: "@push" }],
      ],
      // Fallback for function calls
      [
        /([a-zA-Z_]\w*)(\()/,
        ["identifier.method", { token: "@rematch", next: "@push" }],
      ],
    ] as monacoLib.languages.IMonarchLanguageRule[];

    tokenizer.root.unshift(...pythonRootTokens);
  }

  function sqlEnhancements({
    tokenizer,
    keywords,
  }: monacoLib.languages.IMonarchLanguage): void {
    // Add rules to recognize database.schema.table patterns
    const sqlRootTokens = [
      [
        /([a-zA-Z_]\w*)(\.)([a-zA-Z_]\w*)(\.)([a-zA-Z_]\w*)/,
        [
          "identifier.db",
          "delimiter",
          "identifier.schema",
          "delimiter",
          "identifier.table",
        ],
      ],
      // Fallback for schema.table if needed
      [
        /([a-zA-Z_]\w*)(\.)([a-zA-Z_]\w*)/,
        ["identifier.schema", "delimiter", "identifier.table"],
      ],
    ] as monacoLib.languages.IMonarchLanguageRule[];

    const parameterTokens = [
      [/\{\{\s*[a-zA-Z_]\w*\s*\}\}/, "identifier.param"],
      [
        /(')(\{\{\s*[a-zA-Z_]\w*\s*\}\})(')/,
        ["string.escape", "identifier.param", "string.escape"],
      ],
      [
        /(")(\{\{\s*[a-zA-Z_]\w*\s*\}\})(")/,
        ["string.escape", "identifier.param", "string.escape"],
      ],
      [
        /(')(%)(\{\{\s*[a-zA-Z_]\w*\s*\}\})(%)(')/,
        [
          "string.escape",
          "string.escape",
          "identifier.param",
          "string.escape",
          "string.escape",
        ],
      ],
      [
        /(')(%)(\{\{\s*[a-zA-Z_]\w*\s*\}\})(')/,
        ["string.escape", "string.escape", "identifier.param", "string.escape"],
      ],
      [
        /(')(\{\{\s*[a-zA-Z_]\w*\s*\}\})(%)(')/,
        ["string.escape", "identifier.param", "string.escape", "string.escape"],
      ],
    ] as monacoLib.languages.IMonarchLanguageRule[];

    tokenizer.root.unshift(...parameterTokens);

    tokenizer.root.unshift(...sqlRootTokens);
    keywords.push("CALL", "EXPLAIN", "DESCRIBE", "SHOW");
  }

  fixFStringBug(pythonLanguage);
  sqlEnhancements(sqlLanguage);
}

export function MonacoEditor(props: MonacoEditorProps) {
  const {
    generatedCode,
    value,
    onChange,
    onKeyDown,
    language = "text",
    height = "64px",
    maxHeight,
    disabled = false,
    className = "",
    transparentBackground = false,
  } = props;

  const theme = useShallowThemeStore((state) => state.theme);
  const editorTheme = transparentBackground
    ? theme === "dark"
      ? "vs-dark-flat"
      : "vs-flat"
    : theme === "dark"
      ? "vs-dark"
      : "vs";
  const {
    sourceId,
    id: widgetId,
    schemaName,
    storage: { sqlParamDefs, params: storedParamValues },
  } = useWidgetContext().widget;
  const monaco = useMonaco();

  // #TODO - fetch schemas from backend connector store based on sourceId
  const backendSchemas = useShallowBackendConnectorStore(
    (state) => state.getApiSourceById(sourceId || "")?.schemas,
  );

  const { schema, allSchemas, sqlParams } = useMemo(() => {
    const sqlParams = sqlParamDefs?.map((param) => param.paramName);
    const output = { schema: undefined, allSchemas: undefined, sqlParams };
    if (language !== "sql" || !backendSchemas) return output;

    if (schemaName === "ALL_DATABASES_ALL_SCHEMAS_ALL_TABLES") {
      output.allSchemas = backendSchemas;
      return output;
    }

    output.schema = backendSchemas[schemaName];
    return output;
  }, [language, schemaName, backendSchemas, sqlParamDefs]);

  const editorRef = useRef<EditorT.IStandaloneCodeEditor | null>(null);
  const mountedRef = useRef(false);
  const [mountTick, setMountTick] = useState(0);

  const monacoLanguage = useMemo(
    () => getLanguageFromInputType(language) || "plaintext",
    [language],
  );

  const SQL_SCHEMA_REGISTRY = useShallowSQLSchemaStore((state) => ({
    get: state.get,
    set: state.set,
    delete: state.delete,
  }));

  const handleEditorDidMount = useCallback(
    (
      editor: EditorT.IStandaloneCodeEditor,
      _monaco: typeof import("monaco-editor"),
    ) => {
      editorRef.current = editor;
      mountedRef.current = true;
      setMountTick((t) => t + 1);

      if (onKeyDown) {
        // Handle Shift+Enter for running queries
        editor.onKeyDown((e) => {
          if (e.keyCode === 3 && e.shiftKey) {
            // Shift+Enter - trigger query execution
            e.preventDefault();
            const event = new KeyboardEvent("keydown", {
              key: "Enter",
              shiftKey: true,
            }) as unknown as ReactKeyboardEvent;
            onKeyDown(event);
          }
          // Regular Enter (without Shift) now creates new lines - no preventDefault needed
        });
      }
    },
    [onKeyDown, language, editorRef, mountedRef],
  );

  useEffect(() => {
    loader.init();
    const editor = editorRef.current;
    const hasSchemaData = schema || allSchemas || sqlParams?.length > 0;
    if (
      !areTruthy(mountedRef.current, editor, language === "sql", hasSchemaData, monaco)
    )
      return;

    const model = editor.getModel();
    // Register the editor model with its schema in the global registry
    const registryData = allSchemas ? { allSchemas, widgetId } : { schema, widgetId };
    SQL_SCHEMA_REGISTRY.set(model.uri.path, { ...registryData, sqlParams });

    if (allSchemas || schema) {
      const tableInfo = allSchemas
        ? `all schemas (${Object.keys(allSchemas).length} schemas)`
        : `table: ${schema?.tableName}`;
      if (import.meta.env.DEV)
        console.log(`Registered schema for widget ${widgetId} with ${tableInfo}`);
    }

    // Return cleanup function to remove this editor from registry
    return () => {
      if (import.meta.env.DEV)
        console.log(`Removing schema registry for widget ${widgetId}`);
      editor && SQL_SCHEMA_REGISTRY.delete(model.uri.path);
    };
  }, [schema, allSchemas, mountedRef.current, monaco, sqlParams, editorRef]);

  const runParamsCheck = useCallback(
    (newValue: string | undefined) => {
      const editor = editorRef.current;
      if (!(editor || newValue)) return;
      const model = editor.getModel();

      // Extract parameters from the newValue using regex (e.g., {{paramName}})
      const paramRegex = /\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g;
      const paramsInCode = new Set(
        Array.from(newValue.matchAll(paramRegex), (m) => m[1]),
      );

      const missingParams = Array.from(paramsInCode).filter(
        (p) => !sqlParams?.includes(p),
      );

      const markers = missingParams.flatMap((param) => {
        const matches = model.findMatches(
          `(\\{\\{\\s*${param}\\s*\\}\\})`,
          false,
          true,
          false,
          null,
          true,
        );
        return matches.map(({ range }) => {
          return {
            severity: monacoLib.MarkerSeverity.Warning,
            message: `Parameter "${param}" is used in the query but not defined in SQL parameters.`,
            startLineNumber: range.startLineNumber,
            startColumn: range.startColumn,
            endLineNumber: range.endLineNumber,
            endColumn: range.endColumn,
          } as EditorT.IMarkerData;
        });
      });

      monacoLib.editor.setModelMarkers(model, "parameter-check", markers);
    },
    [editorRef, sqlParams],
  );

  const debouncedRunParamsCheck = useMemo(() => {
    return debounce(runParamsCheck, 500);
  }, [runParamsCheck]);

  // Re-run param check when defined params change (e.g. user saves new params
  // in the SQLParams dialog) so stale "undefined parameter" markers clear
  // immediately instead of waiting for the next keystroke.
  useEffect(() => {
    if (language !== "sql" || !mountedRef.current) return;
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;
    runParamsCheck(model.getValue());
  }, [language, runParamsCheck]);

  const decorationsRef = useRef<EditorT.IEditorDecorationsCollection | null>(null);
  const rangesRef = useRef<Array<{ paramName: string; range: monacoLib.Range }>>([]);
  const lastHoveredRef = useRef<string | null>(null);
  const highlightedParamRef = useRef<string | null>(null);

  const refreshParamRanges = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || language !== "sql") return;
    const model = editor.getModel();
    if (!model) return;

    const newRanges: Array<{ paramName: string; range: monacoLib.Range }> = [];
    for (const name of sqlParams ?? []) {
      const matches = model.findMatches(
        `\\{\\{\\s*${name}\\s*\\}\\}`,
        false,
        true,
        false,
        null,
        false,
      );
      for (const match of matches)
        newRanges.push({ paramName: name, range: match.range });
    }
    rangesRef.current = newRanges;
  }, [sqlParams, language]);

  const resolvedParamValues = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of sqlParamDefs ?? []) {
      let value: unknown = storedParamValues?.[def.paramName];
      if (value === undefined || value === null) value = def.value;
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      map.set(def.paramName, Array.isArray(value) ? value.join(", ") : String(value));
    }
    return map;
  }, [sqlParamDefs, storedParamValues]);

  const editorFocusedRef = useRef(false);

  const applyParamDecorations = useCallback(
    (highlightedParam: string | null) => {
      const editor = editorRef.current;
      if (!editor || language !== "sql") return;

      highlightedParamRef.current = highlightedParam;
      const focused = editorFocusedRef.current;

      const decorations: EditorT.IModelDeltaDecoration[] = [];
      for (const { paramName, range } of rangesRef.current) {
        const resolvedValue = resolvedParamValues.get(paramName);
        const isHighlighted = highlightedParam === paramName;

        // Editor focused → reveal all {{name}} placeholders so the user can
        // edit them. Only keep the hover outline so they can still tell which
        // pill corresponds to which placeholder.
        if (focused) {
          if (isHighlighted) {
            decorations.push({
              range,
              options: { inlineClassName: "sql-param-highlight" },
            });
          }
          continue;
        }

        if (resolvedValue !== undefined) {
          const beforeClass = isHighlighted
            ? "sql-param-value sql-param-value--highlight"
            : "sql-param-value";
          decorations.push({
            range,
            options: {
              inlineClassName: "sql-param-text-hidden",
              before: {
                content: resolvedValue,
                inlineClassName: beforeClass,
                inlineClassNameAffectsLetterSpacing: true,
              },
            } as EditorT.IModelDecorationOptions,
          });
          continue;
        }

        if (isHighlighted) {
          decorations.push({
            range,
            options: { inlineClassName: "sql-param-highlight" },
          });
        }
      }

      if (!decorationsRef.current) {
        decorationsRef.current = editor.createDecorationsCollection(decorations);
      } else {
        decorationsRef.current.set(decorations);
      }
    },
    [language, resolvedParamValues],
  );

  // Recompute ranges when defined params change or editor mounts
  useEffect(() => {
    if (language !== "sql" || !mountedRef.current) return;
    refreshParamRanges();
    applyParamDecorations(highlightedParamRef.current);
  }, [language, refreshParamRanges, applyParamDecorations, mountTick]);

  // Track focus: reveal all {{name}} placeholders while editor is focused;
  // re-mask on blur. Also broadcast so the pills toolbar can toggle labels.
  useEffect(() => {
    if (language !== "sql" || !mountedRef.current || !widgetId) return;
    const editor = editorRef.current;
    if (!editor) return;
    const focusDisposable = editor.onDidFocusEditorWidget(() => {
      editorFocusedRef.current = true;
      applyParamDecorations(highlightedParamRef.current);
      triggerCustomEvent(`sqlEditorFocus-${widgetId}`, { focused: true });
    });
    const blurDisposable = editor.onDidBlurEditorWidget(() => {
      editorFocusedRef.current = false;
      applyParamDecorations(highlightedParamRef.current);
      triggerCustomEvent(`sqlEditorFocus-${widgetId}`, { focused: false });
    });
    return () => {
      focusDisposable.dispose();
      blurDisposable.dispose();
      editorFocusedRef.current = false;
      triggerCustomEvent(`sqlEditorFocus-${widgetId}`, { focused: false });
    };
  }, [language, widgetId, mountTick, applyParamDecorations]);

  // Emit hover events when user mouses over a resolved param occurrence
  useEffect(() => {
    if (language !== "sql" || !mountedRef.current || !widgetId) return;
    const editor = editorRef.current;
    if (!editor) return;
    const disposable = editor.onMouseMove((e) => {
      let paramName: string | null = null;
      if (
        e.target.type === monacoLib.editor.MouseTargetType.CONTENT_TEXT &&
        e.target.position
      ) {
        const pos = e.target.position;
        const hit = rangesRef.current.find(({ range }) => range.containsPosition(pos));
        if (hit) paramName = hit.paramName;
      }
      if (paramName !== lastHoveredRef.current) {
        lastHoveredRef.current = paramName;
        triggerCustomEvent(`sqlParamHover-${widgetId}`, { paramName });
      }
    });
    return () => disposable.dispose();
  }, [language, widgetId, mountTick]);

  useEventListener(`sqlParamHoverPill-${widgetId}`, (detail) => {
    applyParamDecorations(detail?.paramName ?? null);
  });

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || "");
      if (language === "sql") {
        debouncedRunParamsCheck(newValue);
        refreshParamRanges();
        applyParamDecorations(highlightedParamRef.current);
      }
    },
    [
      onChange,
      debouncedRunParamsCheck,
      language,
      refreshParamRanges,
      applyParamDecorations,
    ],
  );

  const optionsMemo = useMemo(() => {
    const suggestionDelay = allSchemas ? 250 : 100;
    return {
      readOnly: disabled || Boolean(generatedCode),
      renderSideBySide: false,
      // Use longer delay for ALL_DATABASES case to improve performance
      quickSuggestionsDelay: suggestionDelay,
      ...DEFAULT_OPTIONS,
    } as EditorT.IStandaloneEditorConstructionOptions;
  }, [disabled, allSchemas !== undefined, generatedCode]);

  const EditorComp = generatedCode ? DiffEditor : Editor;

  return (
    <div
      className={cn("relative w-full h-full", className)}
      style={{ height, maxHeight }}
    >
      <EditorComp
        language={monacoLanguage}
        theme={editorTheme}
        original={generatedCode ? value : undefined}
        value={value}
        modified={generatedCode}
        onChange={generatedCode ? undefined : handleChange}
        // @ts-expect-error - types are wrong for onMount in DiffEditor
        onMount={generatedCode ? undefined : handleEditorDidMount}
        path={`widget-${widgetId}-${language}`}
        options={optionsMemo}
        loading={<LoadingElement />}
      />
    </div>
  );
}

export function StandaloneEditor(props: StandaloneEditorProps) {
  const {
    id,
    value,
    onChange,
    language = "text",
    height = "64px",
    maxHeight,
    className = "",
    options,
  } = props;

  const widgetId = useWidgetContext().widget?.id;
  const theme = useShallowThemeStore((state) => state.theme);
  const editorTheme = theme === "dark" ? "vs-dark-flat" : "vs-flat";
  const editorRef = useRef<EditorT.IStandaloneCodeEditor | null>(null);

  const monacoLanguage = useMemo(
    () => getLanguageFromInputType(language) || "plaintext",
    [language],
  );

  const handleEditorDidMount = useCallback(
    (editor: EditorT.IStandaloneCodeEditor) => {
      editorRef.current = editor;
    },
    [editorRef],
  );

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || "");
    },
    [onChange],
  );

  return (
    <div
      className={cn("relative w-full h-full", className)}
      style={{ height, maxHeight }}
    >
      <Editor
        keepCurrentModel={true}
        language={monacoLanguage}
        theme={editorTheme}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        path={`widget-${widgetId}-${language}-standalone${id ? `-${id}` : ""}`}
        options={{ ...DEFAULT_OPTIONS, ...options }}
        loading={<LoadingElement />}
      />
    </div>
  );
}

const LoadingElement = () => (
  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
    Loading editor...
  </div>
);

export const DEFAULT_OPTIONS: EditorT.IStandaloneEditorConstructionOptions = {
  "semanticHighlighting.enabled": true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  lineNumbers: "on",
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 17,
  lineNumbersMinChars: 2,
  wordWrap: "on",
  scrollbar: {
    vertical: "auto",
    horizontal: "hidden",
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: true,
  // Core autocompletion settings - simplified and corrected
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: "on",
  acceptSuggestionOnCommitCharacter: true,
  tabCompletion: "on",
  wordBasedSuggestions: "currentDocument",
  suggestSelection: "first",
  // Suggestion configuration
  suggest: {
    showWords: true,
    showKeywords: true,
    showSnippets: true,
    showFunctions: true,
    showFields: true,
    showVariables: true,
    showClasses: true,
    snippetsPreventQuickSuggestions: false,
    filterGraceful: true,
    localityBonus: true,
  },
  // Other editor settings
  parameterHints: { enabled: true },
  autoClosingBrackets: "languageDefined",
  autoClosingQuotes: "languageDefined",
  autoSurround: "languageDefined",
  renderLineHighlight: "line",
  selectOnLineNumbers: false,
  padding: { top: 8, bottom: 8 },
};

interface StandaloneEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  maxHeight?: number | string;
  className?: string;
  options?: EditorT.IStandaloneEditorConstructionOptions;
}

interface MonacoEditorProps extends StandaloneEditorProps {
  onKeyDown?: (e: ReactKeyboardEvent) => void;
  disabled?: boolean;
  transparentBackground?: boolean;
  generatedCode?: string;
}

const DefaultKeywords = [
  "DISTINCT",
  "SELECT",
  "FROM",
  "WHERE",
  "ORDER BY",
  "GROUP BY",
  "LIMIT",
];

function applyColumn(column: { name: string }, previousWord: string) {
  const isAllCaps = column.name.toUpperCase() === column.name;
  if (!isAllCaps && previousWord === '""') return `${column.name}`;

  return isAllCaps ? column.name : `"${column.name}"`;
}

type Completion = monacoLib.languages.CompletionItem;

function getSchemaCompletion(
  schema: Source["schemas"][string],
  item: SyntaxSuggestion<WordRange>,
  range: monacoLib.IRange,
): Record<string, Completion> | null {
  const currentWords = (
    item.wordRanges?.map((wr) => wr.text.replace(".", ""))?.filter(Boolean) || []
  ).join(".");

  if (!currentWords) {
    if (schema.database) {
      return {
        [schema.database]: {
          label: schema.database,
          kind: monacoLib.languages.CompletionItemKind.Class,
          insertText: schema.database,
          detail: "Database",
          sortText: `001_${schema.database}`,
          range,
        },
      };
    }
  }

  if (currentWords === `${schema.database}`) {
    if (schema.schema) {
      return {
        [schema.schema]: {
          label: schema.schema,
          kind: monacoLib.languages.CompletionItemKind.Struct,
          insertText: schema.schema,
          detail: `Schema in ${schema.database}`,
          sortText: `002_${schema.schema}`,
          range,
        },
      };
    }
  }
  if (schema.schema && currentWords === `${schema.database}.${schema.schema}`) {
    if (schema.tableName) {
      return {
        [schema.tableName]: {
          label: schema.tableName,
          kind: monacoLib.languages.CompletionItemKind.Reference,
          insertText: schema.tableName,
          detail: `Table from ${schema.database}.${schema.schema}`,
          documentation: `${schema.tableName} - Table with ${schema.columns.length} columns`,
          sortText: `003_${schema.tableName}`,
          range,
        },
      };
    }
  }
}

const postgres = new PostgreSQL();

function getSQLParameterCompletions(
  sqlParams: string[] | undefined,
  range: monacoLib.IRange,
): Completion[] {
  return (sqlParams || []).map((param) => ({
    label: param,
    kind: monacoLib.languages.CompletionItemKind.Variable,
    insertText: param,
    detail: "SQL Parameter",
    sortText: `000_${param}`,
    range,
  }));
}

// Flag to indicate if global SQL provider is registered
monacoLib.languages.registerCompletionItemProvider("sql", {
  triggerCharacters: [" ", ".", ",", "\t", "\n", "$"],
  provideCompletionItems: (model, position, ctx) => {
    // Get schema for the current editor model
    const editorData = useSQLSchemaStore.getState().get(model.uri.path);
    const code = model.getValue();

    const word = model.getWordUntilPosition(position).word;
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: position.column - (word ? word.length : 0),
      endColumn: position.column,
    };

    if (ctx.triggerCharacter === "$") {
      const paramCompletions = getSQLParameterCompletions(editorData?.sqlParams, range);
      return { suggestions: paramCompletions };
    }

    const suggestions = postgres.getSuggestionAtCaretPosition(code, position);
    if (import.meta.env.DEV)
      console.log("SQL suggestions at position", position, suggestions);
    let allEntities: EntityContext[] = [];
    if (suggestions?.syntax?.length) {
      allEntities = postgres.getAllEntities(code, position);
    }

    const { keywords, syntax } = suggestions;
    if (import.meta.env.DEV) console.log(syntax);

    const keywordsCompletionItems: Completion[] = DefaultKeywords.map((kw) => {
      if (keywords.indexOf(kw) === -1) return null;
      return {
        label: kw,
        kind: monacoLib.languages.CompletionItemKind.Keyword,
        insertText: kw,
        range,
      };
    }).filter((k) => k !== null);

    if (word === null || !editorData) return null;
    const schemas =
      "schema" in editorData
        ? editorData.schema
          ? [editorData.schema]
          : []
        : editorData.allSchemas
          ? Object.values(editorData.allSchemas)
          : [];

    if (schemas?.length === 0) return { suggestions: keywordsCompletionItems };

    const options = [] as Completion[];

    let skipColumnCompletion = false;
    let skipKeywordCompletion = false;
    for (const [index, item] of syntax.entries()) {
      const { wordRanges = [], syntaxContextType } = syntax[index - 1] || {};
      const previousWord = wordRanges?.[wordRanges?.length - 1]?.text || "";

      if (item.syntaxContextType === EntityContextType.VIEW) {
        skipKeywordCompletion ||= previousWord.endsWith(".");

        const entityCompletions = schemas.reduce(
          (acc, schema) => {
            const completion = getSchemaCompletion(schema, item, range);
            if (completion) Object.assign(acc, completion);

            return acc;
          },
          {} as Record<string, Completion>,
        );

        const tableCompletions = Object.values(entityCompletions);
        skipColumnCompletion ||= tableCompletions.length > 0;
        options.push(...tableCompletions);
      }

      if (item.syntaxContextType === EntityContextType.DATABASE) {
        const databaseCompletions: Completion[] = [];
        for (const schema of schemas) {
          if (schema.database) {
            databaseCompletions.push({
              label: schema.database,
              kind: monacoLib.languages.CompletionItemKind.Class,
              insertText: schema.database,
              detail: "Database",
              sortText: `001_${schema.database}`,
              range,
            });
          }
        }
        options.push(...databaseCompletions);
      }
      if (
        item.syntaxContextType === EntityContextType.COLUMN &&
        !skipColumnCompletion
      ) {
        if (import.meta.env.DEV)
          console.log("Getting column completions for item:", item);

        const hasSpaceBefore = previousWord === " ";
        const checkPrev =
          syntaxContextType === EntityContextType.VIEW ||
          syntaxContextType === EntityContextType.COLUMN;

        if (hasSpaceBefore || checkPrev) continue;
        const columnCompletions: Completion[] = [];

        if (item.wordRanges?.length === 0) {
          // add wildcard completion
          columnCompletions.push({
            label: "*",
            kind: monacoLib.languages.CompletionItemKind.Field,
            insertText: "*",
            detail: "All columns",
            sortText: "001_*",
            range,
          });
        }

        if ("allSchemas" in editorData && editorData.allSchemas) {
          // If we have allSchemas, try to find the relevant schema based on context
          let relevantColumns: Source["schemas"][string]["columns"] | null = null;
          for (const entity of allEntities) {
            if (entity.entityContextType === EntityContextType.TABLE) {
              // if (entity.position.endColumn <= position.column) continue;
              relevantColumns = editorData.allSchemas[entity.text]?.columns;
            }
            if (relevantColumns) break;
          }

          for (const column of relevantColumns || []) {
            // check if column already in context
            if (item.wordRanges?.some((wr) => wr.text === column.name)) continue;
            columnCompletions.push({
              label: column.name,
              kind: monacoLib.languages.CompletionItemKind.Field,
              insertText: applyColumn(column, previousWord),
              detail: column.type,
              sortText: `097_${column.name}`,
              range,
            });
          }
        } else if ("schema" in editorData && editorData.schema) {
          for (const column of editorData.schema.columns) {
            // check if column already in context
            if (item.wordRanges?.some((wr) => wr.text === column.name)) continue;
            columnCompletions.push({
              label: column.name,
              kind: monacoLib.languages.CompletionItemKind.Field,
              insertText: applyColumn(column, previousWord),
              detail: column.type,
              sortText: `097_${column.name}`,
              range,
            });
          }
        }

        options.push(...columnCompletions);
      }
    }

    if (!skipKeywordCompletion) options.push(...keywordsCompletionItems);

    return {
      suggestions: options,
    };
  },
});

type SchemaDataType =
  | { schema: Source["schemas"][string]; widgetId: string }
  | { allSchemas: Source["schemas"]; widgetId: string };

type RegistryType = SchemaDataType & { sqlParams?: string[] };

interface SQLSchemaState {
  registry: { [uri: string]: RegistryType };
  // Methods to interact with the registry
  get: (uri: monacoLib.Uri["path"]) => RegistryType | undefined;
  set: (uri: monacoLib.Uri["path"], data: RegistryType) => void;
  delete: (uri: monacoLib.Uri["path"]) => void;
}

export const useSQLSchemaStore = createWithEqualityFn<SQLSchemaState>()(
  subscribeWithSelector((set, get) => ({
    registry: {},
    get: (uri) => get().registry[uri.replace("-standalone", "")],
    set: (uri, data) => {
      set((state) => ({
        registry: { ...state.registry, [uri]: data },
      }));
    },
    delete: (uri) => {
      set((state) => {
        const newRegistry = { ...state.registry };
        delete newRegistry[uri];
        return { registry: newRegistry };
      });
    },
  })),
);

export function useShallowSQLSchemaStore<S extends SQLSchemaState, T>(
  selector: Selector<S, T>,
): T {
  return useSQLSchemaStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

export { getDisplayLanguage, getLanguageFromInputType } from "./monacoLanguageUtils";

// for reference purposes
const TokenClassConsts = {
  BINARY: "binary",
  BINARY_ESCAPE: "binary.escape",
  COMMENT: "comment",
  COMMENT_QUOTE: "comment.quote",
  DELIMITER: "delimiter",
  DELIMITER_CURLY: "delimiter.curly",
  DELIMITER_PAREN: "delimiter.paren",
  DELIMITER_SQUARE: "delimiter.square",
  IDENTIFIER: "identifier",
  IDENTIFIER_QUOTE: "identifier.quote",
  KEYWORD: "keyword",
  KEYWORD_SCOPE: "keyword.scope",
  NUMBER: "number",
  NUMBER_FLOAT: "number.float",
  NUMBER_BINARY: "number.binary",
  NUMBER_OCTAL: "number.octal",
  NUMBER_HEX: "number.hex",
  OPERATOR: "operator",
  OPERATOR_KEYWORD: "operator.keyword",
  OPERATOR_SYMBOL: "operator.symbol",
  PREDEFINED: "predefined",
  STRING: "string",
  STRING_DOUBLE: "string.double",
  STRING_ESCAPE: "string.escape",
  TYPE: "type",
  VARIABLE: "variable",
  WHITE: "white",
} as const;
