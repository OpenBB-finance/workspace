import { inSnowflakeNativeApp } from "~/lib/constants";
import { useThemeStore } from "~/lib/state/theme";
import type { DefaultSkillSlugs, Skill } from "~/types/auth.type";
import { markdown as OPENBB_HTML_CHART } from "./openbb-html-chart.md";
import { markdown as OPENBB_HTML_REPORT } from "./openbb-html-report.md";
import { markdown as OPENBB_HTML_TABLE } from "./openbb-html-table.md";
import { markdown as SNOWFLAKE_HTML_REPORT } from "./snowflake-html-report.md";

const createdDate = "2026-03-01T00:00:00.000Z";
const widgetStyleCreatedDate = "2026-08-21T00:00:00.000Z";

export const defaultSkillSlugs = [
  "openbb-html-report",
  "snowflake-html-report",
  "openbb-html-table",
  "openbb-html-chart",
] as const;

export function isDefaultSkill(slug: string): slug is DefaultSkillSlugs {
  return defaultSkillSlugs.includes(slug as DefaultSkillSlugs);
}

export const DEFAULT_SKILLS = [
  {
    content: OPENBB_HTML_REPORT,
    description: "Generate an HTML report using OpenBB's reporting capabilities.",
    slug: "openbb-html-report",
    id: "openbb-html-report",
    createdDate,
    // Can be updated to a more recent date if the content changes,
    // but for now it matches createdDate since it's new
    updatedDate: createdDate,
  },
  {
    content: SNOWFLAKE_HTML_REPORT,
    description: "Generate an HTML report using Snowflake's reporting capabilities.",
    slug: "snowflake-html-report",
    id: "snowflake-html-report",
    createdDate,
    // ^ Same note as above about updatedDate
    updatedDate: createdDate,
  },
  {
    content: OPENBB_HTML_TABLE,
    description:
      "When creating or styling a table widget for OpenBB Workspace, follow these rules.",
    slug: "openbb-html-table",
    id: "openbb-html-table",
    createdDate: widgetStyleCreatedDate,
    updatedDate: widgetStyleCreatedDate,
  },
  {
    content: OPENBB_HTML_CHART,
    description:
      "When creating or styling a chart widget (line/area/scatter) for OpenBB Workspace, follow these rules.",
    slug: "openbb-html-chart",
    id: "openbb-html-chart",
    createdDate: widgetStyleCreatedDate,
    updatedDate: widgetStyleCreatedDate,
  },
] as const satisfies Skill[];

export function getActiveDefaultSkills(userSkills: Skill[] = []): Skill[] {
  const removedSkillSlugs = useThemeStore.getState().removedSkillSlugs || [];

  const removedSet = new Set(removedSkillSlugs);
  if (inSnowflakeNativeApp) {
    removedSet.add("openbb-html-report");
  } else {
    removedSet.add("snowflake-html-report");
  }

  const defaults = DEFAULT_SKILLS.filter((skill) => !removedSet.has(skill.id));
  return [...userSkills, ...defaults];
}
