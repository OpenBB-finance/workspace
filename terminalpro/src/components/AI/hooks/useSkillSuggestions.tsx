import Fuse from "fuse.js";
import { useCallback, useMemo } from "react";
import { useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";

export const SKILL_TRIGGER = "/skill:";

export interface SkillSuggestion {
  type: "skill";
  slug: string;
  description: string;
  content: string;
  /** ### Skill Slash Text
   *  Formatted as `/skill:{slug}`. */
  slashText: string;
}

export function useSkillSuggestions() {
  const skills = useShallowSkillsLibraryStore((s) => s.skills);

  const skillOptions = useMemo((): SkillSuggestion[] => {
    return skills.map((skill) => ({
      type: "skill",
      slug: skill.slug,
      description: skill.description,
      content: skill.content,
      // Non-breaking space/hyphen to prevent textarea line breaks
      slashText: `/skill:${skill.slug}`.replace(/ /g, "\u00A0").replace(/-/g, "\u2011"),
    }));
  }, [skills]);

  const fuse = useMemo(
    () =>
      new Fuse(skillOptions, {
        keys: ["slug", "description"],
        threshold: 0.3,
      }),
    [skillOptions],
  );

  const searchSkills = useCallback(
    (query: string): SkillSuggestion[] => {
      // Remove the "/skill:" prefix
      const searchTerm = query.startsWith(SKILL_TRIGGER)
        ? query.slice(SKILL_TRIGGER.length)
        : query;

      if (!searchTerm) return skillOptions;

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
    [skillOptions, fuse],
  );

  return {
    skillOptions,
    searchSkills,
    hasSkills: skills.length > 0,
  };
}
