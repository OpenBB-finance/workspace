declare module "monaco-editor" {
  export * from "monaco-editor/esm/vs/editor/editor.api";
}

declare module "monaco-editor/esm/vs/basic-languages/python/python.js" {
  export const language: import("monaco-editor").languages.IMonarchLanguage;
}

declare module "monaco-editor/esm/vs/basic-languages/sql/sql.js" {
  export const language: import("monaco-editor").languages.IMonarchLanguage;
}
