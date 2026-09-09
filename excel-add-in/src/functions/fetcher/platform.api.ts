import axios from "axios";
import { handleErrors } from "~/functions/fetcher/errors";
import { useAuthStore } from "~/store/auth";
import { VERSION, VITE_ADDIN_BASE_URL, VITE_PLATFORM_URL } from "~/constants";

export const platformClient = axios.create({
  // withCredentials: true,
  baseURL: VITE_PLATFORM_URL,
});

if (typeof window !== "undefined") {
  // window.platformClient = platformClient;
}

platformClient.interceptors.request.use((config) => {
  const { user } = useAuthStore.getState();
  const token = user?.access_token;
  const filteredVersion = VERSION ? VERSION.replace(".", "_") : "0_0.0.0";

  console.info(
    `[Platform req]`,
    token ? "[Authed]" : "",
    `${config.method?.toUpperCase()} ${config.url}`,
  );

  config.headers["Content-Type"] = "application/json";
  config.headers["X-OpenBB-Client"] = VITE_ADDIN_BASE_URL ?? "excel";
  config.headers["X-OpenBB-Client-Version"] = filteredVersion;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

platformClient.interceptors.response.use(
  (response) => {
    console.info(`[Platform res] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const { response } = error;
    if (!response.ok) {
      const { data: errorResponse } = response;
      handleErrors(errorResponse, response.status, response.config.baseURL);
    }
    return Promise.reject(error);
  },
);
