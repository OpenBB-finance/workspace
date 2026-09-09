import { useEffect, useMemo } from "react";
import { AI_PROMPTS } from "~/lib/constants";
import { type CopilotWidget, useShallowCopilotStore } from "~/lib/state/copilot";

export function useTextSuggestions(
  selectedWidgets: CopilotWidget[] | null,
  dashboardWidgets: CopilotWidget[],
) {
  const { messages, setCopilotTextSuggestions } = useShallowCopilotStore((state) => ({
    messages: state.getCurrentChat()?.messages ?? [],
    setCopilotTextSuggestions: state.setCopilotTextSuggestions,
  }));

  const widgetTitles = useMemo(() => {
    if (selectedWidgets?.length) {
      return selectedWidgets.map((widget) => widget.name);
    }
    return dashboardWidgets.map((widget) => widget.name);
  }, [dashboardWidgets, selectedWidgets]);

  const copilotTextSuggestions = useMemo(() => {
    const hasMessages = messages.length > 0;

    if (widgetTitles.length > 0) {
      const matchedPrompts = Object.entries(AI_PROMPTS).map(([question, ids]) => {
        const matchCount = ids.reduce(
          (count, id) => count + (widgetTitles.includes(id) ? 1 : 0),
          0,
        );
        return { question, matchCount, idsLength: ids.length };
      });

      // Check for the prompts that make sense for function calling based on the widgets in the dashboard
      // Randomize the order of these prompts (if there are messages)
      const exactMatchedPrompts = matchedPrompts
        .filter(({ matchCount, idsLength }) => matchCount === idsLength)
        // No randomize if empty (avoids spamming while dashboard is loading)
        .sort(() => (hasMessages ? Math.random() - 0.5 : 0));

      // Check that the prompt hasn't already been used in the conversation
      const exactMatchedPromptsUnused = exactMatchedPrompts.filter(
        (item) =>
          !messages.some(
            (message) => message.role === "human" && message.content === item.question,
          ),
      );

      // Sort them based on the number of matches of widgets matches
      // E.g. if a prompt relies on having 3 widgets on the dashboard, this is obviously
      // much more targeted than a prompt than just relies on 1, thus the former takes priority
      return exactMatchedPromptsUnused.sort((a, b) => b.matchCount - a.matchCount);
    }
    return [];
  }, [widgetTitles, messages]);

  useEffect(() => {
    setCopilotTextSuggestions(copilotTextSuggestions);
  }, [copilotTextSuggestions]);
}
