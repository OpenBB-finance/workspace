import dayjs from "dayjs";
import type {
  FormInputParamDef,
  ParamDef,
  Ticker,
  WidgetJsonT,
  WidgetT,
} from "~/components/types";
import { getConfig } from "~/lib/runtimeConfig";
import type { AuthStore } from "~/lib/state/auth";
import { DEFAULT_TICKERS } from "~/lib/types";
import { newParamDef, ParamsSchema } from "~/lib/types/app";
import type { WidgetType } from "~/utils/zodForms";

function getAuthFlags() {
  const cfg = getConfig();
  return {
    sendMicrosoftIdToken: cfg.authentication.sendMicrosoftIdToken,
    sendOktaIdToken: cfg.authentication.sendOktaIdToken,
    sendUserEmailAsHeader: cfg.authentication.sendUserEmailAsHeader,
  };
}

// Avoids importing the entire auth store in this utils file, which causes `heap out of memory` on build.
export function getAuthStore() {
  const AuthStore = {
    getState: () => {
      const localState = localStorage.getItem("auth-storage");
      return localState ? (JSON.parse(localState).state ?? {}) : {};
    },
  } as AuthStore;
  return AuthStore;
}

// ! backwards compatibility - Helper function to convert endpointHeaders to Record format if it's in array format
export function convertHeadersToRecord<PT extends object = Record<string, any>>(
  headers: Record<string, string> | WidgetT["endpointHeaders"],
  params: PT = {} as PT,
) {
  headers = headers || {};

  if (Array.isArray(headers)) {
    const newHeaders = headers.reduce((acc, { key, value, location = "headers" }) => {
      if (location === "headers") acc[key] = value;
      else params[key] = value;

      return acc as Record<string, string>;
    }, {});

    headers = addExtraHeaders(newHeaders);
    return { headers, newParams: params };
  }

  headers = addExtraHeaders(headers);
  // If it's already in the correct format, return it directly
  return { headers, newParams: params };
}

export function addExtraHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  const flags = getAuthFlags();
  if (typeof window === "undefined") return headers; // Ensure this code only runs in the browser
  const useAuthStore = getAuthStore();
  if (flags.sendMicrosoftIdToken) {
    const microsoftIdToken = useAuthStore.getState().microsoftIdToken;
    if (microsoftIdToken) headers["X-Microsoft-Id-Token"] = microsoftIdToken;
  }
  if (flags.sendOktaIdToken) {
    const oktaIdToken = useAuthStore.getState().oktaIdToken;
    if (oktaIdToken) headers["X-Okta-Id-Token"] = oktaIdToken;
  }
  if (flags.sendUserEmailAsHeader) {
    const email = useAuthStore.getState().user?.email;
    if (email) headers["X-OpenBB-User"] = email;
  }
  return headers;
}

export function cleanURL(url: string) {
  return url?.replace(/([^:]\/)\/+/g, "$1")?.replace(/\/+$/, "");
}

/**
 * Creates a URL string based on the provided endpoint and base URL.
 * @param endpoint - The endpoint to create the URL for.
 * @param base - The base URL to combine with the endpoint. If not provided, defaults to an empty string.
 * @return A cleaned URL string.
 * @example
 * createURLString("widget.json", "https://example.com/openbb");
 * // Returns: "https://example.com/openbb/widget.json"
 */
export function createURLString(endpoint: string, base?: string | URL) {
  // If the endpoint is a data URI, return it as is (without cleanURL to preserve the format)
  if (endpoint?.startsWith("data:")) return endpoint;

  // If the endpoint is a full URL, return it cleaned
  if (endpoint?.startsWith("http")) return cleanURL(endpoint);

  const baseURL = base?.toString() || "";
  // Otherwise, create a new URL based on the base URL and endpoint
  return cleanURL(`${baseURL}/${endpoint}`);
}

/** {@link createURLString} but returns a URL object instead of a string + appends query parameters to the URL */
export function createURL(
  endpoint: string,
  base?: string | URL,
  params?: Record<string, any>,
) {
  const url = new URL(createURLString(endpoint, base));
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.append(key, value);
  }

  return url;
}

const pathUrlRegex = /{([^}]+)}/g;

export function parseMarkdownParams(value: string, params: Record<string, string>) {
  if (!value || typeof value !== "string")
    return { parsedValue: value, newParams: params };

  const matches = value.match(pathUrlRegex);

  if (!matches) return { parsedValue: value, newParams: params };

  const newParams = { ...params };

  for (const match of matches) {
    const key = match.slice(1, -1);
    delete newParams[key];
    value = value.replace(match, params[key] || "");
  }

  return { parsedValue: value, newParams };
}

export function parsePathParams(url: string, params: Record<string, string>) {
  const { parsedValue, newParams } = parseMarkdownParams(url, params);
  const newUrl = new URL(parsedValue);

  return { newUrl, newParams };
}

// Helper function to clean the URL and add any query parameters
export function cleanSearchParams(
  url: string | WidgetT["endpoint"],
  params: { [key: string]: string } | undefined = undefined,
) {
  url = typeof url === "string" ? url : url?.url;
  if (!url) return "";
  if (!url?.toString()?.includes("http")) return url;

  const { newParams, newUrl } = parsePathParams(url, params ?? {});

  // If the url already has the query parameters, dont add them here
  if (!url?.includes("?")) {
    for (const [key, value] of Object.entries(newParams)) {
      if (value !== undefined && value !== "" && value !== null)
        newUrl.searchParams.set(key, value);
    }
  }

  // Remove empty query parameters
  for (const [key, value] of newUrl.searchParams.entries()) {
    if (value === undefined || value === "" || value === null)
      newUrl.searchParams.delete(key);
  }

  return newUrl.toString();
}

