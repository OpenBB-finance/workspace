import type { ColDef } from "ag-grid-community";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import dayjsBusinessDays from "dayjs-business-days2";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import LinkifyIt from "linkify-it";
import { round } from "lodash";
import { useCallback, useEffect } from "react";
import { v4 as uuidLibv4 } from "uuid";
import type { CreateWidgetParams } from "~/components/AI/hooks/useCreateWidgetFromArtifact";
import { isDate } from "~/components/General/Table/AgGridUtils";
import { areTruthy } from "~/components/General/Table/utils";
import type { NewWidgetT } from "~/components/types";
import {
  BENZINGA_NEWS_IMG_URLS,
  butterflyTypes,
  MAX_SKILL_SLUG_LENGTH,
} from "../constants";
import { useAppStore } from "../state/app";
import { useAuthStore } from "../state/auth";
import type { SaveWidgetsEventT } from "../types";

dayjs.extend(quarterOfYear);
dayjs.extend(relativeTime);
dayjs.extend(isSameOrAfter);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayjsBusinessDays);

export const noop = () => {};

export function isTabPath(pathname: string) {
  return pathname?.includes("/app/") && isUUID(pathname?.split("/app/")?.pop() || "");
}

// Initialize linkify-it instance for URL detection
const linkify = new LinkifyIt();

export function extractUrlsFromText(text: string): string[] {
  try {
    // Use linkify-it to find URLs in text
    const matches = linkify.match(text);

    if (!matches) {
      return [];
    }

    // Extract URLs and filter out emails (mailto: links) and @mentions
    const urls = matches
      .map((match) => match.url)
      .filter((url) => {
        if (url.endsWith(".name")) return false;
        // Filter out mailto: links (emails)
        if (url.startsWith("mailto:")) return false;

        // Check if preceded by @ (indicating email domain pattern like @gmail.com)
        // https://openbb.atlassian.net/browse/AA-3812
        const originalText = matches.find((m) => m.url === url)?.raw || "";
        const urlIndex = text.indexOf(originalText);
        if (urlIndex > 0 && text[urlIndex - 1] === "@") {
          return false;
        }

        return true;
      });

    return urls;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function isInputFocused(target: HTMLElement | EventTarget) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLDivElement &&
      (target?.className?.includes("ProseMirror") ||
        target?.contentEditable === "true"))
  );
}

export function isValidUrl(url: any) {
  const urls = extractUrlsFromText(url);
  return urls.length === 1;
}

export function uuidv4() {
  return uuidLibv4();
}

type WidgetUUID = string;

type CustomEvents = {
  saveWidgets: { saveWidgets?: boolean };
  refreshQuery: { refreshQuery?: boolean };
  scrollToTabItem: { tabId: string };
  createWidgetPopup: CreateWidgetParams;
  [key: `runParams-${WidgetUUID}`]: { runParams: boolean };
  [key: `staleParams-${WidgetUUID}`]: { staleParams: boolean };
  [key: `runMetadataUpdate-${WidgetUUID}`]: {
    runMetadataUpdate: boolean;
    metadata?: {
      name?: string;
      description?: string;
      category?: string;
      subCategory?: string;
      source?: string;
    };
  };
  [key: `metadataUpdateComplete-${WidgetUUID}`]: {
    success: boolean;
    metadata?: {
      name?: string;
      description?: string;
      category?: string;
      subCategory?: string;
    };
    error?: string;
  };
  [key: `runComplete-${WidgetUUID}`]: {
    runComplete: boolean;
    requestSucceeded?: boolean;
    hasData?: boolean;
    rowCount?: number;
  };
  [key: `requestStaleState-${WidgetUUID}`]: { requestStaleState: boolean };
  [key: `updateWidget-${WidgetUUID}`]: NewWidgetT;
  [key: `updateQueryParams-${WidgetUUID}`]: { [key: string]: any };
  [key: `queryChanged-${WidgetUUID}`]: string;
  [key: `sqlParamHover-${WidgetUUID}`]: { paramName: string | null };
  [key: `sqlParamHoverPill-${WidgetUUID}`]: { paramName: string | null };
  [key: `sqlEditorFocus-${WidgetUUID}`]: { focused: boolean };
};
type EventName = keyof CustomEvents;
// biome-ignore format: off
const booleanEvents = ["saveWidgets", "refreshQuery", "runParams", "staleParams", "runComplete", "requestStaleState"] as EventName[];
// biome-ignore format: off
type EventData<T extends EventName> = T extends { [key: string]: infer U; } ? U : CustomEvents[T];

export function triggerCustomEvent<T extends EventName, DataT = EventData<T>>(
  eventName: T,
  data?: DataT,
) {
  if (
    (typeof data === "boolean" || !data) &&
    booleanEvents.some((e) => eventName.startsWith(e))
  ) {
    const eventKey = eventName.replace(/-(.+)$/, "") as T;
    data = { [eventKey]: data ?? true } as DataT;
  }
  const event = new CustomEvent(eventName, { detail: data });
  return window.dispatchEvent(event);
}

export function useEventListener<T extends EventName>(
  eventName: T,
  handler: (detail: CustomEvents[T]) => void,
) {
  const listener = useCallback(
    (event: CustomEvent) => handler(event.detail),
    [handler],
  );
  useEffect(() => {
    const ctrl = new AbortController();
    window.addEventListener(eventName, listener, { signal: ctrl.signal });
    return () => ctrl.abort();
  }, [eventName, listener]);
}

