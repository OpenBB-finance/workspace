import isEqual from "lodash.isequal";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { getActiveDefaultSkills } from "~/components/AI/skills";
import type {
  DefaultSkillSlugs,
  Skill,
  SkillCatalogEntry,
  SkillCreate,
} from "~/types/auth.type";
import type { Selector } from "./app";
import { useThemeStore } from "./theme";

// Re-export types for convenience
export type { Skill, SkillCatalogEntry, SkillPayload } from "~/types/auth.type";

// Regex for valid slug format: lowercase letters, numbers, and hyphens only
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates a skill slug format.
 * Valid slugs: lowercase letters, numbers, and hyphens (no leading/trailing hyphens)
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && slug.length >= 2 && slug.length <= 50;
}

/**
 * Converts a string to a valid slug format.
 * Converts to lowercase, replaces spaces and special chars with hyphens.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

interface SkillsLibraryState {
  skills: Skill[];
  /** `boolean` or `skill ID` to open the add/edit dialog.
   * If `string`, it represents the `skill ID` being edited. */
  skillDialogOpen: boolean | string;
  setSkillDialogOpen: (open: boolean | string) => void;
  /** Prefilled values for the add-skill dialog when creating a new skill. */
  skillDialogPrefill: Partial<SkillCreate> | null;
  /** Open the add-skill dialog in create mode with prefilled values (single atomic update). */
  openSkillDialogWithPrefill: (prefill: Partial<SkillCreate>) => void;
  /** Close the dialog and clear any prefill (single atomic update). */
  closeSkillDialog: () => void;
  getSkillById: (id: string) => Skill | undefined;
  getSkillBySlug: (slug: string) => Skill | undefined;
  isSlugUnique: (slug: string, excludeId?: string) => boolean;
  getSkillsCatalog: () => SkillCatalogEntry[];
  updateSkills: (skills: Skill[]) => void;
  removeDefaultSkill: (slug: DefaultSkillSlugs) => void;
}

export const useSkillsLibraryStore = create<SkillsLibraryState>()(
  subscribeWithSelector((set, get) => ({
    skills: [],
    skillDialogOpen: false,
    skillDialogPrefill: null,
    updateSkills: (skills) => set({ skills: getActiveDefaultSkills(skills) }),
    setSkillDialogOpen: (skillDialogOpen) => set({ skillDialogOpen }),
    openSkillDialogWithPrefill: (skillDialogPrefill) =>
      set({ skillDialogPrefill, skillDialogOpen: true }),
    closeSkillDialog: () => set({ skillDialogOpen: false, skillDialogPrefill: null }),
    removeDefaultSkill: (slug) => {
      const { skills } = get();
      const updatedSkills = skills.filter((skill) => skill.id !== slug);

      // Also update theme store to track removed default skills
      useThemeStore.getState().removeDefaultSkill(slug);
      set({ skills: updatedSkills });
    },
    /**
     * Check if a slug is unique among existing skills.
     * Optionally exclude a specific skill ID (for editing).
     */
    isSlugUnique: (slug, excludeId) => {
      const { skills } = get();
      return !skills.some(
        (s) => s.slug.toLowerCase() === slug.toLowerCase() && s.id !== excludeId,
      );
    },

    /**
     * Get a lightweight catalog of all skills for sending with queries.
     */
    getSkillsCatalog: () => {
      return get().skills.map((skill) => ({
        slug: skill.slug,
        description: skill.description,
        updatedAt: skill.updatedDate,
      }));
    },

    getSkillById: (id) => {
      return get().skills.find((s) => s.id === id);
    },

    getSkillBySlug: (slug) => {
      return get().skills.find((s) => s.slug.toLowerCase() === slug.toLowerCase());
    },
  })),
);

export function useShallowSkillsLibraryStore<T>(
  selector: Selector<SkillsLibraryState, T>,
): T {
  return useStoreWithEqualityFn(
    useSkillsLibraryStore,
    useShallow(selector),
    (prev, next) => isEqual(prev, next),
  );
}
