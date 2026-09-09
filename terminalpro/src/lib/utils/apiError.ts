import { AxiosError } from "axios";

/**
 * The backend's error message (FastAPI `detail`) for showing in a toast, with a
 * fallback when the error isn't an axios response (e.g. a thrown client Error).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    return detail || error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
