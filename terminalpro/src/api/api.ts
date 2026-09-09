import axios, { type AxiosError } from "axios";
import { getConfig } from "~/lib/runtimeConfig";
import { useAuthStore } from "~/lib/state/auth";

export const apiClient = axios.create({});

apiClient.interceptors.request.use((config) => {
  // Dynamically resolve baseURL from runtime config on each request
  if (!config.baseURL) {
    config.baseURL = getConfig().urls.backend;
  }
  const { user } = useAuthStore.getState();
  const token = user?.token;

  if (import.meta.env.DEV)
    console.info(
      "[API req]",
      token ? "[Authed]" : "",
      `${config.method?.toUpperCase()} ${config.url}`,
    );

  // A request that pre-sets its own Authorization header keeps it. An
  // explicitly EMPTY one (`headers: { authorization: "" }`) opts out of auth
  // entirely: the header is removed rather than sent empty, so cross-origin
  // requests (e.g. the lite marketplace listing) stay CORS-simple — any
  // Authorization header, even "", would trigger a preflight the host rejects.
  const presetAuth = config.headers.has?.("Authorization");
  if (presetAuth && !config.headers.get("Authorization")) {
    config.headers.delete("Authorization");
  } else if (token && !presetAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV)
      console.info(
        `[API res] ${response.status} ${response.config.url}`,
        response.data,
        response,
      );

    return response;
  },
  (error: AxiosError) => {
    const { response } = error;
    const { logout, user } = useAuthStore.getState();
    const status = response?.status || error?.status || "unknown";

    if (error?.code !== "ERR_CANCELED" && import.meta.env.DEV)
      console.info(`[API err] ${status} ${error?.config?.url}`, error);

    if (
      response?.status === 401 &&
      user?.token &&
      !error.config.url?.includes("/pro/logout")
    ) {
      logout();
    }

    return Promise.reject(error);
  },
);
