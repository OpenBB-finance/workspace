import Fuse from "fuse.js";
import { useCallback, useMemo } from "react";
import {
  type SemanticView,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";

export const SV_TRIGGER = "/sv:";

export interface SemanticViewSuggestion extends SemanticView {
  type: "semanticView";
  /** ### Semantic View Slash Text
   *  Formatted as `/sv:{fqn}`. */
  slashText: string;
}

export function useSemanticViewSuggestions() {
  const semanticViews = useShallowBackendConnectorStore((s) => s.semanticViews);

  const svOptions = useMemo<SemanticViewSuggestion[]>(
    () =>
      Object.values(semanticViews).map((v) => ({
        ...v,
        type: "semanticView",
        // Non-breaking space/hyphen to prevent textarea line breaks
        slashText: `/sv:${v.fqn}`.replace(/ /g, "\u00A0").replace(/-/g, "\u2011"),
      })),
    [semanticViews],
  );

  const fuse = useMemo(
    () =>
      new Fuse(svOptions, {
        keys: ["viewName", "database", "schema", "baseTable", "comment"],
        threshold: 0.3,
      }),
    [svOptions],
  );

  const searchSemanticViews = useCallback(
    (query: string): SemanticViewSuggestion[] => {
      const searchTerm = query.startsWith(SV_TRIGGER)
        ? query.slice(SV_TRIGGER.length)
        : query;

      if (!searchTerm) return svOptions;

      return fuse
        .search(searchTerm)
        .map((result) => {
          // Drop results that don't partially match the query if ends with a space
          // "RSS F" -> ["RSS Feeds"]
          // "RSS Feeds " -> []
          if (query.length > result.item.slashText.length) return null;
          return result.item;
        })
        .filter(Boolean);
    },
    [svOptions, fuse],
  );

  return {
    svOptions,
    searchSemanticViews,
    hasSemanticViews: svOptions.length > 0,
  };
}
