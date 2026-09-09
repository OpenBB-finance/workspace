import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  useContext,
  useMemo,
} from "react";

type ExternalLinkContextValue = {
  openExternalLink: (url: string) => void;
};

export const ExternalLinkContext = createContext<ExternalLinkContextValue | null>(null);

/** Null when rendered outside an `ExternalLinkProvider` (callers fall back to plain new-tab links). */
export function useExternalLink() {
  return useContext(ExternalLinkContext);
}

/**
 * Props to spread onto an `<a>` so a plain left-click opens the external-link dialog
 * instead of navigating. Returns `null` outside a provider, leaving the link untouched.
 * Modifier/non-left clicks fall through so the browser's native new-tab behavior still works.
 */
export function useExternalLinkAnchorProps(href?: string) {
  const external = useExternalLink();
  return useMemo(() => {
    if (!external || !href) return null;
    return {
      onClick: (e: ReactMouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        external.openExternalLink(href);
      },
    };
  }, [external, href]);
}
