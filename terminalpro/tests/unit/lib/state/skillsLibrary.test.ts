/**
 * Tests for skillsLibrary Zustand store
 *
 * Tests the skills library state management including:
 * - Dialog state management
 * - Slug validation and uniqueness
 * - Skills catalog generation
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { isDefaultSkill } from "~/components/AI/skills";
import { isValidSlug, toSlug, useSkillsLibraryStore } from "~/lib/state/skillsLibrary";

// Test data factory
const createMockSkill = (
  overrides: Partial<{
    id: string;
    slug: string;
    description: string;
    content: string;
    createdDate: string;
    updatedDate: string;
  }> = {},
) => ({
  id: overrides.id ?? `skill-${Math.random().toString(36).substr(2, 9)}`,
  slug: overrides.slug ?? "test-skill",
  description: overrides.description ?? "A test skill description",
  content: overrides.content ?? "# Test Skill\n\nThis is test content.",
  createdDate: overrides.createdDate ?? new Date().toISOString(),
  updatedDate: overrides.updatedDate ?? new Date().toISOString(),
});

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: () => ({
      removedSkillSlugs: ["openbb-html-report"],
    }),
    // Mock function to track calls to removeDefaultSkill
    removeDefaultSkill: vi.fn(),
  },
}));

/**
 * `updateSkills` always appends the built-in default skills, so assertions about
 * user-supplied skills must ignore them. Filtering by `isDefaultSkill` keeps these
 * tests correct as defaults are added or removed, rather than hard-coding a count.
 */
const userSkillsInStore = () =>
  useSkillsLibraryStore.getState().skills.filter((skill) => !isDefaultSkill(skill.id));

describe("skillsLibrary utilities", () => {
  describe("isValidSlug", () => {
    it("returns true for valid slugs", () => {
      expect(isValidSlug("test")).toBe(true);
      expect(isValidSlug("my-skill")).toBe(true);
      expect(isValidSlug("skill-123")).toBe(true);
      expect(isValidSlug("a-b-c")).toBe(true);
      expect(isValidSlug("ab")).toBe(true); // minimum length
    });

    it("returns false for invalid slugs", () => {
      expect(isValidSlug("")).toBe(false);
      expect(isValidSlug("a")).toBe(false); // too short
      expect(isValidSlug("-invalid")).toBe(false); // leading hyphen
      expect(isValidSlug("invalid-")).toBe(false); // trailing hyphen
      expect(isValidSlug("Invalid")).toBe(false); // uppercase
      expect(isValidSlug("has spaces")).toBe(false);
      expect(isValidSlug("has_underscore")).toBe(false);
      expect(isValidSlug("special!chars")).toBe(false);
    });

    it("returns false for slugs exceeding max length", () => {
      const longSlug = "a".repeat(51);
      expect(isValidSlug(longSlug)).toBe(false);
    });
  });

  describe("toSlug", () => {
    it("converts strings to valid slug format", () => {
      expect(toSlug("Test Skill")).toBe("test-skill");
      expect(toSlug("My Awesome Skill")).toBe("my-awesome-skill");
      expect(toSlug("  trimmed  ")).toBe("trimmed");
    });

    it("handles special characters", () => {
      expect(toSlug("Hello! World?")).toBe("hello-world");
      expect(toSlug("test@skill#123")).toBe("testskill123");
    });

    it("collapses multiple hyphens", () => {
      expect(toSlug("test---skill")).toBe("test-skill");
      expect(toSlug("a  b  c")).toBe("a-b-c");
    });

    it("removes leading and trailing hyphens", () => {
      expect(toSlug("-test-")).toBe("test");
      expect(toSlug("---test---")).toBe("test");
    });

    it("truncates to max length", () => {
      const longString = "a".repeat(100);
      expect(toSlug(longString).length).toBe(50);
    });
  });
});

