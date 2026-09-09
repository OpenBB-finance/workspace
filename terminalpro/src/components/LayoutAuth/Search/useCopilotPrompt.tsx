import { memo, useCallback } from "react";
import { useCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import {
  dispatchCopilotSubmit,
  dispatchExpandCopilotIfHidden,
} from "~/components/AI/hooks/utils";
import Avatar from "~/components/General/Avatar";
import Icon from "~/components/Icon";
import { getDefaultCopilot } from "~/lib/constants";

const CopilotPromptBanner = memo(
  ({
    query,
    onOpenChange,
  }: {
    query: string;
    onOpenChange: (open: boolean) => void;
  }) => {
    const copilot = getDefaultCopilot();
    const copilotEnabled = useCopilotAvailable();

    const handleAskCopilot = useCallback(() => {
      onOpenChange(false);
      dispatchCopilotSubmit({ question: query });
      dispatchExpandCopilotIfHidden();
    }, [query, onOpenChange]);

    if (!query || !copilotEnabled) return null;

    return (
      <button
        type="button"
        onClick={handleAskCopilot}
        className="flex items-center gap-2.5 w-full max-w-full px-3 py-2 mt-3 rounded bg-general-bg-secondary hover:bg-general-bg-secondary-hover border border-general-border-secondary transition-colors cursor-pointer group overflow-hidden"
      >
        <Avatar
          className="size-5 bg-transparent flex-shrink-0"
          src={copilot.image}
          alt={copilot.name}
          fallback={copilot.name.charAt(0)}
          variant="noVariant"
        />
        <span className="body-xs-regular text-ds-text-body min-w-0 truncate">
          Ask{" "}
          <span className="body-xs-medium text-ds-text-heading">{copilot.name}</span>
          {": "}
          <span className="italic">"{query}"</span>
        </span>
        <Icon
          id="arrow-right"
          className="size-3.5 text-ds-text-caption group-hover:text-ds-text-body transition-colors ml-auto flex-shrink-0"
        />
      </button>
    );
  },
);

export default CopilotPromptBanner;
