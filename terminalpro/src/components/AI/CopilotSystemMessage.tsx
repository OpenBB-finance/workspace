import Markdown from "markdown-to-jsx";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { type SystemMessage, useShallowCopilotStore } from "~/lib/state/copilot";
import { cn } from "../ds/utils";
import { someTruthy } from "../General/Table/utils";
import { Artifact, Table } from ".";
import CopilotMessageTitle from "./CopilotMessageTitle";
import { CodeComponent, PreCodeComponent, renderRule } from "./MarkdownOverrides";
import { escapeMarkdownUnderscores } from "./utils/markdown";

type CopilotSystemMessageProps = {
  message: SystemMessage;
  showIcon: boolean;
  currentGroupId?: string;
  isPartOfStepByStepGroup?: boolean;
};

const markdownOptions = {
  renderRule,
  disableParsingRawHTML: true,
  overrides: {
    a: {
      component: ({ children }: { children: ReactNode }) => (
        <span className="text-inherit">{children}</span>
      ),
    },
    code: { component: CodeComponent },
    pre: { component: PreCodeComponent },
  },
};

export default function CopilotSystemMessage(props: CopilotSystemMessageProps) {
  const { message, showIcon, currentGroupId, isPartOfStepByStepGroup } = props;

  const { showDatetime, hideDatetime } = useShallowCopilotStore((state) => ({
    showDatetime: state.showDatetime,
    hideDatetime: state.hideDatetime,
  }));

  const [isMessageExpanded, setIsMessageExpanded] = useState(false);

  const handleMouseEnter = useCallback(() => {
    // Only handle hover if not part of a step-by-step group (parent handles it)
    if (currentGroupId && !isPartOfStepByStepGroup) {
      // For system messages, show datetime above the current group
      showDatetime(message.timestamp, currentGroupId);
    }
  }, [message.timestamp, currentGroupId, isPartOfStepByStepGroup]);

  const handleMouseLeave = useCallback(() => {
    // Only handle hover if not part of a step-by-step group (parent handles it)
    if (!isPartOfStepByStepGroup) hideDatetime();
  }, [isPartOfStepByStepGroup]);

  const { messageContent, hasBody, eventType, details, artifacts } = useMemo(() => {
    const messageContent = message?.content?.message;
    if (!messageContent) return {};
    const { eventType, details, artifacts } = message?.content || {};

    const hasBody = someTruthy(details, artifacts);
    return { messageContent, hasBody, eventType, details, artifacts };
  }, [message]);

  if (!messageContent) return null;

  return (
    <div
      className="flex flex-col w-full rounded group relative"
      // Only add hover handlers if not part of a step-by-step group
      {...(!isPartOfStepByStepGroup && {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      })}
    >
      <CopilotMessageTitle
        isExpanded={isMessageExpanded}
        isExpandable={hasBody}
        toggleDropdown={() => setIsMessageExpanded((prev) => !prev)}
        content={messageContent}
        eventType={eventType}
        showIcon={showIcon}
      />
      {hasBody && isMessageExpanded && (
        <div
          className="rounded-b prose-sm text-light-600 text-xs
          font-medium dark:text-light-300 prose-p:my-1.5 py-1
          dark:prose-invert border-[0px] rounded border-dark-600 overflow-auto"
        >
          <div className="flex flex-col gap-1 ml-4 bg-light-50 dark:bg-dark-800 rounded overflow-x-auto">
            {details?.map((detail: string | Record<string, any>, index: number) => {
              if (!detail) return null;
              if (typeof detail === "string") {
                const hasCodeBlock = detail.includes("```");
                detail = escapeMarkdownUnderscores(detail);

                return (
                  <div
                    key={index}
                    className={cn(
                      "w-full prose-sm text-xs! prose-p:my-1.5",
                      "prose dark:prose-invert max-w-none overflow-x-auto",
                      "prose-code:break-words prose-code:whitespace-pre-wrap",
                      { "px-5 py-2": !hasCodeBlock },
                    )}
                  >
                    <Markdown key={`markdown-${index}`} options={markdownOptions}>
                      {detail}
                    </Markdown>
                  </div>
                );
              }
              return <Table key={index} content={detail} disableAutoLink={true} />;
            })}
          </div>
          <div className="gap-1 ml-4 rounded">
            {artifacts?.map((artifact, index) => (
              <div className="rounded" key={index}>
                <Artifact key={index} artifact={artifact} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
