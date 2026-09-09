import { AnimatePresence, motion } from "framer-motion";
import { type MouseEvent, memo, useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";
import { useTemplatePrompts } from "~/hooks/useTemplatePrompts";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import useSharedPrompts from "../LayoutAuth/Search/hooks/useSharedPrompts";
import Tooltip from "../Tooltip";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCopilotCommand } from "./hooks/utils";
import TextStyle from "./TextStyle";

type PromptSuggestionsProps = {
  setCompletion: (value: string) => void;
};

type SectionKey = "app" | "personal" | "shared";
type AccordionState = Record<SectionKey, boolean>;

const DEFAULT_ACCORDION: AccordionState = {
  app: true,
  personal: true,
  shared: false,
};

export default function PromptSuggestions({ setCompletion }: PromptSuggestionsProps) {
  const { id = "" } = useParams();
  const { promptsSuggestionsMenuOpen, setPromptsSuggestionsMenuOpen } =
    useShallowThemeStore((state) => ({
      promptsSuggestionsMenuOpen: state.promptsSuggestionsMenuOpen,
      setPromptsSuggestionsMenuOpen: state.setPromptsSuggestionsMenuOpen,
    }));
  const { limitReached, loading } = useShallowStreamingStore((s) => ({
    limitReached: s.limitReached,
    loading: s.loading,
  }));
  const copilotTextSuggestions = useShallowCopilotStore(
    (s) => s.copilotTextSuggestions,
  );
  const personalLibraryPrompts = useShallowPromptLibraryStore((state) => state.prompts);
  const templateId = useShallowAppStore((s) => s?.items?.[id]?.data?.templateId);
  const templatePrompts = useTemplatePrompts(templateId ?? "");
  const { sharedPrompts } = useSharedPrompts(true);

  const appPrompts = useMemo(
    () => [...templatePrompts, ...copilotTextSuggestions.map((s) => s.question)],
    [templatePrompts, copilotTextSuggestions],
  );

  const myPrompts = useMemo(
    () => personalLibraryPrompts.flatMap(({ prompt }) => prompt),
    [personalLibraryPrompts],
  );

  const sharedPromptsData = useMemo(
    () => sharedPrompts.map((p) => p.prompt),
    [sharedPrompts],
  );

  const hasAnyPrompts =
    appPrompts.length > 0 || myPrompts.length > 0 || sharedPromptsData.length > 0;

  const [accordionState, setAccordionState] = useLocalStorage<AccordionState>(
    "prompt-suggestions-accordion",
    DEFAULT_ACCORDION,
  );

  const toggleAccordion = useCallback(
    (section: SectionKey) => {
      setAccordionState((prev) => {
        const merged = { ...DEFAULT_ACCORDION, ...prev };
        return { ...merged, [section]: !merged[section] };
      });
    },
    [setAccordionState],
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      setCompletion("");
      dispatchCopilotCommand(prompt);
      setPromptsSuggestionsMenuOpen(false);
      setTimeout(() => {
        document.getElementById("copilot-input")?.focus();
      }, 100);
    },
    [setCompletion, setPromptsSuggestionsMenuOpen],
  );

  const triggerMemo = useMemo(
    () => (
      <Tooltip message="Prompt suggestions">
        <DropdownMenuTrigger asChild={true}>
          <button
            id="copilot-prompt-suggestions-trigger"
            type="button"
            aria-label="Prompt suggestions"
            disabled={loading || limitReached}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
              {
                "opacity-25 cursor-default": loading || limitReached,
                "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                  !loading && !limitReached && !promptsSuggestionsMenuOpen,
              },
            )}
          >
            <Icon id="lightbulb-02" className="h-4 w-4 stroke-1" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
    ),
    [loading, limitReached, promptsSuggestionsMenuOpen],
  );

  return (
    <DropdownMenu
      open={promptsSuggestionsMenuOpen}
      onOpenChange={setPromptsSuggestionsMenuOpen}
    >
      {triggerMemo}
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-[400px] mr-5 p-2.5 flex flex-col"
      >
        <div
          className="flex items-center justify-between pb-2 mb-2.5
            border-b border-surface-divider flex-shrink-0"
        >
          <div className="text-sm font-semibold text-ds-text-heading">Prompts</div>
          <Tooltip message="Manage Prompts">
            <Link
              to="/app/prompts"
              tabIndex={0}
              aria-label="Manage Prompts"
              onClick={() => setPromptsSuggestionsMenuOpen(false)}
              className="flex items-center justify-center w-6 h-6 rounded transition-colors
                duration-200 text-ds-text-body hover:bg-general-bg-secondary-hover
                hover:text-ds-text-heading"
            >
              <Icon id="settings-01" className="w-4 h-4" />
            </Link>
          </Tooltip>
        </div>

        <div className="flex-1 overflow-y-auto">
          {hasAnyPrompts ? (
            <div className="flex flex-col gap-2.5">
              <PromptSection
                section="app"
                title="Backend Prompts"
                prompts={appPrompts}
                isOpen={accordionState.app ?? DEFAULT_ACCORDION.app}
                onToggle={toggleAccordion}
                onPromptClick={handlePromptClick}
              />
              <PromptSection
                section="personal"
                title="My Prompts"
                prompts={myPrompts}
                isOpen={accordionState.personal ?? DEFAULT_ACCORDION.personal}
                onToggle={toggleAccordion}
                onPromptClick={handlePromptClick}
              />
              <PromptSection
                section="shared"
                title="Shared with me"
                prompts={sharedPromptsData}
                isOpen={accordionState.shared ?? DEFAULT_ACCORDION.shared}
                onToggle={toggleAccordion}
                onPromptClick={handlePromptClick}
              />
            </div>
          ) : (
            <div className="p-4 text-center text-ds-text-caption">
              No suggestions available for this dashboard, try adding more widgets or{" "}
              <Link to="/app/prompts" className="text-link-color hover:underline">
                create your own prompt
              </Link>
              .
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PromptSectionProps {
  section: SectionKey;
  title: string;
  prompts: string[];
  isOpen: boolean;
  onToggle: (section: SectionKey) => void;
  onPromptClick: (prompt: string) => void;
}

const PromptSection = memo<PromptSectionProps>((props) => {
  const { section, title, prompts, isOpen, onToggle, onPromptClick } = props;

  const handleToggle = useCallback(() => onToggle(section), [onToggle, section]);

  if (prompts.length === 0) return null;

  return (
    <motion.div
      className="flex flex-col"
      initial={false}
      animate={isOpen ? "open" : "closed"}
    >
      <button
        type="button"
        className="flex items-center gap-2 cursor-pointer text-left"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <motion.div
          variants={{ open: { rotate: 90 }, closed: { rotate: 0 } }}
          transition={{ duration: 0.2 }}
        >
          <Icon id="chevron-right" className="size-4 text-ds-text-body" />
        </motion.div>
        <p className="body-xs-regular text-ds-text-body">
          {title} <span className="text-ds-text-caption">({prompts.length})</span>
        </p>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex flex-col gap-2 mt-2">
              {prompts.map((prompt) => (
                <PromptItem key={prompt} prompt={prompt} onSelect={onPromptClick} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
PromptSection.displayName = "PromptSection";

interface PromptItemProps {
  prompt: string;
  onSelect: (prompt: string) => void;
}

const PromptItem = memo<PromptItemProps>(({ prompt, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = prompt.length > 150;

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onSelect(prompt);
    },
    [onSelect, prompt],
  );

  const toggleExpanded = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((p) => !p);
  }, []);

  return (
    <div className="rounded p-2 text-xs bg-general-bg-secondary text-ds-text-body">
      <button
        type="button"
        className="w-full text-left hover:text-ds-text-heading transition-colors"
        onClick={handleClick}
      >
        <div className={cn({ "line-clamp-3": !isExpanded && shouldTruncate })}>
          <TextStyle content={prompt} />
        </div>
      </button>
      {shouldTruncate && (
        <button
          type="button"
          className="mt-1 font-medium text-link-color hover:underline"
          onClick={toggleExpanded}
        >
          {isExpanded ? "Read less" : "...Read more"}
        </button>
      )}
    </div>
  );
});
PromptItem.displayName = "PromptItem";