/**
 * Dispatches an event to save local widget states to AppStore
 */
export async function dispatchSaveState() {
  return window.dispatchEvent(
    new CustomEvent("saveWidgets", {
      detail: { saveWidgets: true },
    } as SaveWidgetsEventT),
  );
}

export async function dispatchRefreshQuery() {
  return window.dispatchEvent(
    new CustomEvent("refreshQuery", {
      detail: { refreshQuery: true },
    }),
  );
}

export async function dispatchUpdateWidget(widgetId: string, newWidget: NewWidgetT) {
  return window.dispatchEvent(
    new CustomEvent(`updateWidget-${widgetId}`, {
      detail: newWidget,
    }),
  );
}

export async function dispatchRunParams(widgetId: string) {
  return queueMicrotask(() =>
    setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent(`runParams-${widgetId}`, {
            detail: { runParams: true },
          }),
        ),
      500,
    ),
  );
}

export function capitalize(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function loaderDelayFn<T>(fn: (...args: any[]) => Promise<T> | T) {
  const delay = Number(sessionStorage.getItem("loaderDelay") ?? 0);
  const delayPromise = new Promise((r) => setTimeout(r, delay));

  await delayPromise;
  const res = await fn();

  return res;
}

export function getRandomBenzingaImage() {
  return BENZINGA_NEWS_IMG_URLS[
    Math.floor(Math.random() * BENZINGA_NEWS_IMG_URLS.length)
  ];
}

export async function actionDelayFn<T>(fn: (...args: any[]) => Promise<T> | T) {
  const delay = Number(sessionStorage.getItem("actionDelay") ?? 0);
  await new Promise((r) => setTimeout(r, delay));
  return fn();
}

export function shuffle<T>(arr: T[]): T[] {
  let i = arr.length;
  if (i === 0) return arr;
  const copy = [...arr];
  while (--i) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    copy[i] = b!;
    copy[j] = a!;
  }
  return copy;
}

export function getFromLS(localStorageKey, key, defaultValue = {}) {
  let ls = {};
  if (localStorage) {
    try {
      ls = JSON.parse(localStorage.getItem(localStorageKey)) || defaultValue;
    } catch (_e) {
      ls = defaultValue;
    }
  }
  return ls[key];
}

export function saveToLS(localStorageKey, key, value) {
  localStorage.setItem(
    localStorageKey,
    JSON.stringify({
      [key]: value,
    }),
  );
}

const CHARTING_COLORS = [
  "#33BBFF",
  "#E93361",
  "#4ADE80",
  "#EF7D00",
  "#005CA9",
  "#FACCD8",
  "#16A34A",
  "#CCBE00",
  "#991B1B",
  "#F5B166",
];

export function generateRandomColor() {
  const randomColor =
    CHARTING_COLORS[Math.floor(Math.random() * CHARTING_COLORS.length)];
  return randomColor;
}

const hexToRGB = (hex: string): [number, number, number] => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (result) {
    return [
      Number.parseInt(result[1], 16),
      Number.parseInt(result[2], 16),
      Number.parseInt(result[3], 16),
    ];
  }
  return [0, 0, 0];
};

export function getContrastColor(hexColor) {
  // If the color is not a valid hex color, return black as default
  if (!/^#([0-9A-F]{3}){1,2}$/i.test(hexColor)) {
    return "#000000";
  }

  // Convert the hex color to RGB
  let { r, g, b } = { r: 0, g: 0, b: 0 }; // linting hack
  if (hexColor.length === 7) {
    r = Number.parseInt(hexColor.substr(1, 2), 16);
    g = Number.parseInt(hexColor.substr(3, 2), 16);
    b = Number.parseInt(hexColor.substr(5, 2), 16);
  } else {
    r = Number.parseInt(hexColor[1] + hexColor[1], 16);
    g = Number.parseInt(hexColor[2] + hexColor[2], 16);
    b = Number.parseInt(hexColor[3] + hexColor[3], 16);
  }

  // Calculate the brightness of the color
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return white for dark colors and black for light colors
  return brightness > 128 ? "#000000" : "#FFFFFF";
}

export function generateBackgroundColorWithContrast(
  textColor: "white" | "black" = "black",
  threshold = 4.5,
  vibrancy = 0.5,
): string {
  const getVibrancy = (color: string): number => {
    const getSaturation = (r: number, g: number, b: number): number => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sum = max + min;
      return delta === 0 ? 0 : delta / sum;
    };

    const rgb = hexToRGB(color);
    const saturation = getSaturation(...rgb);
    return saturation;
  };

  const getContrastRatio = (color: string): number => {
    const rgbToLuminance = (r: number, g: number, b: number): number => {
      const sRGB = (c: number): number => {
        const channel = c / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : // biome-ignore lint: Use the '**' operator instead of 'Math.pow'
            Math.pow((channel + 0.055) / 1.055, 2.4);
      };

      const gammaRGB = [sRGB(r), sRGB(g), sRGB(b)];
      return 0.2126 * gammaRGB[0] + 0.7152 * gammaRGB[1] + 0.0722 * gammaRGB[2];
    };

    const textColorLuminance = rgbToLuminance(...hexToRGB(textColor));
    const backgroundColorLuminance = rgbToLuminance(...hexToRGB(color));
    return (
      (Math.max(textColorLuminance, backgroundColorLuminance) + 0.05) /
      (Math.min(textColorLuminance, backgroundColorLuminance) + 0.05)
    );
  };

  let backgroundColor = generateRandomColor();
  let contrastRatio = getContrastRatio(backgroundColor);
  let colorVibrancy = getVibrancy(backgroundColor);

  while (contrastRatio < threshold || colorVibrancy < vibrancy) {
    backgroundColor = generateRandomColor();
    contrastRatio = getContrastRatio(backgroundColor);
    colorVibrancy = getVibrancy(backgroundColor);
  }

  return backgroundColor;
}

