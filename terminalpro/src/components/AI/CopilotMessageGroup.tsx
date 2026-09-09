import clsx from "clsx";
import dayjs from "dayjs";
import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";
import {
  type Message,
  type MessageGroup,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { CopilotContentErrorBoundary } from ".";
import CopilotMessage from "./CopilotMessage";
import CopilotMessageTitle from "./CopilotMessageTitle";
import { FollowUpSuggestions } from "./FollowUpSuggestions";
import { QueryLimitReached } from "./hooks/useQueriesLeft";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { createMessageGroups } from "./utils/createMessageGroups";

type CopilotMessageGroupProps = {
  group: MessageGroup;
  groupIndex: number;
  previousGroupRole?: MessageGroup["role"];
  isLastGroup?: boolean;
  allGroups: MessageGroup[];
};

const LoadingEllipsis = memo((props: { lastGroup?: MessageGroup }) => {
  const { lastGroup } = props;
  const [streamingStatus, loading] = useShallowStreamingStore((s) => [
    s.streamingStatus,
    s.loading,
  ]);
  const orchestrationModeEnabled = useShallowCopilotStore(
    (s) => s.orchestrationModeEnabled,
  );
  const shouldShowStandalone = useMemo(() => {
    const isLoading =
      loading &&
      (streamingStatus === "streaming-ready" ||
        (orchestrationModeEnabled && streamingStatus === "streaming-started"));

    // Check if the last group is a step-by-step reasoning group
    const hasStepByStepInProgress =
      lastGroup &&
      lastGroup.role === "system" &&
      loading &&
      (streamingStatus === "streaming-ready" ||
        (orchestrationModeEnabled && streamingStatus === "streaming-started"));

    // Only show standalone loading ellipsis if not showing within step-by-step reasoning
    return isLoading && !hasStepByStepInProgress;
  }, [loading, streamingStatus, orchestrationModeEnabled, lastGroup]);

  return useMemo(
    () => (
      <Fragment key="loading-ellipsis">
        {shouldShowStandalone && (
          <div
            className="loading-ellipsis relative rounded h-[32px] w-[40px]
            px-1.5 py-0.5 dark:prose-invert bg-light-50 dark:bg-dark-850 ml-2 mr-2"
          >
            <span className="loading-ellipsis__dot" />
            <span className="loading-ellipsis__dot" />
            <span className="loading-ellipsis__dot" />
          </div>
        )}
      </Fragment>
    ),
    [shouldShowStandalone],
  );
});

export default function CopilotMessageGroupRoot() {
  const [streamingStatus, loading] = useShallowStreamingStore((s) => [
    s.streamingStatus,
    s.loading,
  ]);

  const isLoading = loading && streamingStatus === "streaming-ready";

  const [streamingData, _] = useLocalStorage("streamedData", "");
  const hasStreamingData = streamingData !== "";

  const { messages, setShowWelcome } = useShallowCopilotStore((s) => ({
    messages: s.getCurrentChat().messages,
    setShowWelcome: s.setShowWelcome,
  }));

  const { lastAiSuggestions, groupedMessages } = useMemo(
    () => createMessageGroups(messages, isLoading),
    [messages, isLoading],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setShowWelcome(groupedMessages?.length === 0 && !hasStreamingData);
    });
  }, [groupedMessages?.length === 0, !hasStreamingData]);

  const groupedMessagesMemo = useMemo(
    () =>
      groupedMessages.map((group, index, arr) => {
        return (
          <CopilotMessageGroup
            key={`${group.role}-${index}`}
            group={group}
            groupIndex={index}
            previousGroupRole={arr[index - 1]?.role}
            isLastGroup={index === arr.length - 1}
            allGroups={arr}
          />
        );
      }),
    [groupedMessages],
  );

  return (
    <Fragment key="copilot-message-group-root">
      {groupedMessagesMemo}
      <FollowUpSuggestions suggestions={lastAiSuggestions} />
      <LoadingEllipsis lastGroup={groupedMessages[groupedMessages.length - 1]} />
      <QueryLimitReached />
    </Fragment>
  );
}

function getHighestEventType(message: Message, highestType: string): string {
  if (message.role === "system" && message.content.eventType) {
    const { eventType } = message.content;
    if (eventType === "ERROR") return "ERROR";
    if (eventType === "WARNING" && highestType !== "ERROR") return "WARNING";
  }
  return highestType;
}

