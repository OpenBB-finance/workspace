const displayMap: Record<string, string> = {
  sql: "SQL",
  javascript: "JavaScript",
  python: "Python",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  markdown: "Markdown",
  xml: "XML",
};

export function getLanguageFromInputType(inputType?: string): string {
  return displayMap[inputType?.toLowerCase()]?.toLowerCase();
}

export function getDisplayLanguage(inputType?: string): string {
  return displayMap[inputType?.toLowerCase()] || "Text";
}
