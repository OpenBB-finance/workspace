import { memo, useMemo } from "react";
import { useMcpToolSuggestions } from "~/components/AI/hooks/useMcpToolSuggestions";
import { useSemanticViewSuggestions } from "~/components/AI/hooks/useSemanticViewSuggestions";
import { useSkillSuggestions } from "~/components/AI/hooks/useSkillSuggestions";
import Tooltip from "~/components/Tooltip";
import type { Mention } from "~/lib/state/copilot";
import { cn, isValidUrl } from "~/lib/utils";
import { useMentions } from "./hooks/useMentions";
import { findUnresolvedMentions } from "./utils/unresolvedMentions";

type TextStyleProps = {
  content: string;
  className?: string;
  /**
   * Set when rendered as the highlight layer behind the copilot <textarea>.
   * In that mode the chip must not alter text flow (no horizontal padding /
   * label color), so it stays glyph-aligned with the transparent textarea.
   */
  overlay?: boolean;
  /**
   * Render as inline content (no <div>/<br>) so the result can live inside a
   * single-line truncating container (e.g. a collapsed list row).
   */
  singleLine?: boolean;
};

function getMentionsMap(mentions: Mention[]) {
  return mentions.reduce((acc, mention) => {
    const key = `${mention.trigger}${mention.name}`;
    acc[key] = mention;
    return acc;
  }, {});
}

function getSplitLines(
  renderedContent: string,
  mentionsMap: Record<string, Mention>,
  skillSlugs: Set<string>,
  mcpToolPatterns: Set<string>,
  svFqnPatterns: Set<string>,
  unresolvedTokens: string[],
) {
  const lines = renderedContent.split("\n");
  return lines.map((line) => {
    try {
      let parts = [line];
      // Sort mention keys by length descending so longer names (more specific) are matched first
      const mentionKeys = Object.keys(mentionsMap);

      // Build skill pattern from valid slugs (now uses /skill: prefix)
      const skillPatterns = Array.from(skillSlugs);
      // Build MCP tool patterns
      const mcpPatterns = Array.from(mcpToolPatterns);
      // Build semantic view patterns
      const svPatterns = Array.from(svFqnPatterns);
      const allPatterns = [
        ...mentionKeys,
        ...skillPatterns,
        ...svPatterns,
        ...mcpPatterns,
        ...unresolvedTokens,
      ].sort((a, b) => b.length - a.length);

      const expression =
        allPatterns.length > 0
          ? `(${allPatterns.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|\\s+)`
          : "(\\s+)";
      const regex = new RegExp(expression, "g");
      parts = line.split(regex);
      const result = parts.filter((p) => p !== "");
      return result;
    } catch (error) {
      return [line];
    }
  });
}

