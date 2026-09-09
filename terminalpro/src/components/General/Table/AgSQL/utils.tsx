import type { DBType } from "~/api/dataConnectors";

export function getReset(sqlValue: string) {
  return { sqlValue, errorMessage: null, editSQL: false, openSettings: false };
}

export function getNewQuery(
  sqlValue: string,
  dialogParams: { [key: string]: string },
): string {
  return Object.entries(dialogParams || {}).reduce((acc, [paramName, paramValue]) => {
    if (paramValue !== "") {
      acc = acc.replace(new RegExp(`\\[${paramName}\\]`, "g"), paramValue as string);
    }
    return acc;
  }, sqlValue);
}

export function measureTextWidth(text: string, fontSize: string, fontFamily: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${fontSize} ${fontFamily}`;
  return context.measureText(text).width;
}

export function widgetIconId(type: DBType) {
  return {
    database: "database-icon" as const,
    snowflake: "simple-icons-snowflake" as const,
  }[type];
}
