import isEqual from "lodash.isequal";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import type { Selector } from "~/lib/state/app";
import type { Mention } from "~/lib/state/copilot";

export type MentionsState = {
  optionsMap: Record<string, Mention>;
  setOptionsMap: (optionsMap: Map<string, Mention>) => void;
  getMention: (id: string) => Mention | undefined;
  getOptionsArray: () => Mention[];
  getOptionsMap: () => Record<string, Mention>;
};

export const useMentionsStore = createWithEqualityFn<MentionsState>()(
  subscribeWithSelector((set, get: () => MentionsState) => ({
    optionsMap: {},
    setOptionsMap: (optionsMap) => set({ optionsMap: Object.fromEntries(optionsMap) }),
    getOptionsArray: () => Object.values(get().optionsMap),
    getOptionsMap: () => get().optionsMap,
    getMention: (id) => {
      const fallback = id?.split?.("&")?.[0]?.split("=")?.[1];
      return get().optionsMap[id] || get().optionsMap[fallback];
    },
  })),
  shallow,
);

export function useShallowMentionsStore<S extends MentionsState, T>(
  selector: Selector<S, T>,
): T {
  return useMentionsStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
