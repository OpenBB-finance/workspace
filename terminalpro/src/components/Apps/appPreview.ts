import type { ListedApp } from "~/types/listedApps";

/**
 * The three surfaces a listing renders on. Both the vendor's submission preview
 * and the admin review dialog step through the same set, so a reviewer always
 * sees what the vendor was shown.
 */
export type PreviewMode = "general" | "marketplace" | "modal";

export const PREVIEW_MODES = ["general", "marketplace", "modal"] as const;

export const PREVIEW_OPTIONS: { label: string; value: PreviewMode }[] = [
  { label: "General card", value: "general" },
  { label: "Marketplace card", value: "marketplace" },
  { label: "App modal", value: "modal" },
];

/**
 * Neither preview source carries the real widget/prompt lists — a connected
 * backend gives a count, and an admin app only has `widgets_count` /
 * `prompts_count`. The surfaces render one entry per item, so the placeholders
 * are labelled to stop anyone reading them as the app's actual names.
 */
const PLACEHOLDER_NAME = "(name not available in preview)";

export function previewWidgets(count: number): ListedApp["widgets"] {
  return Array.from({ length: count }, () => ({ name: PLACEHOLDER_NAME }));
}

export function previewPrompts(count: number): string[] {
  return Array.from({ length: count }, () => PLACEHOLDER_NAME);
}
