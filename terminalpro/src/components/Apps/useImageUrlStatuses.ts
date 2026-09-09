import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HTTP_URL_RE } from "~/lib/utils/externalUrl";

export type ImageUrlStatus = "loading" | "loaded" | "error";
export type SettledImageStatus = Extract<ImageUrlStatus, "loaded" | "error">;

const DEBOUNCE_MS = 500;
const TIMEOUT_MS = 15_000;

const normalize = (url: string) => url.trim();
const probeable = (url: string) => HTTP_URL_RE.test(url);

export interface UseImageUrlStatusesResult {
  /** Live status per trimmed URL. Absent key = not probed (blank / bad format). */
  statuses: Record<string, ImageUrlStatus>;
  /**
   * Probe the given URLs now (skipping the debounce) and resolve once each has
   * settled. Used as the hard gate on submit. Non-http(s) URLs are ignored.
   */
  ensureSettled: (urls: string[]) => Promise<Record<string, SettledImageStatus>>;
  /** Drop cached failures so a fresh dialog session re-probes them. */
  resetErrors: () => void;
}

/**
 * Actually loads each image URL (via `new Image()`) to detect broken or
 * non-public links that pass a plain URL-format check — e.g. Google Drive /
 * Dropbox share links, 403s, or non-image responses all fire `onerror`.
 *
 * Must be called from a component that stays mounted for the whole flow: the
 * submission dialog remounts its step content on every step change, so a
 * per-field probe would lose its state. Results are cached by URL for the
 * hook's lifetime; {@link UseImageUrlStatusesResult.resetErrors} clears failures.
 */
export function useImageUrlStatuses(urls: string[]): UseImageUrlStatusesResult {
  const [statuses, setStatuses] = useState<Record<string, ImageUrlStatus>>({});
  const cacheRef = useRef<Map<string, ImageUrlStatus>>(new Map());
  const probesRef = useRef<Map<string, Promise<SettledImageStatus>>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    },
    [],
  );

  const setStatus = useCallback(
    (url: string, status: ImageUrlStatus) => {
      cacheRef.current.set(url, status);
      if (mountedRef.current) {
        setStatuses((prev) =>
          prev[url] === status ? prev : { ...prev, [url]: status },
        );
      }
    },
    [cacheRef, mountedRef],
  );

  const probe = useCallback(
    (url: string): Promise<SettledImageStatus> => {
      const existing = probesRef.current.get(url);
      if (existing) return existing;
      const p = new Promise<SettledImageStatus>((resolve) => {
        const img = new Image();
        let settled = false;
        const finish = (status: SettledImageStatus) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          img.onload = null;
          img.onerror = null;
          setStatus(url, status);
          resolve(status);
        };
        const timeout = setTimeout(() => finish("error"), TIMEOUT_MS);
        img.onload = () => finish("loaded");
        img.onerror = () => finish("error");
        img.src = url;
      });
      probesRef.current.set(url, p);
      return p;
    },
    [probesRef],
  );

  // Schedule a debounced probe for every newly-seen probeable URL, and cancel
  // pending debounces for URLs the user has since edited away (still typing).
  const urlsKey = useMemo(
    () => urls.map(normalize).filter(probeable).join("\n"),
    [urls],
  );
  useEffect(() => {
    const active = new Set(urls.map(normalize).filter(probeable));
    for (const [url, timer] of timersRef.current.entries()) {
      if (!active.has(url)) {
        clearTimeout(timer);
        timersRef.current.delete(url);
      }
    }
    for (const url of active) {
      if (
        cacheRef.current.has(url) ||
        probesRef.current.has(url) ||
        timersRef.current.has(url)
      ) {
        continue;
      }
      setStatus(url, "loading");
      const timer = setTimeout(() => {
        timersRef.current.delete(url);
        probe(url);
      }, DEBOUNCE_MS);
      timersRef.current.set(url, timer);
    }
  }, [urlsKey, probe, setStatus]);

  const ensureSettled = useCallback(
    async (targets: string[]): Promise<Record<string, SettledImageStatus>> => {
      const result: Record<string, SettledImageStatus> = {};
      await Promise.all(
        targets
          .map(normalize)
          .filter(probeable)
          .map(async (url) => {
            const cached = cacheRef.current.get(url);
            if (cached === "loaded" || cached === "error") {
              result[url] = cached;
              return;
            }
            const timer = timersRef.current.get(url);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(url);
            }
            result[url] = await probe(url);
          }),
      );
      return result;
    },
    [probe, cacheRef, timersRef],
  );

  const resetErrors = useCallback(() => {
    let changed = false;
    cacheRef.current.forEach((status, url) => {
      if (status === "error") {
        cacheRef.current.delete(url);
        probesRef.current.delete(url);
        changed = true;
      }
    });
    if (changed && mountedRef.current) {
      setStatuses((prev) => {
        const next: Record<string, ImageUrlStatus> = {};
        for (const [url, status] of Object.entries(prev)) {
          if (status !== "error") next[url] = status;
        }
        return next;
      });
    }
  }, [mountedRef, cacheRef, probesRef]);

  return { statuses, ensureSettled, resetErrors };
}