export const COLORS = [
  "#00AAFF", // blue
  "#EF6689", // pink
  "#16A34A", // green
  "#FB923C", // orange
  "#CCBE00", // yellow
  "#337DBA", // dark blue
  "#998E00", // dark yellow
  "#917DB0", // purple
  "#FB923C", // orange
];

export function generateGroupingColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function formatDate(
  date: Date,
  dateStyle: "full" | "long" | "medium" | "short" | undefined = "medium",
  timeStyle: "full" | "long" | "medium" | "short" | undefined = "short",
) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle,
    timeStyle,
  }).format(date);
}

export function generateRandomName() {
  return butterflyTypes[Math.floor(Math.random() * butterflyTypes.length)];
}

export function isUUID(uuid: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function extractUUIDFromURL(url: string) {
  const uuid =
    url.match(
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\./i,
    )?.[1] || null;
  return uuid;
}

export function slugifyWithExtension(str: string) {
  if (!str) return "";

  // Convert to string if it isn't already
  const inputStr = str.toString();

  // Find the last period to separate filename from extension
  const lastDotIndex = inputStr.lastIndexOf(".");

  // If there's no dot or the dot is at the beginning or end, treat the whole string as filename
  if (lastDotIndex <= 0 || lastDotIndex === inputStr.length - 1) {
    // No extension, slugify the entire string
    return inputStr
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_") // Replace one or more spaces with single underscore
      .replace(/\n/g, "_")
      .replace(/[^a-zA-Z0-9_\u0080-\uFFFF.-]/g, "_") // Replace special characters with underscore, but keep dots for now
      .replace(/_+/g, "_") // Replace multiple consecutive underscores with single underscore
      .replace(/^_|_$/g, "") // Remove leading and trailing underscores
      .replace(/\.{2,}/g, "."); // Replace multiple consecutive dots with single dot
  }

  // Split into filename and extension
  const filename = inputStr.substring(0, lastDotIndex);
  const extension = inputStr.substring(lastDotIndex + 1);

  // Slugify the filename part
  const slugifiedFilename = filename
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // Replace one or more spaces with single underscore
    .replace(/\n/g, "_")
    .replace(/[^a-zA-Z0-9_\u0080-\uFFFF.-]/g, "_") // Replace special characters with underscore, but keep dots for now
    .replace(/_+/g, "_") // Replace multiple consecutive underscores with single underscore
    .replace(/^_|_$/g, "") // Remove leading and trailing underscores
    .replace(/\.{2,}/g, "."); // Replace multiple consecutive dots with single dot

  // Slugify the extension part (extensions should be simple)
  const slugifiedExtension = extension
    .toLowerCase()
    .trim()
    .replace(/[^a-zA-Z0-9]/g, ""); // Only allow alphanumeric characters in extension

  // Return the slugified filename with extension if extension is not empty
  return slugifiedExtension
    ? `${slugifiedFilename}.${slugifiedExtension}`
    : slugifiedFilename;
}

export function slugify(str: string, separator = "-") {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s/g, separator)
    .replace(/\n/g, separator)
    .replace(/[^\w-]+/g, "");
}

