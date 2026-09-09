import debounce from "lodash.debounce";
import isEqual from "lodash.isequal";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { getUserPrompts, postUserPrompts } from "~/api/auth.api";
import { uuidv4 } from "../utils";
import type { Selector } from "./app";

export interface Prompt {
  id: string;
  prompt: string;
  widgets?: string[]; // array of widgetId
  createdAt: string;
  updatedAt: string;
}

interface PromptLibraryState {
  prompts: Prompt[];
  addPromptDialogOpen: boolean;
  editingPromptId: string | null;
  setEditingPromptId: (id: string | null) => void;
  setAddPromptDialogOpen: (open: boolean) => void;
  addPrompt: (prompt: Omit<Prompt, "id" | "createdAt" | "updatedAt">) => void;
  removePrompt: (id: string) => void;
  removePrompts: (ids: string[]) => void;
  updatePrompt: (id: string, prompt: Partial<Prompt>) => void;
  getPromptById: (id: string) => Prompt | undefined;
  reorderPrompts: (newOrder: Prompt[]) => void;
  uploadUserPrompts: () => Promise<void>;
  debounceUpdatePrompts: () => Promise<void>;
  initializePrompts: () => Promise<void>;
}

export const usePromptLibraryStore = create<PromptLibraryState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        reorderPrompts: (newOrder) => {
          set({ prompts: newOrder });
          get().debounceUpdatePrompts();
        },
        editingPromptId: null,
        setEditingPromptId: (id) => set({ editingPromptId: id }),
        prompts: [],
        addPromptDialogOpen: false,
        setAddPromptDialogOpen: (open) => set({ addPromptDialogOpen: open }),
        addPrompt: (promptData) => {
          const now = new Date().toISOString();
          const newPrompt: Prompt = {
            id: uuidv4(),
            ...promptData,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            prompts: [newPrompt, ...state.prompts],
          }));
          get().debounceUpdatePrompts();
        },
        removePrompt: (id) => {
          set((state) => ({
            prompts: state.prompts.filter((p) => p.id !== id),
          }));
          get().debounceUpdatePrompts();
        },
        /**
         * Removes multiple prompts by their IDs in a single batch operation.
         * Uses a Set for O(1) lookup performance when filtering.
         */
        removePrompts: (ids) => {
          const idsSet = new Set(ids);
          set((state) => ({
            prompts: state.prompts.filter((p) => !idsSet.has(p.id)),
          }));
          get().debounceUpdatePrompts();
        },
        updatePrompt: (id, promptData) => {
          set((state) => ({
            prompts: state.prompts.map((p) =>
              p.id === id
                ? {
                    ...p,
                    ...promptData,
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
          }));
          get().debounceUpdatePrompts();
        },
        getPromptById: (id) => {
          return get().prompts.find((p) => p.id === id);
        },
        uploadUserPrompts: async () => {
          const { prompts } = get();
          await postUserPrompts(prompts);
        },
        debounceUpdatePrompts: debounce(async () => {
          await get().uploadUserPrompts();
        }, 2000),
        initializePrompts: async () => {
          try {
            const dbPrompts = await getUserPrompts();
            set((state) => {
              // Create a map of existing prompts by ID for quick lookup
              const existingPromptsMap = new Map(
                state.prompts.map((prompt) => [prompt.id, prompt]),
              );

              // For each prompt from DB, either keep existing or add new
              dbPrompts.forEach((dbPrompt) => {
                const existingPrompt = existingPromptsMap.get(dbPrompt.id);
                if (existingPrompt) {
                  // If local version is more recent, keep it
                  if (
                    new Date(existingPrompt.updatedAt) > new Date(dbPrompt.updatedAt)
                  ) {
                    existingPromptsMap.set(dbPrompt.id, existingPrompt);
                  } else {
                    // Otherwise use DB version
                    existingPromptsMap.set(dbPrompt.id, dbPrompt);
                  }
                } else {
                  // If prompt doesn't exist locally, add it
                  existingPromptsMap.set(dbPrompt.id, dbPrompt);
                }
              });

              return {
                prompts: Array.from(existingPromptsMap.values()),
              };
            });
          } catch (error) {
            console.error("Failed to fetch prompts:", error);
          }
        },
      }),
      {
        name: "prompt-library-storage",
      },
    ),
  ),
);

export function useShallowPromptLibraryStore<T>(
  selector: Selector<PromptLibraryState, T>,
): T {
  return useStoreWithEqualityFn(
    usePromptLibraryStore,
    useShallow(selector),
    (prev, next) => isEqual(prev, next),
  );
}
