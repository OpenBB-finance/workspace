import DOMPurify from "dompurify";
import Markdown from "markdown-to-jsx";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { highlightSelection } from "~/components/AI/hooks/useCopilotAddToContext";
import {
  type SemanticViewSuggestion,
  SV_TRIGGER,
  useSemanticViewSuggestions,
} from "~/components/AI/hooks/useSemanticViewSuggestions";
import Tooltip from "~/components/Tooltip";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { cn } from "~/lib/utils";
import { MARKDOWN_SANITIZE_CONFIG, sanitizeMarkdown } from "~/lib/utils/sanitize";
import { type McpToolSuggestion, useMcpToolSuggestions } from "./useMcpToolSuggestions";
import {
  SKILL_TRIGGER,
  type SkillSuggestion,
  useSkillSuggestions,
} from "./useSkillSuggestions";

export type SlashCommandItem<
  T = SkillSuggestion | McpToolSuggestion | SemanticViewSuggestion,
> = {
  /** The text that will be inserted into the prompt when this item is selected. */
  slashText: string;
} & T;

export type SlashCommandItems = {
  skills: SlashCommandItem<SkillSuggestion>[];
  mcpTools: SlashCommandItem<McpToolSuggestion>[];
  semanticViews: SlashCommandItem<SemanticViewSuggestion>[];
  hasSuggestions: boolean;
};

const DEFAULT_SKILL_CAP = 5;
const DEFAULT_SV_CAP = 5;
const DEFAULT_MCP_TOOL_CAP = 10;

/**
 * Shared prose styling for tooltip descriptions. Forces long unbroken tokens
 * (slash-delimited tool names, JSON schemas) to wrap inside the constrained
 * tooltip instead of overflowing it.
 */
const SUGGESTION_PROSE_CLASSES = `min-w-0 max-w-full whitespace-normal wrap-anywhere
  text-xs text-ds-text-body leading-relaxed
  prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2
  prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
  [&_code]:whitespace-normal [&_code]:wrap-anywhere
  [&_pre]:whitespace-pre-wrap [&_pre]:overflow-x-hidden [&_pre]:wrap-anywhere`;

const getFinalOutput = (output: SlashCommandItems, limit = false) => {
  if (limit) {
    output.skills = output.skills.slice(0, DEFAULT_SKILL_CAP);
    output.mcpTools = output.mcpTools.slice(0, DEFAULT_MCP_TOOL_CAP);
    output.semanticViews = output.semanticViews.slice(0, DEFAULT_SV_CAP);
  }
  output.hasSuggestions =
    output.skills.length > 0 ||
    output.mcpTools.length > 0 ||
    output.semanticViews.length > 0;
  return output;
};

export function useSlashCommandSuggestions() {
  const { searchSkills, hasSkills } = useSkillSuggestions();
  const { searchMcpTools, hasMcpTools } = useMcpToolSuggestions();
  const { searchSemanticViews, hasSemanticViews } = useSemanticViewSuggestions();

  const showMcpTools = hasMcpTools && !inSnowflakeNativeApp;

  const searchSlashCommands = useCallback(
    (query: string): SlashCommandItems => {
      const stripped = query.startsWith("/") ? query.slice(1) : query;
      const output = {
        skills: [],
        mcpTools: [],
        semanticViews: [],
        hasSuggestions: false,
      };
      try {
        // `/skill:...` → only skills (backward compat), space closes dropdown
        if (query.startsWith(SKILL_TRIGGER)) {
          if (!hasSkills) return output;
          const skillQuery = query.slice(SKILL_TRIGGER.length);
          if (skillQuery.includes(" ")) return output;
          output.skills = searchSkills(query);
          return getFinalOutput(output);
        }
        const searchQuery = { skill: stripped, semanticView: stripped };

        // User is typing toward `/skill:` — show all skills (don't filter them out)
        const skillTriggerNoSlash = SKILL_TRIGGER.slice(1); // "skill:"
        // User is typing toward `/sv:` — show all semantic views (don't filter them out)
        const svTriggerNoSlash = SV_TRIGGER.slice(1); // "sv:"
        const triggersToCheck = [
          ["skill", skillTriggerNoSlash],
          ["semanticView", svTriggerNoSlash],
        ] as const;

        for (const [key, trigger] of triggersToCheck) {
          if (stripped.length > 0 && trigger.startsWith(stripped))
            searchQuery[key] = "";
        }

        output.skills = hasSkills ? searchSkills(searchQuery.skill) : [];
        output.mcpTools = showMcpTools ? searchMcpTools(stripped) : [];
        output.semanticViews = hasSemanticViews
          ? searchSemanticViews(searchQuery.semanticView)
          : [];

        return getFinalOutput(output, stripped.length === 0);
      } finally {
        queueMicrotask(() => highlightSelection(0, true));
      }
    },
    [
      searchSkills,
      searchMcpTools,
      searchSemanticViews,
      hasSkills,
      showMcpTools,
      hasSemanticViews,
    ],
  );

  const hasItems = useMemo(
    () => hasSkills || showMcpTools || hasSemanticViews,
    [hasSkills, showMcpTools, hasSemanticViews],
  );

  return { searchSlashCommands, hasItems };
}

