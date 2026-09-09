import {
  memo,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useIsMobile from "~/hooks/useIsMobile";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { MAX_COPILOT_LINKS } from "~/lib/constants";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { type HierarchicalMention, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { cn, extractUrlsFromText } from "~/lib/utils";
import { useAutoHeightInput } from "../ui/hooks/useAutoHeightInput";
import {
  getSelectionIndex,
  scrollToSuggestion,
  useCopilotContextSuggestions,
} from "./hooks/useCopilotAddToContext";
import { useCopilotPromptHistory } from "./hooks/useCopilotPromptHistory";
import { MCP_TOOL_TRIGGER } from "./hooks/useMcpToolSuggestions";
import { useMentions } from "./hooks/useMentions";
import {
  type SlashCommandItem,
  type SlashCommandItems,
  SlashSuggestionItem,
  useSlashCommandSuggestions,
} from "./hooks/useSlashCommandSuggestions";
import { useLocalCommand, useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCopilotCommand } from "./hooks/utils";
import TextCompletion from "./TextCompletion";
import TextStyle from "./TextStyle";

export type TextAreaProps = {
  prompt?: string;
  type: "footer" | "editMessage" | "promptDialog";
  setPrompt?: (value: string) => void;
  handleSubmit?: (value: string) => void;
  openSuggestionsDown?: boolean;
  extraClassName?: string;
  placeholder?: string;
  completion?: string;
  setCompletion?: (value: string) => void;
};

const COMPLETION_KEY = {
  footer: "completion",
  editMessage: "editMessageCompletion",
};

const TextArea = (props: TextAreaProps) => {
  const isMobile = useIsMobile();
  const { limitReached, loading, completion, setCompletion } = useShallowStreamingStore(
    (s) => ({
      limitReached: s.limitReached,
      loading: s.loading,
      completion: s?.[COMPLETION_KEY[props.type]] ?? props.completion,
      setCompletion: (value: string) => {
        if (props.setCompletion) return props.setCompletion?.(value);

        if (COMPLETION_KEY[props.type])
          s.dispatch?.({ [COMPLETION_KEY[props.type]]: value });
      },
    }),
  );
  const handleSubmitRef = useCopilotContext().handleSubmitRef;
  const localPrompt = useLocalCommand();
  const localSetPrompt = useCallback(
    (value: string) => dispatchCopilotCommand(value),
    [],
  );

  const copilot = useShallowCopilotStore((state) => ({
    isTyping: state.isTyping,
    setIsTyping: state.setIsTyping,
    toggleTyping: state.toggleTyping,
    highlightWidget: state.setHoveredCitationWidgetId,
    questionsHistory: state.questionsHistory,
  }));

  const { setHoveredTabId, hoveredTabId } = useShallowCopilotStore((state) => ({
    setHoveredTabId: state.setHoveredTabId,
    hoveredTabId: state.hoveredTabId,
  }));

  const copilotData = useShallowCopilotDataStore((state) => ({
    toggleSelectedWidget: state.toggleSelectedWidget,
    selectedWidgets: state.copilotWidgets.selectedWidgets,
    addMentionTrackedWidget: state.addMentionTrackedWidget,
    setMentionTrackedWidgets: state.setMentionTrackedWidgets,
    removeMentionTrackedWidget: state.removeMentionTrackedWidget,
    clearMentionTrackedWidgets: state.clearMentionTrackedWidgets,
    mentionTrackedWidgetUuids: state.mentionTrackedWidgetUuids,
    getCopilotWidgets: state.getCopilotWidgets,
    setCopilotWidgets: state.setCopilotWidgets,
    isWidgetSelected: state.isWidgetSelected,
    getDashboardWidgetData: state.getDashboardWidgetData,
    addDataOnDashboardWidget: state.addDataOnDashboardWidget,
    removeWidgetSelected: state.removeWidgetSelected,
    removeDataFromDashboardWidget: state.removeDataFromDashboardWidget,
    addPreSelectedWidget: state.addPreSelectedWidget,
    removePreSelectedWidget: state.removePreSelectedWidget,
    isPreSelectedWidget: state.isPreSelectedWidget,
  }));

  // Enhanced submit function to clear mention-added widgets/tabs
  const enhancedHandleSubmit = useCallback(
    async (question: string) => {
      // First send the question with full context (including mention-tracked tabs/widgets)
      handleSubmitRef.current({ question });

      // After the message has been handed off, clean up temporary context in a micro-task
      setTimeout(() => {
        const mentionedUuids = Array.from(copilotData.mentionTrackedWidgetUuids);
        if (mentionedUuids.length === 0) return;
        copilotData.clearMentionTrackedWidgets();

        for (const uuid of mentionedUuids) {
          const widget = copilotData.selectedWidgets?.find((w) => w.uuid === uuid);
          // A widget is considered a "tab" widget if either:
          // 1. It contains a populated `metadata.tabWidgets` array (normal case).
          // 2. Its `widget_id` follows the `tab_` naming convention (fallback for edge-cases
          //    where the `tabWidgets` array may not have been set).
          const isTabWidget =
            widget?.metadata?.tabWidgets?.length > 0 ||
            widget?.widget_id?.startsWith("tab_");

          // Only remove widgets that were NOT already selected before being mentioned
          // If a widget was selected from CopilotContext first, keep it even if it was also mentioned
          const wasPreSelected = copilotData.isPreSelectedWidget(uuid);

          if (isTabWidget) {
            const tabId = widget?.metadata?.innerTabId;
            if (hoveredTabId === tabId) setHoveredTabId(null);

            // Only remove tab if it wasn't pre-selected from CopilotContext
            if (!wasPreSelected) {
              const currentWidgets = copilotData.getCopilotWidgets();
              copilotData.setCopilotWidgets({
                selectedWidgets: currentWidgets.selectedWidgets.filter(
                  (w) => w.uuid !== uuid,
                ),
              });

              // For tabs, remove them from the visual list **and** from the persistent selection set
              copilotData.removeWidgetSelected(uuid);

              // Also purge any lingering dashboard widget data so it can't be resurrected
              copilotData.removeDataFromDashboardWidget(uuid);
            }
            // Only remove regular widget if it wasn't pre-selected from CopilotContext
          } else if (!wasPreSelected) copilotData.toggleSelectedWidget(uuid);

          // Also remove from pre-selected tracking if it was there
          if (wasPreSelected) copilotData.removePreSelectedWidget(uuid);
        }
      });
    },
    [handleSubmitRef, copilotData, hoveredTabId, setHoveredTabId],
  );

  const {
    prompt = localPrompt,
    setPrompt = localSetPrompt,
    handleSubmit = enhancedHandleSubmit,
    openSuggestionsDown = false,
    extraClassName = "",
    placeholder = "Ask a question...",
  } = props;

  const { trigger, processMentions, restoreMentions } = useMentions();

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const onSuggestionClickRef = useRef<(suggestion: HierarchicalMention) => void>(null);

  const [state, dispatch] = useStateReducer({
    cursorPosition: 0,
    cursorLocation: { left: 0, bottom: 0 },
  });

  const { result: renderedPrompt, mentions } = useMemo(() => {
    return processMentions(prompt);
  }, [prompt, processMentions]);

  const getSearchQuery = useCallback(() => {
    // Get query from cursor position to determine if we're searching
    const textBeforeCursor = renderedPrompt.substring(0, state.cursorPosition);
    const lastTriggerIndex = textBeforeCursor.lastIndexOf(trigger);
    const searchQuery =
      lastTriggerIndex >= 0
        ? textBeforeCursor.substring(lastTriggerIndex + trigger.length).trim()
        : "";
    return searchQuery;
  }, [renderedPrompt, state.cursorPosition, trigger]);

  const {
    searchSuggestions,
    suggestions,
    handleSelection,
    handleKeyDown,
    suggestionElements,
  } = useCopilotContextSuggestions({
    inputRef: textAreaRef,
    suggestionsRef,
    getSearchQuery,
    onSuggestionClickRef,
    fromTextArea: true,
    textAreatype: props.type,
  });

  // Unified slash command suggestions state (skills + MCP tools)
  const { searchSlashCommands, hasItems: hasSlashItems } = useSlashCommandSuggestions();
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommandItems>(null);
  const slashSuggestionsRef = useRef<HTMLDivElement>(null);

  const isSuggestionsOpen = suggestions.length > 0;

  useAutoHeightInput(textAreaRef, {
    value: renderedPrompt,
    textContent: completion,
  });

  const { handleHistoryNavigation, resetHistoryCursor } = useCopilotPromptHistory({
    textAreaRef,
    questionsHistory: copilot.questionsHistory,
    currentPrompt: prompt,
    setPrompt,
    setCompletion,
  });

  const handleChange = useCallbackRef(
    async (e: ReactChangeEvent<HTMLTextAreaElement>) => {
      resetHistoryCursor();
      const targetValue = e.currentTarget.value as string;
      const urls = extractUrlsFromText(targetValue);
      if (urls.length > MAX_COPILOT_LINKS) {
        toast.error("You reached the maximum number of links.", {
          description: `You can only add up to ${MAX_COPILOT_LINKS} links.`,
        });
        return;
      }

      let newCompletion = "";
      if (!isSuggestionsOpen && targetValue && targetValue !== trigger) {
        try {
          const regexHistory = new RegExp(
            `^${targetValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          );
          const match = copilot.questionsHistory
            .slice()
            .reverse()
            .find((q) => regexHistory.test(q));
          if (match) newCompletion = match;
        } catch (_) {
          // Intentionally empty - regex might fail, but we continue
        } finally {
          setCompletion(newCompletion);
        }
      } else setCompletion("");

      if (!textAreaRef.current) return;
      const cursorPosition = e.currentTarget.selectionStart;
      const textBeforeCursor = targetValue.substring(0, cursorPosition);
      const textAfterCursor = targetValue.substring(cursorPosition);
      let newSuggestions = [] as HierarchicalMention[];
      const start = textBeforeCursor.lastIndexOf(trigger);

      // Check if @ is part of an email address pattern
      const isLikelyEmail = () => {
        if (start === -1) return false;
        // Check if there's text before @ that looks like an email username
        const beforeAt = textBeforeCursor.substring(0, start);
        // Email usernames typically contain letters, numbers, dots, hyphens, underscores
        // and don't have spaces immediately before the @
        const emailUsernamePattern = /[\w.-]+$/;
        return emailUsernamePattern.test(beforeAt);
      };

      if (isSuggestionsOpen) {
        if (textAfterCursor.startsWith(trigger)) newSuggestions = suggestions;
        else if (textBeforeCursor.includes(trigger) && !isLikelyEmail())
          newSuggestions = searchSuggestions(textBeforeCursor.substring(start), 0.2);
      } else if (textBeforeCursor.endsWith(trigger) && !isLikelyEmail())
        newSuggestions = searchSuggestions(trigger, 0.2);
      else if (textBeforeCursor.includes(trigger) && !isLikelyEmail())
        newSuggestions = searchSuggestions(textBeforeCursor.substring(start));

      if (newSuggestions.length === 0) searchSuggestions(null);

      // Handle "/" triggers - unified slash command dropdown (skills + MCP tools)
      const slashStart = textBeforeCursor.lastIndexOf(MCP_TOOL_TRIGGER);
      const hasSlashTrigger = slashStart !== -1;
      const isSlashAtWordBoundary =
        slashStart === 0 || /\s/.test(textBeforeCursor[slashStart - 1] || "");

      let hasSlashSuggestions = false;
      if (hasSlashTrigger && isSlashAtWordBoundary && hasSlashItems) {
        const slashQuery = textBeforeCursor.substring(slashStart);
        const matched = searchSlashCommands(slashQuery);
        if (matched.hasSuggestions) setSlashSuggestions(matched);
        hasSlashSuggestions = matched.hasSuggestions;
      }
      const selectionIndex = getSelectionIndex(true);
      const stringBefore = targetValue.substring(0, cursorPosition + trigger.length);
      const triggerForCursor = hasSlashSuggestions ? MCP_TOOL_TRIGGER : trigger;
      const lastTrigger = stringBefore.lastIndexOf(triggerForCursor);

      const cursorLocation = getCursorOffset(
        textAreaRef.current,
        newCompletion,
        lastTrigger,
      );

      dispatch({ cursorPosition, cursorLocation });

      if (!hasSlashSuggestions) {
        setSlashSuggestions(null);
        copilot.highlightWidget(
          newSuggestions?.[selectionIndex]?.content?.uuid ?? null,
        );
      }

      queueMicrotask(() => {
        // Scroll to current selection if needed
        if (newSuggestions.length > 0 || hasSlashSuggestions) {
          scrollToSuggestion(selectionIndex, true);
        }

        for (const ref of [suggestionsRef, slashSuggestionsRef]) {
          if (!ref.current?.style) continue;
          ref.current.style.left = `max(0px, calc(min(${cursorLocation.left}px, 100% - 28rem)))`;
          ref.current.style.bottom = openSuggestionsDown
            ? "0"
            : `${cursorLocation.bottom + 10}px`;
          ref.current.style.transform = openSuggestionsDown
            ? "translateY(80%)"
            : "translateY(0)";
        }
      });

      // Prompt with mentions like @[id:...]
      const rawTargetValue = restoreMentions(targetValue, mentions);
      if (props.type === "promptDialog") return setPrompt(rawTargetValue);

      // Auto-remove widgets/tabs from context when @ mentions are deleted
      const { mentions: currentMentions } = processMentions(rawTargetValue);
      const currentTrackedUuids = new Set<string>();

      for (const mention of currentMentions) {
        if (mention.group === "tab" && mention.content?.uuid) {
          // For tab mentions, track the tab UUID itself (not individual widgets)
          currentTrackedUuids.add(mention.content.uuid);
        }

        // For individual widget mentions (dashboard or all)
        if (mention.group === "dashboard" || mention.group === "all") {
          // If the mention already provides a UUID, use it directly
          if (mention.content?.uuid) {
            currentTrackedUuids.add(mention.content.uuid);
          }

          // Special case: workspace ("all") mentions don't have UUIDs at suggestion time.
          // When the user selects one, we create a temporary widget and surface it in
          // selectedWidgets with a generated UUID. Map the mention by widget_id to that UUID
          // so it persists while typing.
          if (mention.group === "all" && mention.content?.widget_id) {
            const selected = copilotData.selectedWidgets?.find(
              (w) => w.widget_id === mention.content.widget_id,
            );
            if (selected?.uuid) currentTrackedUuids.add(selected.uuid);
          }
        }
      }

      const newTrackedWidgetUuids = new Set(copilotData.mentionTrackedWidgetUuids);
      const trackedWidgetUuids = Array.from(newTrackedWidgetUuids);

      // Find widgets/tabs that were removed (were in previous but not in current)
      const removedUuids = trackedWidgetUuids.filter(
        (uuid) => !currentTrackedUuids.has(uuid),
      );

      // Remove widgets/tabs from context that had their mentions deleted
      for (const uuid of removedUuids) {
        // Check if this is a tab widget
        const widget = copilotData.selectedWidgets?.find((w) => w.uuid === uuid);
        // A widget is considered a "tab" widget if either:
        // 1. It contains a populated `metadata.tabWidgets` array (normal case).
        // 2. Its `widget_id` follows the `tab_` naming convention (fallback for edge-cases
        //    where the `tabWidgets` array may not have been set).
        const isTabWidget =
          widget?.metadata.tabWidgets?.length > 0 ||
          widget?.widget_id?.startsWith("tab_");

        if (isTabWidget) {
          // Check if this tab is currently being hovered and clear highlighting if so
          const tabWidget = copilotData.selectedWidgets?.find((w) => w.uuid === uuid);
          const tabId = tabWidget?.metadata?.innerTabId;
          if (hoveredTabId === tabId) setHoveredTabId(null);

          // For tabs, remove them from the visual list **and** from the persistent selection set
          const currentWidgets = copilotData.getCopilotWidgets();
          copilotData.setCopilotWidgets({
            selectedWidgets: currentWidgets.selectedWidgets.filter(
              (w) => w.uuid !== uuid,
            ),
          });

          // Synchronously remove the tab from the selectedWidgetIDs array to avoid race-conditions
          copilotData.removeWidgetSelected(uuid);

          // Also purge any lingering dashboard widget data so it can't be resurrected
          copilotData.removeDataFromDashboardWidget(uuid);
        } else if (
          !copilotData.isPreSelectedWidget(uuid) &&
          copilotData.isWidgetSelected(uuid)
        ) {
          // For regular widgets, only remove if they were added via mention
          // This is the key change - we don't remove widgets that were selected before being mentioned
          copilotData.toggleSelectedWidget(uuid);
        }

        newTrackedWidgetUuids.delete(uuid);
      }

      // Update tracking by syncing with current mentions
      // First remove items no longer mentioned
      for (const uuid of trackedWidgetUuids)
        if (!currentTrackedUuids.has(uuid)) newTrackedWidgetUuids.delete(uuid);

      // Then add newly mentioned items
      for (const uuid of currentTrackedUuids)
        if (!copilotData.mentionTrackedWidgetUuids.has(uuid))
          newTrackedWidgetUuids.add(uuid);

      copilotData.setMentionTrackedWidgets(Array.from(newTrackedWidgetUuids));

      setPrompt(rawTargetValue);
    },
  );

  const handleSelectionLocal = useCallbackRef((selection: HierarchicalMention) => {
    if (!textAreaRef.current) return;
    const currentValue = textAreaRef.current.value;
    const mentionStart = currentValue.lastIndexOf(trigger, state.cursorPosition);
    const mentionEnd =
      mentionStart === state.cursorPosition
        ? state.cursorPosition + 1
        : Math.max(
            currentValue.indexOf(" ", state.cursorPosition),
            state.cursorPosition,
          );

    // Add space before the mention if there's text before it and no space already
    const split = getBeforeAfterCursor(currentValue, mentionStart, mentionEnd);

    const insertValue = `${split.spacePrefix}${trigger}[id:${selection.id}]  `;
    const newRenderedPrompt = `${split.beforeCursor}${insertValue}${split.afterCursor}`;
    const newPrompt = restoreMentions(newRenderedPrompt, mentions);
    const textValue = `${split.spacePrefix}${trigger}${selection.name}  `;

    // Add space after
    setPrompt(`${newPrompt}${split.afterCursor === "" ? "" : " "}`);

    // Clean up any hierarchical properties before processing
    const cleanSelection = {
      ...selection,
      _isChildWidget: undefined,
      _parentTabId: undefined,
    } as HierarchicalMention;

    // Rest of the selection handling, web included for state update
    handleSelection(selection);
    if (props.type === "promptDialog") textAreaRef.current?.focus();

    queueMicrotask(() => {
      const newCursorPos = mentionStart + textValue.length;
      textAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    });
  });

  useMemo(() => {
    onSuggestionClickRef.current = handleSelectionLocal;
  }, [handleSelectionLocal]);

  // Handle selection of unified slash command suggestions (skills + MCP tools)
  const handleSlashSelection = useCallbackRef((data: SlashCommandItem) => {
    if (!textAreaRef.current) return;
    const currentValue = textAreaRef.current.value;
    const cursorPos = textAreaRef.current.selectionStart;
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const slashStart = textBeforeCursor.lastIndexOf(MCP_TOOL_TRIGGER, cursorPos);

    if (slashStart === -1) return;

    // Replace the partial slash command with the full one
    const split = getBeforeAfterCursor(currentValue, slashStart, cursorPos);

    const insertValue = `${split.spacePrefix}${data.slashText}  `;
    const newRenderedPrompt = `${split.beforeCursor}${insertValue}${split.afterCursor}`;

    // Restore mentions to preserve widget/mention highlights
    const newPrompt = restoreMentions(newRenderedPrompt, mentions);

    setPrompt(`${newPrompt}${split.afterCursor === "" ? "" : " "}`);
    setSlashSuggestions(null);
    textAreaRef.current?.focus();
    queueMicrotask(() => {
      const newCursorPos = slashStart + insertValue.length;
      textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    });
  });

  const handleKeyDownLocal = useCallbackRef(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.shiftKey) return;
      // Handle unified slash command suggestions keyboard navigation
      const { skills, mcpTools, semanticViews, hasSuggestions } =
        slashSuggestions ?? {};
      if (hasSuggestions) {
        const suggestions = [...skills, ...mcpTools, ...semanticViews];
        const currentSlashIndex = getSelectionIndex(true);
        const currentIndex = currentSlashIndex % suggestions?.length;
        const arrLength = suggestions.length;
        let newIndex = null;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          newIndex = currentIndex === arrLength - 1 ? 0 : currentSlashIndex + 1;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          newIndex = currentIndex === 0 ? arrLength - 1 : currentSlashIndex - 1;
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selected = suggestions[currentSlashIndex];
          if (selected) handleSlashSelection(selected);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSlashSuggestions(null);
          return;
        }

        // Scroll immediately - no delay needed for instant scrolling
        if (newIndex !== null) scrollToSuggestion(newIndex, true);

        return;
      }

      const suggestion = handleKeyDown(e);

      if (isSuggestionsOpen) {
        if (suggestion) {
          if (e.key === "Space") {
            // Accept suggestion if it matches the current text
            const currentValue = textAreaRef.current?.value ?? "";
            const start =
              currentValue.lastIndexOf(trigger, state.cursorPosition) + trigger.length;
            const name = suggestion?.name || suggestion?.content?.name || "";
            if (
              name &&
              currentValue.slice(start).toLowerCase() === name.toLowerCase()
            ) {
              e.preventDefault();
              handleSelectionLocal(suggestion);
            }
            return;
          }

          return handleSelectionLocal(suggestion);
        }
      } else {
        if (handleHistoryNavigation(e)) return;
        if (completion && (e.key === "ArrowRight" || e.key === "Tab")) {
          // Accept completion
          e.preventDefault();
          if (completion) {
            const newPrompt = restoreMentions(completion, mentions);
            setPrompt(newPrompt);
            setCompletion("");
          }
          return;
        }
        if (e.key === "Enter") {
          // Only submit on Enter without Shift
          if (!e.shiftKey) {
            e.preventDefault();
            if (prompt !== "" && !loading) {
              setCompletion("");
              handleSubmit(prompt);
              return;
            }
          }
          // Allow Shift+Enter to create a new line (default behavior)
        }
        if (e.key === "Escape") {
          setCompletion("");
        }
      }
    },
  );

  const onBlur = useCallback(() => {
    copilot.setIsTyping(false);
    copilot.highlightWidget(null);
  }, [copilot.setIsTyping, copilot.highlightWidget]);

  // Process suggestions to create hierarchical structure like CopilotContext

  const suggestionsMemo = useMemo(() => {
    return (
      <div
        ref={(el) => (suggestionsRef.current = el)}
        className={cn(
          "absolute only-sm:max-h-[60vh]! bg-dropdown-bg border border-dropdown-border",
          "shadow-dropdown rounded-sm z-30",
          "overflow-hidden text-xs flex flex-col p-2 gap-2",
          {
            hidden: !(renderedPrompt !== "" && isSuggestionsOpen),
          },
        )}
        style={{
          width: "calc(min(28rem, 100%))",
        }}
      >
        <div className="px-1 text-xs font-semibold text-ds-text-heading">Widgets</div>
        <div className="flex-1 min-h-0">
          {renderedPrompt !== "" && isSuggestionsOpen && suggestionElements}
        </div>
      </div>
    );
  }, [
    suggestionsRef,
    suggestionElements,
    renderedPrompt,
    isSuggestionsOpen,
    suggestions.length,
  ]);

  // Unified slash command suggestions dropdown (skills + MCP tools)
  const slashSuggestionsMemo = useMemo(() => {
    if (!slashSuggestions?.hasSuggestions) return null;

    const { skills, mcpTools, semanticViews } = slashSuggestions;

    // Build a flat index counter so keyboard nav works across sections
    let flatIndex = 0;

    return (
      <div
        ref={slashSuggestionsRef}
        className={cn(
          "absolute max-h-72 bg-dropdown-bg border border-dropdown-border",
          "shadow-dropdown rounded-sm z-30",
          "overflow-hidden p-2 flex flex-col gap-1",
        )}
        style={{
          width: "calc(min(28rem, 100%))",
        }}
      >
        <div className="overflow-y-auto overflow-x-hidden max-h-64 flex flex-col">
          {skills.length > 0 && (
            <>
              <div className="px-1 py-1 text-2xs font-semibold text-ds-text-caption uppercase tracking-wide">
                Skills
              </div>
              {skills.map((item) => {
                const idx = flatIndex++;
                return (
                  <SlashSuggestionItem
                    key={`slash-skill-${item.slug}`}
                    item={item}
                    index={idx}
                    onSelect={handleSlashSelection}
                    isMobile={isMobile}
                  />
                );
              })}
            </>
          )}
          {mcpTools.length > 0 && (
            <>
              <div className="px-1 py-1 text-2xs font-semibold text-ds-text-caption uppercase tracking-wide">
                MCP Tools
              </div>
              {mcpTools.map((item) => {
                const idx = flatIndex++;
                return (
                  <SlashSuggestionItem
                    key={`slash-mcp-${item.id}`}
                    item={item}
                    index={idx}
                    onSelect={handleSlashSelection}
                    isMobile={isMobile}
                  />
                );
              })}
            </>
          )}
          {semanticViews.length > 0 && (
            <>
              <div className="px-1 py-1 text-2xs font-semibold text-ds-text-caption uppercase tracking-wide">
                Semantic Views
              </div>
              {semanticViews.map((item) => {
                const idx = flatIndex++;
                return (
                  <SlashSuggestionItem
                    key={`slash-sv-${item.fqn}`}
                    item={item}
                    index={idx}
                    onSelect={handleSlashSelection}
                    isMobile={isMobile}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }, [slashSuggestions, handleSlashSelection]);

  return (
    <div className="relative text-base leading-6 md:text-xs md:leading-5">
      <TextStyle
        className="absolute items-center inset-0 z-30 bg-transparent text-transparent
        pointer-events-none whitespace-pre-wrap break-words"
        content={prompt}
        overlay
      />
      <textarea
        id="copilot-input"
        ref={textAreaRef}
        tabIndex={-1}
        disabled={limitReached}
        className={cn(
          "h-20 max-h-80 relative z-20 bg-transparent w-full resize-none overflow-y-auto",
          "dark:text-white text-light-900 placeholder:text-light-600 dark:placeholder:text-light-400",
          extraClassName,
        )}
        defaultValue={renderedPrompt}
        onChange={handleChange}
        onKeyDown={handleKeyDownLocal}
        onFocus={copilot.toggleTyping}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={1}
      />
      {suggestionsMemo}
      {slashSuggestionsMemo}
      <TextCompletion
        renderedPrompt={renderedPrompt}
        completion={completion}
        processMentions={processMentions}
      />
    </div>
  );
};

export default memo(TextArea);

const getBeforeAfterCursor = (text: string, start: number, end: number) => {
  const beforeCursor = text.slice(0, start);
  const afterCursor = text.slice(end);
  const needsSpaceBefore = beforeCursor.length > 0 && !beforeCursor.endsWith("  ");
  const spacePrefix = needsSpaceBefore ? " " : "";
  return { beforeCursor, afterCursor, spacePrefix };
};
const calculateContentHeight = (
  textContent: string,
  target: HTMLTextAreaElement,
  offset = 0.5,
) => {
  const tempDiv = document.createElement("div");
  tempDiv.style.visibility = "hidden";
  tempDiv.style.position = "absolute";
  tempDiv.style.width = `${target.offsetWidth}px`;
  tempDiv.style.font = getComputedStyle(target).font;
  tempDiv.style.lineHeight = getComputedStyle(target).lineHeight;
  tempDiv.style.whiteSpace = "pre-wrap";
  tempDiv.textContent = textContent;

  document.body.appendChild(tempDiv);
  const contentHeight = tempDiv.offsetHeight;
  document.body.removeChild(tempDiv);

  return contentHeight + offset;
};

// Cache DOM elements to avoid creating new ones on every call
let cachedGhostDiv: HTMLDivElement | null = null;
let cachedGhostSpan: HTMLSpanElement | null = null;

const getCursorOffset = (
  element: HTMLTextAreaElement | null,
  completion: string,
  selectionStart: number,
) => {
  if (!element) {
    return { left: 0, bottom: 0 };
  }

  // Create cached elements only once
  if (!cachedGhostDiv) {
    cachedGhostDiv = document.createElement("div");
    cachedGhostSpan = document.createElement("span");

    // Set static styles that don't change
    cachedGhostDiv.style.position = "absolute";
    cachedGhostDiv.style.top = "-9999px";
    cachedGhostDiv.style.left = "-9999px";
    cachedGhostDiv.style.height = "auto";
    cachedGhostDiv.style.whiteSpace = "pre-wrap";
    cachedGhostDiv.style.wordWrap = "break-word";
    cachedGhostSpan.textContent = "";
  }

  // Update dynamic styles and content
  const style = getComputedStyle(element);
  const elementValue = element.value;
  let contentToMeasure = completion || elementValue;
  if (contentToMeasure.endsWith("\n")) contentToMeasure += "_";
  const calculatedHeight = calculateContentHeight(contentToMeasure, element);

  cachedGhostDiv.style.width = `${element.offsetWidth}px`;
  cachedGhostDiv.style.padding = style.padding;
  cachedGhostDiv.style.border = style.border;
  cachedGhostDiv.style.font = style.font;
  cachedGhostDiv.style.lineHeight = style.lineHeight;
  cachedGhostDiv.textContent = element.value.substring(0, selectionStart);

  // Append span for cursor position measurement
  cachedGhostDiv.appendChild(cachedGhostSpan);

  document.body.appendChild(cachedGhostDiv);
  const { offsetLeft: spanX, offsetTop: spanY } = cachedGhostSpan;
  document.body.removeChild(cachedGhostDiv);

  const newLineAdjustment = spanX === 0 ? -3 : 0;
  return {
    left: spanX + element.scrollLeft - element.scrollLeft,
    bottom: calculatedHeight + newLineAdjustment - spanY - element.clientTop,
  };
};