function TextStyle(props: TextStyleProps) {
  const { content, className = "", overlay = false, singleLine = false } = props;
  const { processMentions } = useMentions();
  const { result: renderedContent, mentions } = useMemo(
    () => processMentions(content),
    [content, processMentions],
  );

  const { skillOptions } = useSkillSuggestions();
  const { mcpToolOptions } = useMcpToolSuggestions();
  const { svOptions } = useSemanticViewSuggestions();

  // Get skill slugs for highlighting
  const skillSlugs = useMemo(
    () => new Set(skillOptions.map((s) => s.slashText)),
    [skillOptions],
  );
  // Get MCP tool patterns for highlighting
  const mcpToolPatterns = useMemo(
    () => new Set(mcpToolOptions.map((t) => t.slashText)),
    [mcpToolOptions],
  );
  // Get semantic view FQNs for highlighting
  const svFqnPatterns = useMemo(
    () => new Set(svOptions.map((s) => s.slashText)),
    [svOptions],
  );

  // Mentions that can't be resolved in the current context stay in the text as
  // raw `@[id:...]` tokens. Chip them so history reads cleanly instead of
  // leaking the internal id.
  const unresolvedMentions = useMemo(
    () => findUnresolvedMentions(renderedContent),
    [renderedContent],
  );

  const contentMemo = useMemo(() => {
    const mentionsMap = getMentionsMap(mentions);
    const splitLines = getSplitLines(
      renderedContent,
      mentionsMap,
      skillSlugs,
      mcpToolPatterns,
      svFqnPatterns,
      Array.from(unresolvedMentions.keys()),
    );

    // Flatten multi-line content into a single inline sequence so the result
    // can live inside a truncating parent without breaking layout.
    const lines = singleLine
      ? [
          splitLines.reduce<string[]>((acc, line, i) => {
            if (i > 0) acc.push(" ");
            acc.push(...line);
            return acc;
          }, []),
        ]
      : splitLines;

    const OuterTag = singleLine ? "span" : "div";
    const InnerTag = singleLine ? "span" : "div";

    return (
      <OuterTag className={className}>
        {lines.map((line, lineIndex) => (
          <InnerTag key={lineIndex}>
            {line.map((part, index) => {
              const key = `${lineIndex}-${part}-${index}`;
              const mention = mentionsMap[part];
              const isSlashCommand =
                skillSlugs.has(part) ||
                svFqnPatterns.has(part) ||
                mcpToolPatterns.has(part);

              if (isValidUrl(part)) {
                // In single-line previews the parent row is the click target;
                // don't compete with it by attaching a URL onClick.
                if (singleLine) {
                  return (
                    <span key={key} className="text-alert-informative">
                      {part}
                    </span>
                  );
                }
                return (
                  <span
                    key={key}
                    className="relative z-40 text-alert-informative cursor-pointer pointer-events-auto"
                    onClick={() => {
                      const url = part.replace(/[?.]$/, "");
                      const formattedUrl = url.startsWith("http")
                        ? url
                        : `https://${url}`;
                      window.open(formattedUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {part}
                  </span>
                );
              }

              const unresolvedLabel = unresolvedMentions.get(part);
              if (unresolvedLabel) {
                return (
                  <Tooltip
                    key={key}
                    // Overlay chips sit under a pointer-events-none layer, so a
                    // tooltip would never surface.
                    hide={overlay}
                    // Deliberately not "was deleted": a mention only resolves
                    // against the current dashboard, and only when the selected
                    // copilot enables the widget-dashboard features, so an
                    // unresolved token is just as often out-of-context as gone.
                    message="This reference can't be resolved here — it may have been removed, or it belongs to another dashboard."
                  >
                    <span
                      className={cn(
                        "rounded-full py-[0.25em]",
                        // Muted + dashed reads as "placeholder" rather than an
                        // error: an unresolved reference is not a failure the
                        // user needs to act on.
                        "bg-general-bg-secondary text-ds-text-caption",
                        overlay
                          ? // Editing an old message: the raw token IS the text the
                            // user edits, so it can't be relabelled and the chip
                            // must stay flow-neutral (no border, no net padding).
                            "px-[0.3em] -mx-[0.3em]"
                          : "inline-block max-w-full truncate align-middle px-1 border border-dashed border-general-border-primary",
                      )}
                    >
                      {overlay ? part : unresolvedLabel}
                    </span>
                  </Tooltip>
                );
              }

              if (mention || isSlashCommand) {
                const isWeb = mention?.group === "web";
                return (
                  <span
                    key={key}
                    // Static chips can be ellipsized, so expose the full token on
                    // hover. Overlay chips sit under a pointer-events-none layer,
                    // so a title would never surface.
                    title={overlay ? undefined : part}
                    className={cn(
                      // Background paints on the inline text itself (no absolute
                      // layer, no negative margins), so the pill hugs the glyphs
                      // at any font size.
                      "rounded-full py-[0.25em]",
                      isWeb ? "bg-copilot-mention-web-bg" : "bg-copilot-mention-bg",
                      // Label color applies in both modes. In overlay mode the
                      // chip text renders on top of the textarea's text (overlay
                      // is z-30, textarea is z-20) so the label color is what the
                      // user sees — needed because the textarea's text color
                      // would otherwise read as dark text on the blue pill in
                      // light mode.
                      isWeb
                        ? "text-copilot-mention-web-label"
                        : "text-copilot-mention-label",
                      overlay
                        ? // Overlay = highlight layer covering the real <textarea>.
                          // It must wrap exactly like the textarea, so it can't
                          // truncate; default `slice` decoration renders a wrapped
                          // pill as one continuous pill (caps on the outer ends
                          // only). Horizontal padding is compensated by an equal
                          // negative margin so the pill extends past the glyphs
                          // visually without shifting inline flow under the
                          // textarea.
                          "px-[0.3em] -mx-[0.3em]"
                        : // Static = real, non-editable node: one unbreakable pill
                          // that ellipsizes instead of splitting across lines.
                          "inline-block max-w-full truncate align-middle px-1",
                    )}
                  >
                    {part}
                  </span>
                );
              }

              return <span key={key}>{part}</span>;
            })}
            {!singleLine && lineIndex < lines.length - 1 && <br />}
          </InnerTag>
        ))}
      </OuterTag>
    );
  }, [
    renderedContent,
    className,
    mentions,
    skillSlugs,
    mcpToolPatterns,
    svFqnPatterns,
    unresolvedMentions,
    overlay,
    singleLine,
  ]);

  return contentMemo;
}

export default memo(TextStyle);