describe("useSkillsLibraryStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useSkillsLibraryStore.setState({
        skills: [],
        skillDialogOpen: false,
        skillDialogPrefill: null,
      });
    });
  });

  describe("initial state", () => {
    it("should have empty skills initially", () => {
      const state = useSkillsLibraryStore.getState();
      expect(state.skills).toEqual([]);
    });

    it("should have skillDialogOpen as false initially", () => {
      const state = useSkillsLibraryStore.getState();
      expect(state.skillDialogOpen).toBe(false);
    });
  });

  describe("setAddSkillDialogOpen", () => {
    it("should set dialog open state to true", () => {
      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen(true);
      });

      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe(true);
    });

    it("should set dialog open state to false", () => {
      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen(true);
      });

      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen(false);
      });

      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe(false);
    });
  });

  describe("setEditingSkillId", () => {
    it("should set editing skill id", () => {
      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen("skill-123");
      });

      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe("skill-123");
    });

    it("should clear editing skill id", () => {
      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen("skill-123");
      });

      act(() => {
        useSkillsLibraryStore.getState().setSkillDialogOpen(null);
      });

      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBeNull();
    });
  });

  describe("openSkillDialogWithPrefill", () => {
    it("should set skillDialogPrefill and open the dialog in a single update", () => {
      const listener = vi.fn();
      const unsubscribe = useSkillsLibraryStore.subscribe(listener);

      act(() => {
        useSkillsLibraryStore.getState().openSkillDialogWithPrefill({
          slug: "prefilled-skill",
          content: "Prefilled content",
        });
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const state = useSkillsLibraryStore.getState();
      expect(state.skillDialogPrefill).toEqual({
        slug: "prefilled-skill",
        content: "Prefilled content",
      });
      expect(state.skillDialogOpen).toBe(true);
      unsubscribe();
    });
  });

  describe("closeSkillDialog", () => {
    it("should clear both skillDialogOpen and skillDialogPrefill in a single update", () => {
      act(() => {
        useSkillsLibraryStore.getState().openSkillDialogWithPrefill({
          slug: "prefilled-skill",
          content: "Prefilled content",
        });
      });

      const listener = vi.fn();
      const unsubscribe = useSkillsLibraryStore.subscribe(listener);

      act(() => {
        useSkillsLibraryStore.getState().closeSkillDialog();
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const state = useSkillsLibraryStore.getState();
      expect(state.skillDialogOpen).toBe(false);
      expect(state.skillDialogPrefill).toBeNull();
      unsubscribe();
    });
  });

  describe("updateSkills", () => {
    it("should set the skills array", () => {
      const mockSkills = [
        createMockSkill({ id: "skill-1", slug: "first" }),
        createMockSkill({ id: "skill-2", slug: "second" }),
      ];

      act(() => {
        useSkillsLibraryStore.getState().updateSkills(mockSkills);
      });

      const userSkills = userSkillsInStore();
      expect(userSkills).toHaveLength(2);
      expect(userSkills[0].slug).toBe("first");
      expect(userSkills[1].slug).toBe("second");
    });

    it("should replace existing skills", () => {
      const initialSkills = [createMockSkill({ id: "skill-1", slug: "initial" })];
      const newSkills = [createMockSkill({ id: "skill-2", slug: "new" })];

      act(() => {
        useSkillsLibraryStore.getState().updateSkills(initialSkills);
      });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills(newSkills);
      });

      const userSkills = userSkillsInStore();
      expect(userSkills).toHaveLength(1);
      expect(userSkills[0].slug).toBe("new");
    });
  });

  describe("getSkillById", () => {
    it("should return skill by id", () => {
      const mockSkill = createMockSkill({ id: "skill-123", slug: "findme" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      const skill = useSkillsLibraryStore.getState().getSkillById("skill-123");
      expect(skill).toBeTruthy();
      expect(skill?.slug).toBe("findme");
    });

    it("should return undefined for non-existent id", () => {
      const skill = useSkillsLibraryStore.getState().getSkillById("non-existent");
      expect(skill).toBeUndefined();
    });
  });

  describe("getSkillBySlug", () => {
    it("should return skill by slug", () => {
      const mockSkill = createMockSkill({
        slug: "my-slug",
        description: "Find by slug",
      });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      const skill = useSkillsLibraryStore.getState().getSkillBySlug("my-slug");
      expect(skill).toBeTruthy();
      expect(skill?.description).toBe("Find by slug");
    });

    it("should be case-insensitive", () => {
      const mockSkill = createMockSkill({ slug: "my-slug" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      const skill = useSkillsLibraryStore.getState().getSkillBySlug("MY-SLUG");
      expect(skill).toBeTruthy();
    });

    it("should return undefined for non-existent slug", () => {
      const skill = useSkillsLibraryStore.getState().getSkillBySlug("non-existent");
      expect(skill).toBeUndefined();
    });
  });

  describe("isSlugUnique", () => {
    it("should return true for unique slug", () => {
      const mockSkill = createMockSkill({ slug: "existing" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      expect(useSkillsLibraryStore.getState().isSlugUnique("new-unique")).toBe(true);
    });

    it("should return false for duplicate slug", () => {
      const mockSkill = createMockSkill({ slug: "duplicate" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      expect(useSkillsLibraryStore.getState().isSlugUnique("duplicate")).toBe(false);
    });

    it("should be case-insensitive", () => {
      const mockSkill = createMockSkill({ slug: "myslug" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      expect(useSkillsLibraryStore.getState().isSlugUnique("MYSLUG")).toBe(false);
    });

    it("should exclude specified id from check", () => {
      const mockSkill = createMockSkill({ id: "skill-123", slug: "my-skill" });

      act(() => {
        useSkillsLibraryStore.getState().updateSkills([mockSkill]);
      });

      // Same slug is allowed when excluding the skill's own id (for editing)
      expect(
        useSkillsLibraryStore.getState().isSlugUnique("my-skill", "skill-123"),
      ).toBe(true);
    });
  });

  describe("getSkillsCatalog", () => {
    it("should return catalog with slug, description, and updatedAt only", () => {
      const mockSkills = [
        createMockSkill({
          slug: "skill-1",
          description: "First skill",
          updatedDate: "2024-01-15T10:00:00Z",
        }),
        createMockSkill({
          slug: "skill-2",
          description: "Second skill",
          updatedDate: "2024-01-16T10:00:00Z",
        }),
      ];

      act(() => {
        useSkillsLibraryStore.getState().updateSkills(mockSkills);
      });

      const defaultSlugs = new Set(
        useSkillsLibraryStore
          .getState()
          .skills.filter((skill) => isDefaultSkill(skill.id))
          .map((skill) => skill.slug),
      );
      const catalog = useSkillsLibraryStore
        .getState()
        .getSkillsCatalog()
        .filter((entry) => !defaultSlugs.has(entry.slug));

      expect(catalog).toHaveLength(2);
      expect(catalog[0]).toHaveProperty("slug");
      expect(catalog[0]).toHaveProperty("description");
      expect(catalog[0]).toHaveProperty("updatedAt");
      expect(catalog[0]).not.toHaveProperty("content");
      expect(catalog[0]).not.toHaveProperty("id");
    });

    it("should return empty array when no skills", () => {
      const catalog = useSkillsLibraryStore.getState().getSkillsCatalog();
      expect(catalog).toEqual([]);
    });
  });
});
