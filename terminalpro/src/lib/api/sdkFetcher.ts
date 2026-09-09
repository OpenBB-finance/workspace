import axios, { type AxiosError } from "axios";
import { VERSION } from "../constants";
import { getConfig } from "../runtimeConfig";
import { useAuthStore } from "../state/auth";
import type { SdkContext } from "./sdkContext";

export const sdkClient = axios.create({});

sdkClient.interceptors.request.use((config) => {
  const platformUrl = getConfig().urls.platform;
  if (!config.baseURL) {
    config.baseURL = platformUrl;
  }

  const user = useAuthStore.getState().user;
  const token = user?.token;

  if (token) {
    config.headers.Accept = "application/json";
    config.headers["Content-Type"] = "application/json";
    config.headers.Authorization = `Bearer ${token}`;
    config.headers["X-OpenBB-Client"] = `${platformUrl}`?.replace(
      "sdk",
      "pro",
    ) as string;
    config.headers["X-OpenBB-Client-Version"] = VERSION as string;
  }

  return config;
});

sdkClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    const { response } = error;
    const { logout } = useAuthStore.getState();
    const statusText = response?.statusText || error?.status || "unknown";

    if (import.meta.env.DEV && error?.code !== "ERR_CANCELED")
      console.info(`[API err] ${statusText} ${response?.config?.url}`, error);

    if (!import.meta.env.DEV && (response?.status === 401 || error?.status === 401)) {
      logout();
    }

    return Promise.reject(error);
  },
);

export type ErrorWrapper<TError> = TError & {
  status?: 400 | 401 | 403 | 404 | 500 | 422 | "unknown";
  payload?: string;
  detail?: string;
  message?: string;
  error_kind?: string;
  status_code?: number;
};

export type SdkFetcherOptions<TBody, THeaders, TQueryParams, TPathParams> = {
  url: string;
  method: string;
  body?: TBody;
  headers?: THeaders;
  queryParams?: TQueryParams;
  pathParams?: TPathParams;
  signal?: AbortSignal;
} & SdkContext["fetcherOptions"];

export async function sdkFetch<
  TData,
  TError,
  TBody extends {} | FormData | undefined | null,
  THeaders extends {},
  TQueryParams extends {},
  TPathParams extends {},
>({
  url,
  method,
  body,
  pathParams,
  queryParams,
  signal,
}: SdkFetcherOptions<TBody, THeaders, TQueryParams, TPathParams>): Promise<TData> {
  return sdkClient
    .request<TData>({
      url: resolveUrl(url, queryParams, pathParams),
      method: method.toUpperCase(),
      data: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      signal,
    })
    .then(async (response) => {
      if (response.status >= 400) {
        let error: ErrorWrapper<TError>;

        try {
          error = response.data as ErrorWrapper<TError>;
          if (import.meta.env.DEV) console.log({ ...queryParams, url });
        } catch (e) {
          // @ts-expect-error
          error = {
            status: "unknown" as const,
            payload:
              e instanceof Error
                ? `Unexpected error (${e.message})`
                : "Unexpected error",
          };
          if (import.meta.env.DEV) console.log(url, error, e);
        }

        throw new Error(error.detail, {
          cause: error.error_kind,
        });
      }

      // @ts-expect-error
      const warnings = response.data?.warnings;

      if (warnings?.length && import.meta.env.DEV)
        for (const warning of warnings) console.warn(warning);

      return response.data as TData;
    })
    .catch((e: AxiosError) => {
      const response = (e?.response || {}) as { data: ErrorWrapper<unknown> };
      const errorData = response?.data;

      const message =
        errorData?.detail || errorData?.message || errorData?.error_kind || errorData;

      const errorName = errorData?.error_kind || e.name || "unknown";
      const errorObject: Error = {
        cause: { ...queryParams, url },
        name: errorName,
        message: JSON.stringify(message)?.replace(
          " Try adjusting the query parameters.",
          "",
        ),
        stack: e as unknown as string,
      };
      throw errorObject;
    });
}

const resolveUrl = (
  url: string,
  queryParams: Record<string, string> = {},
  pathParams: Record<string, string> = {},
) => {
  let query = new URLSearchParams(queryParams).toString();
  if (query) query = `?${query}`;
  return url.replace(/\{\w*\}/g, (key) => pathParams[key.slice(1, -1)]) + query;
};
