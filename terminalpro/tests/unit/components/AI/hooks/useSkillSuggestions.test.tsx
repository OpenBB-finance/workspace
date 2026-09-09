import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SKILL_TRIGGER,
  useSkillSuggestions,
} from "~/components/AI/hooks/useSkillSuggestions";

// --- Mocks ---

const mockSkills = [
  {
    id: "skill-1",
    slug: "financial-analysis",
    description: "Analyze financial data and generate insights",
    content: "# Financial Analysis\n\nAnalyze data...",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "skill-2",
    slug: "data-visualization",
    description: "Create charts and visual representations",
    content: "# Data Visualization\n\nCreate charts...",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "skill-3",
    slug: "report-generator",
    description: "Generate comprehensive reports",
    content: "# Report Generator\n\nGenerate reports...",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
  },
];

const mockUseShallowSkillsLibraryStore = vi.fn();

vi.mock("~/lib/state/skillsLibrary", () => ({
  useShallowSkillsLibraryStore: (selector: (state: unknown) => unknown) =>
    mockUseShallowSkillsLibraryStore(selector),
}));

// --- Tests ---

describe("useSkillSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShallowSkillsLibraryStore.mockImplementation(
      (selector: (state: { skills: typeof mockSkills }) => unknown) =>
        selector({ skills: mockSkills }),
    );
  });

  describe("SKILL_TRIGGER constant", () => {
    it("exports the correct trigger character", () => {
      expect(SKILL_TRIGGER).toBe("/skill:");
    });
  });

  describe("skillOptions", () => {
    it("returns all skills as suggestions", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      expect(result.current.skillOptions).toHaveLength(3);
      expect(result.current.skillOptions).toEqual(
        [
          {
            slug: "financial-analysis",
            description: "Analyze financial data and generate insights",
            content: "# Financial Analysis\n\nAnalyze data...",
          },
          {
            slug: "data-visualization",
            description: "Create charts and visual representations",
            content: "# Data Visualization\n\nCreate charts...",
          },
          {
            slug: "report-generator",
            description: "Generate comprehensive reports",
            content: "# Report Generator\n\nGenerate reports...",
          },
        ].map((skill) => ({
          type: "skill",
          slug: skill.slug,
          description: skill.description,
          content: skill.content,
          slashText: `/skill:${skill.slug}`
            .replace(/ /g, "\u00A0")
            .replace(/-/g, "\u2011"),
        })),
      );
    });

    it("returns empty array when no skills exist", () => {
      mockUseShallowSkillsLibraryStore.mockImplementation(
        (selector: (state: { skills: never[] }) => unknown) => selector({ skills: [] }),
      );

      const { result } = renderHook(() => useSkillSuggestions());

      expect(result.current.skillOptions).toHaveLength(0);
      expect(result.current.skillOptions).toEqual([]);
    });
  });

  describe("hasSkills", () => {
    it("returns true when skills exist", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      expect(result.current.hasSkills).toBe(true);
    });

    it("returns false when no skills exist", () => {
      mockUseShallowSkillsLibraryStore.mockImplementation(
        (selector: (state: { skills: never[] }) => unknown) => selector({ skills: [] }),
      );

      const { result } = renderHook(() => useSkillSuggestions());

      expect(result.current.hasSkills).toBe(false);
    });
  });

  describe("searchSkills", () => {
    it("returns all skills when query is just the trigger", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/skill:");

      expect(suggestions).toHaveLength(3);
    });

    it("returns all skills when query is empty string", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("");

      expect(suggestions).toHaveLength(3);
    });

    it("filters skills by slug match", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/financial");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].slug).toBe("financial-analysis");
    });

    it("filters skills by description match", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/charts");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.some((s) => s.slug === "data-visualization")).toBe(true);
    });

    it("handles query without trigger prefix", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("report");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].slug).toBe("report-generator");
    });

    it("returns empty array for non-matching query", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/xyz-nonexistent-skill");

      expect(suggestions).toHaveLength(0);
    });

    it("performs fuzzy matching", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      // "finan" should fuzzy match "financial-analysis"
      const suggestions = result.current.searchSkills("/finan");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].slug).toBe("financial-analysis");
    });

    it("is case-insensitive", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/FINANCIAL");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].slug).toBe("financial-analysis");
    });

    it("ranks exact slug prefix matches higher", () => {
      const { result } = renderHook(() => useSkillSuggestions());

      const suggestions = result.current.searchSkills("/data");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].slug).toBe("data-visualization");
    });
  });

  describe("memoization", () => {
    it("returns stable skillOptions reference when skills do not change", () => {
      const { result, rerender } = renderHook(() => useSkillSuggestions());

      const firstOptions = result.current.skillOptions;
      rerender();
      const secondOptions = result.current.skillOptions;

      expect(firstOptions).toBe(secondOptions);
    });

    it("returns stable searchSkills reference when skills do not change", () => {
      const { result, rerender } = renderHook(() => useSkillSuggestions());

      const firstSearch = result.current.searchSkills;
      rerender();
      const secondSearch = result.current.searchSkills;

      expect(firstSearch).toBe(secondSearch);
    });
  });
});