type SlashCommandSuggestionsProps<T = SlashCommandItem> = {
  index: number;
  item: T;
  onSelect: (item: T) => void;
  isMobile?: boolean;
};

export const SlashSuggestionItem = memo<SlashCommandSuggestionsProps>((props) => {
  const { index, item, onSelect, isMobile = false } = props;

  const message = useMemo(() => {
    const output = { label: "", description: null as ReactNode | null };
    if (item.type === "skill") {
      output.label = `/skill:${item.slug}`;
      output.description = (
        <div className={cn(SUGGESTION_PROSE_CLASSES, "prose-pre:my-1")}>
          <Markdown>{sanitizeMarkdown(item.content || item.description)}</Markdown>
        </div>
      );
    } else if (item.type === "mcpTool") {
      output.label = `/${item.serverName}_${item.toolName}`;
      output.description = (
        <>
          {item.description && (
            <div className={cn(SUGGESTION_PROSE_CLASSES, "prose-pre:my-1")}>
              <Markdown>
                {DOMPurify.sanitize(item.description, MARKDOWN_SANITIZE_CONFIG)}
              </Markdown>
            </div>
          )}
          {item.inputSchema && (
            <div className="mt-2">
              <div
                className="text-2xs font-semibold uppercase mb-1
                text-light-500 dark:text-light-400"
              >
                Input Schema
              </div>
              <div className={cn(SUGGESTION_PROSE_CLASSES, "prose-pre:my-0")}>
                <Markdown>
                  {DOMPurify.sanitize(
                    `\`\`\`json\n${JSON.stringify(item.inputSchema, null, 2)}\n\`\`\``,
                    MARKDOWN_SANITIZE_CONFIG,
                  )}
                </Markdown>
              </div>
            </div>
          )}
        </>
      );
    } else if (item.type === "semanticView") {
      output.label = `/sv:${item.viewName}`;
      output.description = (
        <div className={cn(SUGGESTION_PROSE_CLASSES, "prose-pre:my-1")}>
          {item.comment ? (
            <Markdown>{sanitizeMarkdown(item.comment)}</Markdown>
          ) : (
            <div>
              {item.database}.{item.schema}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className="flex min-w-0 max-w-full flex-col gap-2 max-h-[300px]
        overflow-y-auto overflow-x-hidden whitespace-normal wrap-anywhere"
      >
        <div
          className="min-w-0 max-w-full whitespace-normal wrap-anywhere font-semibold
          text-xs text-link-color sticky top-0 bg-tooltip-bg pb-1"
        >
          {output.label}
        </div>
        {output.description}
      </div>
    );
  }, [item]);

  const buttonChildren = useMemo(() => {
    switch (item.type) {
      case "skill":
        return (
          <>
            <span className="text-link-color">/skill:{item.slug}</span>
            <span className="text-ds-text-caption">{item.description}</span>
          </>
        );

      case "mcpTool":
        return (
          <>
            <span className="text-link-color truncate">
              {item.serverName}_{item.toolName}
            </span>
            <span className="text-ds-text-caption truncate">{item.description}</span>
          </>
        );

      case "semanticView":
        return (
          <>
            <span className="text-link-color truncate">/sv:{item.viewName}</span>
            <span className="text-ds-text-caption truncate">
              {item.comment ? `${item.comment}` : `${item.database}.${item.schema}`}
            </span>
          </>
        );
    }
  }, [item]);

  return (
    <Tooltip
      id={`slash-suggestion-${item.slashText}`}
      position="left"
      className="max-w-[24rem] overflow-x-hidden wrap-anywhere"
      message={message}
      hide={isMobile}
    >
      <button
        id={`suggestion-${index}`}
        type="button"
        className="suggestion-item w-full flex flex-col text-xs leading-[18px] min-w-0 p-1 text-left
        hover:bg-light-100 dark:hover:bg-dark-600 rounded transition-colors"
        onClick={() => onSelect(item)}
        onMouseEnter={(e) => {
          e.stopPropagation();
          // Update selection index for keyboard navigation
          highlightSelection(index, true);
        }}
      >
        {buttonChildren}
      </button>
    </Tooltip>
  );
});