type DateModifier<T = number> = {
  mod: "+" | "-";
  amt: T;
  unit: Extract<dayjs.ManipulateType, "h" | "d" | "w" | "M" | "Q" | "y"> | "b";
};

export type DateModifierValue =
  `$currentDate${DateModifier["mod"]}${DateModifier["amt"]}${DateModifier["unit"]}`;

export const dateModRegex = new RegExp(
  /(?:\$(currentDate)(?<mod>[+-]))(?<amt>(\d+))(?<unit>([bhdwmyq]))/i,
);

function modFunction(date: dayjs.Dayjs, dateModifier: DateModifier<string>) {
  const { mod, amt, unit } = dateModifier;
  const num = Number(amt);
  if (unit === "b") {
    return mod === "+" ? date.businessDaysAdd(num) : date.businessDaysSubtract(num);
  }
  return mod === "+" ? date.add(num, unit) : date.subtract(num, unit);
}

export function getDate(date: DateModifierValue | string) {
  return date && dayjs(currentDateModifier(date));
}

const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/;

export function isDate(value: any): boolean {
  return datePattern.test(value?.toString()) && dayjs(value).isValid();
}

export function currentDateModifier(value: DateModifierValue | string) {
  // If it's a regular date string (YYYY-MM-DD), return it as is
  if (isDate(value)) return value;

  const match = dateModRegex.exec(value);
  let date = dayjs();

  if (match) {
    match.groups.unit = match.groups.unit.replace("m", "M").replace("q", "Q");
    date = modFunction(date, match.groups as DateModifier<string>);
  }

  return date.format("YYYY-MM-DD");
}

function handleEndpointParam<T extends ParamDef | FormInputParamDef>(
  param: T,
  backendURL: string,
  groupIdCounts: Record<string, number>,
): T {
  if (param?.type === "endpoint" && backendURL) {
    param.groupById = param?.optionsEndpoint?.split("/")?.pop();
    if (groupIdCounts[param.groupById] > 1) {
      param.groupById = `${param.paramName}-${param.groupById}`;
    }
    param.optionsEndpoint = createURLString(param.optionsEndpoint, backendURL);
  }
  return param;
}

function populateGroupByIdCounts(
  params: ParamDef[],
  objectToMutate: Record<string, number>,
) {
  for (const p of params) {
    if (p?.type === "endpoint") {
      const groupById = p?.optionsEndpoint?.split("/")?.pop();
      if (!objectToMutate[groupById]) objectToMutate[groupById] = 0;
      objectToMutate[groupById] = objectToMutate[groupById] + 1;
    }
  }
}

export function createParamDefs(
  widget: Partial<WidgetJsonT | WidgetType | WidgetT>,
  backendURL?: string,
): ParamDef[] {
  const params = ParamsSchema.safeParse(widget.params);
  const groupIdCounts = {} as Record<string, number>;

  if (params.success) {
    if (backendURL) populateGroupByIdCounts(params.data, groupIdCounts);

    return params.data.map((param) => {
      param = handleEndpointParam(param, backendURL, groupIdCounts);

      if (param?.type === "form") {
        const inputParams = param?.inputParams?.map((innerParam) => {
          innerParam = handleEndpointParam(innerParam, backendURL, groupIdCounts);
          return newParamDef(innerParam);
        });

        if (param?.endpoint && backendURL) {
          param.endpoint = createURLString(param.endpoint, backendURL);
        }
        return newParamDef({ ...param, inputParams });
      }

      return param?.paramName ? newParamDef(param) : param;
    });
  }

  return widget.params as ParamDef[];
}

export function createWidgetEndpoint(
  url: string | WidgetT["endpoint"],
  endpointHeaders: WidgetT["endpointHeaders"] = [],
): WidgetT["endpoint"] {
  const newEndpoint = {
    query: {},
    headers: {},
    ...(typeof url === "string" ? { url } : url),
    method: "GET",
  } as WidgetT["endpoint"];

  newEndpoint.url = cleanURL(newEndpoint.url);

  const { headers = {}, query = {} } = endpointHeaders.reduce(
    (acc, { key, value, location = "headers" }) => {
      acc[location][key] = value;
      return acc;
    },
    { headers: newEndpoint.headers, query: newEndpoint.query },
  );

  return { ...newEndpoint, headers, query };
}

export function createWidgetInitParams(
  widget: WidgetT | WidgetJsonT,
  mainTicker: Ticker = DEFAULT_TICKERS.AAPL,
): Record<string, any> {
  const params = createParamDefs(widget) as ParamDef[];
  const storage = widget?.storage?.params ?? {};

  return Object.fromEntries(
    params
      .filter((param) =>
        [param?.value, storage?.[param.paramName]].some((v) => v !== undefined),
      )
      .map((param) => {
        if (storage?.[param.paramName] !== undefined) {
          return [param.paramName, storage[param.paramName]];
        }

        let value = param.value;

        if (param?.type === "date" && !dayjs(param.value).isValid()) {
          value = [null, undefined].includes(value)
            ? value
            : currentDateModifier(param.value);
        }
        if (param?.type === "ticker") {
          value = mainTicker.symbol;
        }
        return [param.paramName, value];
      }),
  );
}
