import { useCallback } from "react";
import { useShallowAuthStore } from "~/lib/state/auth";

export function useNewEndpoint() {
  const userUuid = useShallowAuthStore((authState) => authState.user.uuid);

  const newEndpoint = useCallback(
    (
      originalUrl: string,
      newId: number,
    ): { url: string; method: "POST" | "GET"; headers?: { [key: string]: string } } => {
      const index = originalUrl.lastIndexOf("/");
      const url = `${originalUrl.substring(0, index + 1)}${newId}`;
      return {
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${userUuid}`,
        },
      };
    },
    [userUuid],
  );

  return newEndpoint;
}
