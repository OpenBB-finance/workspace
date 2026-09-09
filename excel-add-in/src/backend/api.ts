import axios from "axios";
import { useAuthStore } from "~/store/auth";
import { VITE_BACKEND_URL } from "../constants";

export const backendClient = axios.create({
  // withCredentials: true,
  baseURL: VITE_BACKEND_URL,
});

if (typeof window !== "undefined") {
  // window.backendClient = backendClient;
}

backendClient.interceptors.request.use((config) => {
  const { user } = useAuthStore.getState();
  const token = user?.access_token;

  console.info(
    `[Backend req]`,
    token ? "[Authed]" : "",
    `${config.method?.toUpperCase()} ${config.url}`,
  );

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

backendClient.interceptors.response.use(
  (response) => {
    console.info(
      `[Backend res] ${response.status} ${response.config.url}`,
      // response.data,
      // response,
    );

    return response;
  },
  (error) => {
    const { response } = error;
    const { logout } = useAuthStore.getState();

    if (!response) {
      console.error("[Backend err] No response", error);
      error.message = "No response.";
      return Promise.reject(error);
    }

    console.info(`[Backend err] ${response.status} ${response.config.url}`, error);
    if (response.status === 401) {
      console.log("🚫 User token is not valid.")
      logout();
    }

    return Promise.reject(error);
  },
);
