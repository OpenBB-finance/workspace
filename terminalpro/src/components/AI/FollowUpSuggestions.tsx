import { memo } from "react";
import Icon from "~/components/Icon";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { useShallowStreamingStore } from "./hooks/useStreaming";

export const FollowUpSuggestions = memo(
  ({ suggestions }: { suggestions: string[] | null }) => {
    const { handleSubmitRef } = useCopilotContext();
    const isBusy = useShallowStreamingStore(
      (s) => s.streamingStatus === "streaming-started" || s.loading,
    );

    if (!suggestions || suggestions.length === 0 || isBusy) return null;

    return (
      <div className="mx-2 mb-2 mt-1">
        <span className="body-xs-medium text-ds-text-caption mb-1 block">
          Follow-ups
        </span>
        <div className="flex flex-col">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${index}-${suggestion}`}
              type="button"
              onClick={() => handleSubmitRef?.current?.({ question: suggestion })}
              className="flex items-center gap-2 px-2 py-1.5 -mx-1 rounded
                text-ds-text-body body-xs-regular text-left
                hover:bg-general-bg-secondary-hover
                transition-colors duration-150 cursor-pointer"
            >
              <Icon id="down-right" className="w-3 h-3 shrink-0 text-ds-text-caption" />
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  },
);