export function beautifySlug(slug: string, toUpperCase = true): string {
  if (!slug) return "";

  try {
    return slug
      .toString()
      .replace(/_/g, " ")
      .split(/(?=[A-Z][a-z])|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)
      .reduce((acc, word) => {
        // avoids adding space after opening parenthesis
        const addSpace = acc.endsWith("(") ? "" : " ";
        if (!toUpperCase) return `${acc}${addSpace}${word}`;

        const firstChar = word.charAt(0).toUpperCase();
        acc += `${addSpace}${firstChar}${word.slice(1)}`;
        return acc;
      }, "");
  } catch (e) {
    return slug
      .toString()
      .replace(/_/g, " ")
      .split(/(?=[A-Z][a-z])|(?=[A-Z][a-z])/)
      .map((word) => {
        if (!toUpperCase) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
}

export function formatNumber(number: number, decimals = 3, inMillions = false): string {
  if (Number.isNaN(number)) {
    return "N/A";
  }
  if (number === 0) return "0";
  if (number > 1_000_000 || number < -1_000_000) {
    return formatNumberMagnitude(number, decimals, inMillions);
  }

  const value = toFixedString(number, decimals);

  if (number > 1000 || number < -1000) {
    const parts = value.split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = parts[1] ? `.${parts[1]}` : "";
    return `${integerPart}${decimalPart}`;
  }
  return value;
}

export function formatNumbers(values: number[], decimals = 3): string[] {
  return values.map((value) => formatNumber(value, decimals));
}

export function formatNumberNoMagnitude(value: number | string) {
  if (typeof value === "string") {
    const suffix = value.replace(/[^a-zA-Z]/g, "").trim();
    const magnitude = ["", "K", "M", "B", "T"].indexOf(suffix.replace(/\s/g, ""));
    value = Number(value.replace(/[^\d.-]/g, "").trim()) * 10 ** (magnitude * 3);
  }

  return value;
}

export function formatNumberThousands(value: number | string): string {
  if (typeof value === "string") {
    value = Number(value);
  }

  if (value > 1000 || value < -1000) {
    const parts = value?.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = parts[1] ? `.${parts[1]}` : "";
    return `${integerPart}${decimalPart}`;
  }

  return value?.toString();
}

export function toFixedString(value: number, decimals = 3): string {
  if (!value?.toFixed) return value?.toString();

  if (value % 1 !== 0) {
    if (value < 1 && value > -1) {
      decimals = Math.max(decimals, 2);
    }
    const totalDecimals = value?.toString()?.split(".")[1]?.length || 0;
    const toFixed = Math.min(decimals, totalDecimals);

    const rounded = value?.toFixed(toFixed);
    return rounded?.padEnd(decimals + rounded?.indexOf(".") + 1, "0");
  }
  return value?.toString();
}

export function formatNumberMagnitude(
  value: number | string,
  decimals = 3,
  inMillions = false,
  noSuffix = false,
) {
  if (typeof value === "string") {
    value = Number(formatNumberNoMagnitude(value));
  }

  if (value === 0) return "0";
  if (Number.isNaN(value)) return "N/A";

  value = Number(toFixedString(value, decimals) || 0);

  if (value > 1_000_000 || value < -1_000_000) {
    const magnitude = Math.min(
      inMillions ? 2 : 4,
      Math.floor(Math.log10(Math.abs(value)) / 3),
    );
    const suffix = [" ", "", "M", ...(inMillions ? [] : ["B", "T"])][magnitude];
    const formatted = round(
      value / 10 ** (magnitude * 3),
      Math.min(decimals, 3),
    ).toString();

    const parts = formatted?.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = `.${parts[1] || ""}`;
    const formattedNumber = `${integerPart}${decimalPart}`;

    const finalValue = `${formattedNumber?.padEnd(
      Math.min(decimals, 3) + formattedNumber?.indexOf(".") + 1,
      "0",
    )}`;

    return `${finalValue.split(".")?.[1] ? finalValue : finalValue.split(".")?.[0]} ${
      noSuffix ? "" : suffix
    }`;
  }

  if (inMillions && (value > 1_000 || value < -1_000)) {
    // format number in millions
    const formatted = round(value / 1_000_000, decimals).toString();
    const parts = formatted?.toString().split(".");
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalPart = `.${parts[1] || ""}`;
    const formattedNumber = `${integerPart}${decimalPart}`;

    return `${formattedNumber?.padEnd(
      decimals + formattedNumber?.indexOf(".") + 1,
      "0",
    )} ${noSuffix ? "" : "M"}`;
  }

  return formatNumberThousands(value);
}

export const numberRegex = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;
export const magnitudeRegex = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?[KMBT]$/;

export function parseValue(
  value: string | number,
  chartDataType: ColDef["chartDataType"] = "series",
): number | string {
  try {
    if (isDate(value) || typeof value !== "string" || chartDataType !== "series")
      return value;

    const parsedValue = value?.replace(/^[$£€¥₹]/, "")?.replace(/[,\s%]/g, "");

    if (parsedValue.match(numberRegex)) {
      return Number.parseFloat(parsedValue);
    }
    if (parsedValue.match(magnitudeRegex)) {
      return formatNumberNoMagnitude(parsedValue);
    }
  } catch (e) {
    console.error(e);
  }

  return value;
}

export async function generateReportImage(
  checkIfLoadingData: () => boolean,
  element,
  name = "report",
  title = "Report",
  showDate = true,
  exportType = "png",
  darkMode = true,
  onFinish?: () => void,
  onError?: () => void,
) {
  let isDataLoading = checkIfLoadingData();
  while (isDataLoading) {
    await delay(500);
    isDataLoading = checkIfLoadingData();
  }
  await delay(1000);

  const { jsPDF } =
    exportType === "pdf" ? await import("jspdf") : { jsPDF: null as any };

  return new Promise((resolve) => {
    if (!element) return null;
    //document.documentElement.classList.add("generating-report");

    const contentWidth = Math.max(
      element.scrollWidth,
      element.offsetWidth,
      element.clientWidth,
    );
    const contentHeight = Math.max(
      element.scrollHeight,
      element.offsetHeight,
      element.clientHeight,
    );

    toPng(element, {
      width: contentWidth + 16,
      height: contentHeight,
    })
      .then((dataUrl) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const image = new Image();
        image.onload = () => {
          // Set canvas dimensions to match image dimensions with additional space for the black box
          canvas.width = image.width;
          canvas.height = image.height + 80; // Increased box height

          // Fill all the background with the specified color
          ctx.fillStyle = darkMode ? "#000000" : "rgb(246, 246, 246)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the black box with the specified color
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, 80); // Increased box height

          // Add title text, logo, and date to the canvas
          ctx.font = "28px Inter"; // Increased font size
          ctx.textAlign = "left";
          ctx.fillStyle = "#ffffff";

          // Draw the title text with bold font weight
          ctx.font = "bold 28px Inter"; // Increased font size
          ctx.fillText(title, 10, 48); // Adjusted position

          ctx.font = "28px Inter"; // Reset font size
          const exportString = "| Exported with OpenBB";
          ctx.fillText(exportString, ctx.measureText(title).width + 40, 48); // Adjusted position

          // Draw the logo SVG next to the title
          const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 255 127" width="32" height="16" fill="none" xmlns:xlink="http://www.w3.org/1999/xlink">
          <path d="M151.404 103.189v-7.937h71.733v15.874h-71.733v-7.937Zm0-63.5v-7.937h87.66v15.874h-87.66V39.69Zm95.628-23.815H135.468V127h103.596V79.374h-87.66V63.5H255V15.874h-7.968Zm-215.16 87.315v-7.937h71.733v15.874H31.873v-7.937Zm-15.936-63.5v-7.937h87.66v15.874h-87.66V39.69ZM119.532 0v15.874H0V63.5h103.596v15.874h-87.66V127h103.596V15.874h15.936V0h-15.936Z" fill="white" />
        </svg>`;
          const logoImage = new Image();
          logoImage.onload = () => {
            const titleWidth =
              ctx.measureText(title).width + ctx.measureText(exportString).width + 60; // Adjusted width
            const logoX = titleWidth; // Adjusted position
            const logoY = 48 - 16; // 16 is half the logo height to center it vertically
            ctx.drawImage(logoImage, logoX, logoY, 32, 16); // Doubled the logo size

            if (showDate) {
              const currentDate = formatDate(new Date()); // Get the current date
              ctx.textAlign = "right";
              ctx.fillText(currentDate, canvas.width - 10, 48); // Adjusted position
            }

            // Draw the image on the canvas, considering the offset due to the black box
            ctx.drawImage(image, 0, 80); // Increased box height

            // Convert canvas to data URL
            const finalDataUrl =
              exportType === "pdf"
                ? canvas.toDataURL("image/jpeg", 1)
                : canvas.toDataURL();

            if (exportType === "pdf") {
              const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? "l" : "p",
                unit: "px",
                format: [canvas.width, canvas.height],
              });
              pdf.addImage(finalDataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
              pdf.save(`${name}.pdf`);
            } else {
              // Create and download the image
              const link = document.createElement("a");
              link.download = `${name}.png`;
              link.href = finalDataUrl;
              link.click();
              link.remove();
              resolve(finalDataUrl);
            }
          };

          logoImage.src = `data:image/svg+xml;base64,${btoa(logoSvg)}`;
        };

        image.src = dataUrl;
      })
      .catch((err) => {
        console.log(err);
        onError?.();
        resolve(null);
      })
      .finally(() => {
        onFinish?.();
        //document.documentElement.classList.remove("generating-report");
      });
  });
}

// Export header constants
const EXPORT_HEADER_HEIGHT = 80;
const EXPORT_HEADER_FONT_SIZE = 28;
const EXPORT_HEADER_TEXT_Y = 48;
const EXPORT_HEADER_PADDING_LEFT = 10;
const EXPORT_HEADER_PADDING_RIGHT = 10;
const EXPORT_LOGO_WIDTH = 32;
const EXPORT_LOGO_HEIGHT = 16;
const EXPORT_LOGO_Y = 32;
const EXPORT_ELEMENT_PADDING = 16;
const EXPORT_TITLE_LOGO_GAP = 60;

// Timing constants for element polling
const ELEMENT_POLL_INTERVAL = 100;
const ELEMENT_MAX_WAIT = 5000;
const ELEMENT_SETTLE_DELAY = 1000; // Allow widgets to fully render after content detected
const ELEMENT_SETTLE_DELAY_WITH_CHART = 3000; // Longer delay for dashboards with chart/TradingView widgets

// Widget IDs that require longer settle time (charts, heavy visualizations, backend-connected widgets)
const SLOW_WIDGET_IDS = ["charting", "price_performance", "ssrm_advanced", "omni"];

// Widget types (viz types) that require longer settle time (backend-connected widgets)
const SLOW_WIDGET_TYPES = ["ssrm_advanced", "omni"];

function tabHasSlowWidget(tabId: string): boolean {
  const widgets = useAppStore.getState().items[tabId]?.data?.widgets;
  if (!Array.isArray(widgets)) return false;

  return widgets.some(
    (w) =>
      w.widgetId?.startsWith("tv_") ||
      (w.widgetId && SLOW_WIDGET_IDS.includes(w.widgetId)) ||
      SLOW_WIDGET_TYPES.includes(w.type),
  );
}

const OPENBB_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 255 127" width="32" height="16" fill="none" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M151.404 103.189v-7.937h71.733v15.874h-71.733v-7.937Zm0-63.5v-7.937h87.66v15.874h-87.66V39.69Zm95.628-23.815H135.468V127h103.596V79.374h-87.66V63.5H255V15.874h-7.968Zm-215.16 87.315v-7.937h71.733v15.874H31.873v-7.937Zm-15.936-63.5v-7.937h87.66v15.874h-87.66V39.69ZM119.532 0v15.874H0V63.5h103.596v15.874h-87.66V127h103.596V15.874h15.936V0h-15.936Z" fill="white" />
</svg>`;

async function captureElementWithHeader(
  element: Element,
  title: string,
  darkMode: boolean,
): Promise<HTMLCanvasElement> {
  const contentWidth = Math.max(element.scrollWidth, element.clientWidth);
  const contentHeight = Math.max(element.scrollHeight, element.clientHeight);

  const dataUrl = await toPng(element as HTMLElement, {
    width: contentWidth + EXPORT_ELEMENT_PADDING,
    height: contentHeight,
  });

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height + EXPORT_HEADER_HEIGHT;

      ctx.fillStyle = darkMode ? "#000000" : "rgb(246, 246, 246)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, EXPORT_HEADER_HEIGHT);

      ctx.font = `bold ${EXPORT_HEADER_FONT_SIZE}px Inter`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, EXPORT_HEADER_PADDING_LEFT, EXPORT_HEADER_TEXT_Y);

      ctx.font = `${EXPORT_HEADER_FONT_SIZE}px Inter`;
      const exportString = "| Exported with OpenBB";
      ctx.fillText(
        exportString,
        ctx.measureText(title).width + 40,
        EXPORT_HEADER_TEXT_Y,
      );

      const logoImage = new Image();
      logoImage.onload = () => {
        const titleWidth =
          ctx.measureText(title).width +
          ctx.measureText(exportString).width +
          EXPORT_TITLE_LOGO_GAP;
        ctx.drawImage(
          logoImage,
          titleWidth,
          EXPORT_LOGO_Y,
          EXPORT_LOGO_WIDTH,
          EXPORT_LOGO_HEIGHT,
        );

        const currentDate = formatDate(new Date());
        ctx.textAlign = "right";
        ctx.fillText(
          currentDate,
          canvas.width - EXPORT_HEADER_PADDING_RIGHT,
          EXPORT_HEADER_TEXT_Y,
        );

        ctx.drawImage(image, 0, EXPORT_HEADER_HEIGHT);

        resolve(canvas);
      };
      logoImage.onerror = () => reject(new Error("Failed to load logo"));
      logoImage.src = `data:image/svg+xml;base64,${btoa(OPENBB_LOGO_SVG)}`;
    };
    image.onerror = () => reject(new Error("Failed to load captured image"));
    image.src = dataUrl;
  });
}

function switchTab(tabId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tabId);
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForGridLayout(
  maxWait = ELEMENT_MAX_WAIT,
  dashboardId?: string,
): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const element = document.getElementsByClassName("react-grid-layout")[0];
    // Check element exists and has rendered content (clientHeight > 0)
    if (element && element.clientHeight > 0) {
      // Use longer delay if dashboard has slow-rendering widgets (charts, TradingView)
      const settleDelay =
        dashboardId && tabHasSlowWidget(dashboardId)
          ? ELEMENT_SETTLE_DELAY_WITH_CHART
          : ELEMENT_SETTLE_DELAY;
      await delay(settleDelay);
      return element;
    }
    await delay(ELEMENT_POLL_INTERVAL);
  }
  return null;
}

export type TabInfo = { id: string; name: string };

export async function generateMultiTabReport(
  checkIfLoadingData: () => boolean,
  tabs: TabInfo[],
  baseTitle: string,
  fileName: string,
  exportType: "png" | "pdf",
  darkMode: boolean,
  onProgress?: (current: number, total: number, tabName: string) => void,
  onFinish?: () => void,
  onError?: (error: Error) => void,
  dashboardId?: string,
): Promise<void> {
  const originalTab = new URLSearchParams(window.location.search).get("tab");
  const canvases: { name: string; canvas: HTMLCanvasElement }[] = [];

  try {
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      onProgress?.(i + 1, tabs.length, tab.name);

      switchTab(tab.id);
      const element = await waitForGridLayout(ELEMENT_MAX_WAIT, dashboardId);
      if (!element) {
        throw new Error(`Could not find grid layout for tab: ${tab.name}`);
      }

      let isDataLoading = checkIfLoadingData();
      while (isDataLoading) {
        await delay(500);
        isDataLoading = checkIfLoadingData();
      }
      await delay(1000);

      const title = `${baseTitle} - ${tab.name}`;
      const canvas = await captureElementWithHeader(element, title, darkMode);
      canvases.push({ name: tab.name, canvas });
    }

    if (canvases.length === 0) {
      throw new Error("No content was captured for export. Please try again.");
    }

    if (exportType === "pdf") {
      const { jsPDF } = await import("jspdf");
      const firstCanvas = canvases[0].canvas;
      const pdf = new jsPDF({
        orientation: firstCanvas.width > firstCanvas.height ? "l" : "p",
        unit: "px",
        format: [firstCanvas.width, firstCanvas.height],
      });

      for (let i = 0; i < canvases.length; i++) {
        const { canvas } = canvases[i];
        if (i > 0) {
          pdf.addPage(
            [canvas.width, canvas.height],
            canvas.width > canvas.height ? "l" : "p",
          );
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 1);
        pdf.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
      }

      pdf.save(`${fileName}.pdf`);
    } else {
      const zip = new JSZip();

      for (const { name, canvas } of canvases) {
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        zip.file(`${slugify(name)}.png`, base64Data, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.zip`;
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    }

    onFinish?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  } finally {
    if (originalTab) {
      switchTab(originalTab);
    }
  }
}

export type DashboardInfo = {
  id: string;
  name: string;
  tabs: TabInfo[];
};

function navigateToDashboard(dashboardId: string, tabId?: string): void {
  const url = new URL(window.location.href);
  url.pathname = `/app/${dashboardId}`;
  if (tabId) {
    url.searchParams.set("tab", tabId);
  } else {
    url.searchParams.delete("tab");
  }
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export async function generateFolderReport(
  checkIfLoadingData: () => boolean,
  dashboards: DashboardInfo[],
  _folderName: string,
  fileName: string,
  exportType: "png" | "pdf",
  exportScope: "current" | "all-tabs",
  darkMode: boolean,
  onProgress?: (
    current: number,
    total: number,
    dashboardName: string,
    tabCurrent?: number,
    tabTotal?: number,
    tabName?: string,
  ) => void,
  onFinish?: () => void,
  onError?: (error: Error) => void,
): Promise<void> {
  const originalPath = window.location.pathname;
  const originalTab = new URLSearchParams(window.location.search).get("tab");
  const zip = new JSZip();

  try {
    for (let i = 0; i < dashboards.length; i++) {
      const dashboard = dashboards[i];
      const dashboardSlug = slugify(dashboard.name);
      const tabTotal = dashboard.tabs.length;
      onProgress?.(i + 1, dashboards.length, dashboard.name, 0, tabTotal);

      navigateToDashboard(dashboard.id, dashboard.tabs[0]?.id);

      if (exportScope === "all-tabs" && dashboard.tabs.length > 1) {
        const canvases: { name: string; canvas: HTMLCanvasElement }[] = [];

        for (let j = 0; j < dashboard.tabs.length; j++) {
          const tab = dashboard.tabs[j];
          onProgress?.(
            i + 1,
            dashboards.length,
            dashboard.name,
            j + 1,
            tabTotal,
            tab.name,
          );

          switchTab(tab.id);
          const element = await waitForGridLayout(ELEMENT_MAX_WAIT, dashboard.id);
          if (!element) continue;

          let isDataLoading = checkIfLoadingData();
          while (isDataLoading) {
            await delay(500);
            isDataLoading = checkIfLoadingData();
          }
          await delay(1000);

          const title = `${dashboard.name} - ${tab.name}`;
          const canvas = await captureElementWithHeader(element, title, darkMode);
          canvases.push({ name: tab.name, canvas });
        }

        if (exportType === "pdf") {
          if (canvases.length > 0) {
            const { jsPDF } = await import("jspdf");
            const firstCanvas = canvases[0].canvas;
            const pdf = new jsPDF({
              orientation: firstCanvas.width > firstCanvas.height ? "l" : "p",
              unit: "px",
              format: [firstCanvas.width, firstCanvas.height],
            });

            for (let k = 0; k < canvases.length; k++) {
              const { canvas } = canvases[k];
              if (k > 0) {
                pdf.addPage(
                  [canvas.width, canvas.height],
                  canvas.width > canvas.height ? "l" : "p",
                );
              }
              const dataUrl = canvas.toDataURL("image/jpeg", 1);
              pdf.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
            }

            const pdfBlob = pdf.output("blob");
            zip.file(`${dashboardSlug}.pdf`, pdfBlob);
          }
        } else {
          const dashboardFolder = zip.folder(dashboardSlug);
          for (const { name, canvas } of canvases) {
            const dataUrl = canvas.toDataURL("image/png");
            const base64Data = dataUrl.split(",")[1];
            dashboardFolder?.file(`${slugify(name)}.png`, base64Data, { base64: true });
          }
        }
      } else {
        const element = await waitForGridLayout(ELEMENT_MAX_WAIT, dashboard.id);
        if (!element) continue;

        let isDataLoading = checkIfLoadingData();
        while (isDataLoading) {
          await delay(500);
          isDataLoading = checkIfLoadingData();
        }
        await delay(1000);

        const tabName = dashboard.tabs[0]?.name || "";
        const title = tabName ? `${dashboard.name} - ${tabName}` : dashboard.name;
        const canvas = await captureElementWithHeader(element, title, darkMode);

        if (exportType === "pdf") {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? "l" : "p",
            unit: "px",
            format: [canvas.width, canvas.height],
          });
          const dataUrl = canvas.toDataURL("image/jpeg", 1);
          pdf.addImage(dataUrl, "JPEG", 0, 0, canvas.width, canvas.height);
          const pdfBlob = pdf.output("blob");
          zip.file(`${dashboardSlug}.pdf`, pdfBlob);
        } else {
          const dataUrl = canvas.toDataURL("image/png");
          const base64Data = dataUrl.split(",")[1];
          zip.file(`${dashboardSlug}.png`, base64Data, { base64: true });
        }
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.zip`;
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    onFinish?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  } finally {
    const dashboardId = originalPath.split("/app/")[1];
    if (dashboardId) {
      navigateToDashboard(dashboardId, originalTab || undefined);
    } else {
      // Restore original URL even if it's not a dashboard path
      window.history.replaceState({}, "", originalPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }
}

export function groupWidgetsBySearchCategory(widgets) {
  const groupedWidgets = {};

  for (const widgetKey in widgets) {
    const widget = widgets[widgetKey];
    const searchCategory = widget.searchCategory;

    if (groupedWidgets[searchCategory]) {
      groupedWidgets[searchCategory].push(widget);
    } else {
      groupedWidgets[searchCategory] = [widget];
    }
  }

  return groupedWidgets;
}

// *didier made this function
export function isLight(color: string) {
  // Assuming the color is in the format #RRGGBB
  try {
    const r = Number.parseInt(color.slice(1, 3), 16) / 255;
    const g = Number.parseInt(color.slice(3, 5), 16) / 255;
    const b = Number.parseInt(color.slice(5, 7), 16) / 255;

    // Calculate the relative luminance
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    return luminance > 0.5;
  } catch (_err) {
    return false;
  }
}

export function hexToRGBString(hex: string, alpha?: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);

  if (alpha !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function getRandomUserListBackgroundByEmail(email: string) {
  const COLORS = [
    "#33BBFF",
    "#6D5296",
    "#22C55E",
    "#CCBE00",
    "#F97316",
    "#E93361",
    "#006699",
  ];

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

/**
 * Ensures that the value is an array. If the value is a string, it will be split by commas.
 * @param value - The value to ensure as an array
 * @param defaultValue - The default value to return if the value is null or undefined (default: [])
 * @returns The value as an array
 **/
export function ensureArray<T>(value: T | T[], defaultValue: T[] = []): T[] {
  if (value === null || value === undefined) return defaultValue;

  if (typeof value === "string") {
    return value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as T[];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Ensures that the value is a string. If the value is an array, it will be joined by commas.
 * @param value - The value to ensure as a string
 * @returns The value as a string
 **/
export function ensureString<T>(value: T | T[]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value?.toString() || "";
}

/**
 * Scores two arrays based on the number of matches between them and the length of the larger array
 * @param arr1 - The first array to score
 * @param arr2 - The second array to score
 * @param iterSmArray - Whether to iterate over the smaller array (default: false)
 * @returns The score and the matches between the arrays
 * @example
 * const { score, matches } = scoreArrays([1, 2, 3], [2, 3, 4]);
 * // score = 0.6666666666666666
 * // matches = [2, 3]
 **/
export function scoreArrays<T>(
  arr1: T[],
  arr2: T[],
  iterSmArray = false,
): { score: number; matches: T[] } {
  if (!areTruthy(arr1, arr2)) return { score: 0, matches: [] };

  let score = 0;
  const matches = [];
  const [smArray, lgArray] = [arr1, arr2].sort((a, b) =>
    iterSmArray ? b.length - a.length : a.length - b.length,
  );

  for (const element of lgArray) {
    if (smArray.includes(element) && !matches.includes(element)) {
      score++;
      matches.push(element);
    }
  }

  return { score: score / lgArray.length, matches };
}

/**
 * Merges two objects recursively, removing any functions and merging objects.
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @param withFunctions - Whether to include functions in the merged object (default: false)
 * @returns The merged object
 * @example
 * const target = { a: 1, b: { c: 2 } };
 * const source = { a: 2, b: { d: 3 } };
 * const merged = mergeObjects(target, source);
 * // merged = { a: 2, b: { c: 2, d: 3 } }
 *
 **/
export function mergeObjects<T, U>(target: T, source: U, withFunctions = false): T & U {
  try {
    const sourceKeys = Object.keys(source || {});

    for (const key of Object.keys(source || {})) {
      let removeKey = false;
      if (typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target?.[key]) Object.assign(target, { [key]: {} });

        Object.assign(
          target[key],
          mergeObjects(target[key], source[key], withFunctions),
        );
        removeKey = true;
      }
      if (Array.isArray(source[key])) {
        Object.assign(target, { [key]: source[key] });
        removeKey = true;
      }

      removeKey && sourceKeys.splice(sourceKeys.indexOf(key), 1);
    }

    for (const key of sourceKeys) {
      if (typeof source[key] !== "object") {
        if (typeof source[key] !== "function" || withFunctions) {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return target as T & U;
  } catch (e) {
    console.log(`Error in mergeObjects: ${e}`);
    return (target || {}) as T & U;
  }
}

/**
 * Filter out any functions from the source object or array
 * @param source - The source object or array
 * @example
 * const source = { a: 1, b: () => {}, c: { d: 2, e: () => {} } };
 * const result = filterFunctions(source);
 * // result = { a: 1, c: { d: 2 } }
 */
export function filterFunctions<T>(source: T | T[]): T | T[] {
  if (Array.isArray(source)) {
    return source.map((item) => mergeObjects({} as T, item));
  }
  if (typeof source === "object") {
    return mergeObjects({} as T, source);
  }

  return source;
}

/**
 * Formats the file size in bytes to a human-readable format
 * @param bytes - The file size in bytes
 * @param decimalCases - The number of decimal cases to display (default: 0)
 * @returns The file size in a human-readable format
 **/
export const formatFileSize = (bytes: number, decimalCases = 0): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(decimalCases)}${units[unitIndex]}`;
};

/**
 *  Get the booking URL
 *  @returns The booking URL
 */
export function getBookingUrl(): string {
  const { user, name } = useAuthStore.getState();
  return `/booking?used_before=Yes&email=${user.email}&first_name=${name.first}&last_name=${name.last}&from_pro=true`;
}

/**
 * Append -2, -3, ... until the slug is unique, truncating the base so the
 * result stays within the skill slug length limit.
 */
export function ensureUniqueSlug(
  base: string,
  isSlugUnique: (slug: string) => boolean,
): string {
  if (isSlugUnique(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, MAX_SKILL_SLUG_LENGTH - suffix.length)}${suffix}`;
    if (isSlugUnique(candidate)) return candidate;
  }
}
