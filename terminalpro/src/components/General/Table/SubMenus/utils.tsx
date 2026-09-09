import { sql } from "@codemirror/lang-sql";
import { syntaxTree } from "@codemirror/language";
import { type Diagnostic, linter } from "@codemirror/lint";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { MySQL } from "dt-sql-parser";

const mysql = new MySQL();

const sqlLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];

  syntaxTree(view.state)
    .cursor()
    .iterate((node) => {
      const text = view.state.sliceDoc(node.from, node.to).toUpperCase();
      if (node.name === "Statement") {
        const errors = mysql.validate(text);
        if (errors.length === 0) return;
        for (const error of errors) {
          const { startLine, endColumn, startColumn, endLine } = error;
          const end = Math.min(
            node.to,
            view.state.doc.line(endLine).from + (endColumn - 1),
          );

          const message = error.message.startsWith("extraneous input")
            ? "Invalid SQL syntax."
            : error.message;
          diagnostics.push({
            from: view.state.doc.line(startLine).from + (startColumn - 1),
            to: end,
            message: message,
            severity: "error",
          });
        }
      }
      if (node.name === "Keyword" && ["DELETE", "UPDATE", "INSERT"].includes(text)) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          message: `${text} queries are not allowed.`,
          severity: "error",
        });
      }
    });

  return diagnostics;
});

class SQLParamsWidget extends WidgetType {
  match: string;
  constructor(match: string) {
    super();
    this.match = match;
  }
  toDOM() {
    const element = document.createElement("span");
    element.className = "cm-sqlparams";
    element.textContent = this.match;
    return element;
  }
}

class RemovedParamsWidget extends WidgetType {
  match: string;
  constructor(match: string) {
    super();
    this.match = match;
  }
  toDOM() {
    const element = document.createElement("span");
    element.className = "cm-sqlparams-error";
    element.textContent = this.match;
    return element;
  }
}

function getParamDecorator(params: string[], removedParams: string[]) {
  const regexp = new RegExp(`(\\[(${params.join("|")})\\])`, "g");
  const removedRegexp = new RegExp(`(\\[(${removedParams.join("|")})\\])`, "g");
  return [
    new MatchDecorator({
      regexp,
      boundary: /\d+/,
      decorate(add, from, to, match) {
        add(from, from + 1, Decoration.replace({ widget: new SQLParamsWidget("[") }));
        add(
          from + 1,
          to - 1,
          Decoration.replace({
            widget: new SQLParamsWidget(match[0].replace(/\[|\]/g, "")),
            contenteditable: true,
          }),
        );
        add(to - 1, to, Decoration.replace({ widget: new SQLParamsWidget("]") }));
      },
    }),
    new MatchDecorator({
      regexp: removedRegexp,
      boundary: /\d+/,
      decorate(add, from, to, match) {
        add(
          from,
          from + 1,
          Decoration.replace({ widget: new RemovedParamsWidget("[") }),
        );
        add(
          from + 1,
          to - 1,
          Decoration.replace({
            widget: new RemovedParamsWidget(match[0].replace(/\[|\]/g, "")),
            contenteditable: true,
          }),
        );
        add(to - 1, to, Decoration.replace({ widget: new RemovedParamsWidget("]") }));
      },
    }),
  ];
}
export function getSQLPlugin(decoration: MatchDecorator) {
  return ViewPlugin.fromClass(
    class CustomPlugin {
      decoration: MatchDecorator;
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decoration = decoration;
        this.decorations = this.decoration.createDeco(view);
      }
      update(update: ViewUpdate) {
        this.decorations = this.decoration.updateDeco(update, this.decorations);
      }
    },
    {
      decorations: (instance) => instance.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => {
          return view.plugin(plugin)?.decorations || Decoration.none;
        }),
    },
  );
}

export function getSQLPlugins(params: string[], removedParams: string[]) {
  const decorations = getParamDecorator(params, removedParams);

  return decorations.map((decoration) => getSQLPlugin(decoration));
}

export const EditorExtensions = [
  sql({ upperCaseKeywords: true }),
  sqlLinter,
  EditorView.baseTheme({
    ".cm-sqlparams": {
      color: "orange",
      fontWeight: "bold",
    },
    ".cm-sqlparams-error": {
      color: "red",
      fontWeight: "bold",
    },
  }),
  EditorView.lineWrapping,
];

export function getExtensions(sqlPlugins?: ReturnType<typeof getSQLPlugins>) {
  return sqlPlugins ? [...EditorExtensions, ...sqlPlugins] : EditorExtensions;
}