export function CopilotMessageGroup(props: CopilotMessageGroupProps) {
  const { group, groupIndex, isLastGroup, previousGroupRole, allGroups } = props;

  const [streamingStatus, loading] = useShallowStreamingStore((s) => [
    s.streamingStatus,
    s.loading,
  ]);

  // Get orchestration mode for gradient animation
  const orchestrationModeEnabled = useShallowCopilotStore(
    (s) => s.orchestrationModeEnabled,
  );

  // Check if this is a step-by-step reasoning group
  const isStepByStepGroup =
    group.role === "system" &&
    (group.groupTitle === "Step-by-step reasoning" ||
      group.groupTitle?.includes("Step-by-step"));

  const [isGroupExpanded, setIsGroupExpanded] = useState(false);

  const hasMultipleMessages = group.messages.length > 1;
  const displayMessages = !hasMultipleMessages || isGroupExpanded;

  // Generate unique group ID for targeting
  const groupId = `group-${groupIndex}`;

  // Group event type is the highest severity of the messages in the group
  const { messagesMemo, groupEventType } = useMemo(() => {
    const reduced = group.messages.reduce(
      (acc, message, messageIndex) => {
        acc.messagesMemo.push(
          <div
            key={`${groupIndex}-${messageIndex}`}
            className={clsx({ "mt-1": hasMultipleMessages && messageIndex === 0 })}
          >
            <CopilotContentErrorBoundary key={messageIndex}>
              <CopilotMessage
                key={`${messageIndex}-${message.timestamp}`}
                {...{
                  message,
                  isLastGroup: isLastGroup,
                  previousGroupRole: previousGroupRole,
                  showIcon: !hasMultipleMessages,
                  currentGroupId: groupId,
                  allGroups,
                  groupIndex,
                  isPartOfStepByStepGroup: isStepByStepGroup,
                }}
              />
            </CopilotContentErrorBoundary>
          </div>,
        );

        acc.groupEventType = getHighestEventType(message, acc.groupEventType ?? "INFO");

        return acc;
      },
      { messagesMemo: [], groupEventType: null },
    );

    return reduced;
  }, [
    group.messages,
    groupIndex,
    groupId,
    isLastGroup,
    previousGroupRole,
    hasMultipleMessages,
    isStepByStepGroup,
  ]);

  const { showDatetime, onMouseLeave } = useShallowCopilotStore((s) => ({
    showDatetime: s.showDatetime,
    onMouseLeave: s.hideDatetime,
  }));

  const onMouseEnter = useCallback(() => {
    showDatetime(group.messages[0].timestamp, groupId);
  }, [group.messages[0].timestamp, groupId]);

  // Now that we have the groupEventType we can decide if the gradient should run
  const isStepByStepInProgress =
    group.role === "system" &&
    isLastGroup &&
    loading &&
    (streamingStatus === "streaming-ready" ||
      (orchestrationModeEnabled && streamingStatus === "streaming-started"));

  const isSystemOrSingleAiMessage =
    group.role === "system" || (group.role === "ai" && previousGroupRole !== "system");

  return (
    <div
      id={groupId}
      key={groupIndex}
      className={clsx("flex flex-col rounded mx-2 mb-2", {
        "mt-[-10px]":
          (group.role === "ai" && previousGroupRole === "system") ||
          (group.role === "system" && previousGroupRole === "ai"),
        "mt-2.5!":
          (group.role === "system" && previousGroupRole === "ai") ||
          (previousGroupRole === "human" && group.isError),
      })}
      // Apply hover handling to the entire container for step-by-step reasoning
      {...(isStepByStepGroup && { onMouseEnter, onMouseLeave })}
    >
      <div className="relative">
        <GroupDatetime groupId={groupId} />
        {hasMultipleMessages ? (
          <>
            <AgentName senderId={group.senderId} show={isSystemOrSingleAiMessage} />
            <CopilotMessageTitle
              key={groupIndex}
              isExpanded={isGroupExpanded}
              isExpandable={true}
              toggleDropdown={() => setIsGroupExpanded((prev) => !prev)}
              content={group.groupTitle}
              eventType={groupEventType}
              showIcon={true}
              isStepByStepInProgress={isStepByStepInProgress}
              groupIndex={groupIndex}
              isLastGroup={isLastGroup}
            />
          </>
        ) : (
          <AgentName senderId={group.senderId} show={isSystemOrSingleAiMessage} />
        )}
      </div>
      <div
        className={clsx("flex grow flex-col gap-1 relative", {
          "ml-4": hasMultipleMessages,
        })}
      >
        {displayMessages && messagesMemo}
      </div>
      {isStepByStepInProgress && (
        <div className="mt-2">
          <div
            className="loading-ellipsis relative rounded h-[32px] w-[40px]
              px-1.5 py-0.5 dark:prose-invert bg-light-50 dark:bg-dark-850"
          >
            <span className="loading-ellipsis__dot" />
            <span className="loading-ellipsis__dot" />
            <span className="loading-ellipsis__dot" />
          </div>
        </div>
      )}
      {group.isError && (
        <div className="mt-2">
          <div className="bg-[#7F1D1D33] border border-[#EF4444] rounded px-2.5 py-1 space-y-1 mt-3.5">
            <p className="font-medium">An error has occurred.</p>
            <p>
              I couldn't process your request at the moment. Would you like to try
              another question?
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export const GroupDatetime = memo((props: { groupId: string }) => {
  const datetimeState = useShallowCopilotStore((state) => state.datetimeState);
  const [debouncedState] = useDebounceValue(datetimeState, 50);

  return useMemo(() => {
    const { timestamp, targetGroupId } = debouncedState || {};
    if (targetGroupId !== props.groupId) return null;

    const formattedDateTime = dayjs(timestamp).format("MMM DD, YYYY • h:mm A");

    return (
      <div
        key={`${props.groupId}-datetime`}
        className="absolute -top-5 left-0 pointer-events-none z-10 opacity-100 transition-opacity duration-200"
      >
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formattedDateTime}
        </span>
      </div>
    );
  }, [debouncedState?.targetGroupId, debouncedState?.timestamp, props.groupId]);
});

export const AgentName = memo(
  (props: { senderId: string | undefined; show: boolean }) => {
    const externalCopilotHolders = useShallowCopilotStore(
      (copilot) => copilot.externalCopilotHolders,
    );

    const agentName = useMemo(() => {
      if (props.senderId === "openbb-copilot") return "OpenBB Copilot";
      const senderName = externalCopilotHolders
        .flatMap((holder) => holder.copilots || [])
        .find((copilot) => copilot.id === props.senderId)?.name;

      return senderName || props.senderId || undefined;
    }, [externalCopilotHolders, props.senderId]);

    return useMemo(() => {
      if (!(props.show && agentName)) return null;
      return (
        <div
          className="mb-0.5 leading-3.75 z-10 pointer-events-none
        text-brand-darker dark:text-brand-lighter whitespace-nowrap
        text-xs truncate text-ellipsis max-w-[70%]"
        >
          {agentName}
        </div>
      );
    }, [props.show, agentName]);
  },
);
