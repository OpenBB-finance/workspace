import { USER_AGENT_BACKEND } from "~/lib/constants";

export function getHeaders(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT_BACKEND,
    Authorization: `Bearer ${token}`,
  };
}
