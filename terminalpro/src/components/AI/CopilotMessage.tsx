import { useMemo } from "react";
import type { Message } from "~/lib/state/copilot";
import { CopilotAIMessage, CopilotHumanMessage, CopilotSystemMessage } from ".";

type CopilotMessageProps = {
  message: Message;
  isLastGroup: boolean;
  showIcon: boolean;
  currentGroupId?: string;
  allGroups?: any[];
  groupIndex?: number;
  isPartOfStepByStepGroup?: boolean;
};

export default function CopilotMessage(props: CopilotMessageProps) {
  const {
    message,
    isLastGroup,
    showIcon,
    currentGroupId,
    allGroups,
    groupIndex,
    isPartOfStepByStepGroup,
  } = props;

  const messageContent = useMemo(() => {
    if (message.role === "human") {
      return <CopilotHumanMessage message={message} />;
    }
    if (message.role === "system") {
      return (
        <CopilotSystemMessage
          message={message}
          showIcon={showIcon}
          currentGroupId={currentGroupId}
          isPartOfStepByStepGroup={isPartOfStepByStepGroup}
        />
      );
    }
    if (message.role === "ai") {
      return (
        <CopilotAIMessage
          message={message}
          isLastGroup={isLastGroup}
          allGroups={allGroups}
          groupIndex={groupIndex}
        />
      );
    }
    // If message type is not recognized, do not render anything
    return null;
  }, [
    message,
    isLastGroup,
    showIcon,
    currentGroupId,
    allGroups,
    groupIndex,
    isPartOfStepByStepGroup,
  ]);

  return useMemo(
    () => (
      <>
        <div className="_message-content">
          {messageContent && (
            <div className="flex flex-col gap-3.5 items-start justify-start relative text-xs">
              {messageContent}
            </div>
          )}
        </div>
      </>
    ),
    [messageContent],
  );
}
