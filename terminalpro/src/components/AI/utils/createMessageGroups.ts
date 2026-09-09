import type { Message, MessageGroup } from "~/lib/state/copilot";

const isAIFCMessage = (message: Message): boolean => {
  // This is a hotfix to prevent function call messages
  // already in the database without .isHidden to be displayed
  if (message.role !== "ai") return false;
  try {
    const parsedContent = JSON.parse(message.content);
    return parsedContent?.function !== null && parsedContent?.function !== undefined;
  } catch (e) {
    return false;
  }
};

export function createMessageGroups(messages: Message[], isLoading = false) {
  const { groups, lastAiSuggestions } = messages.reduce(
    (acc, message) => {
      const isSystemMessage = message.role === "system";
      const isAiMessage = message.role === "ai" && !isAIFCMessage(message);
      const previousGroup = acc.groups[acc.groups.length - 1];
      if (
        isSystemMessage &&
        previousGroup &&
        previousGroup.role === message.role &&
        previousGroup.senderId === message.copilotId
      ) {
        previousGroup.groupTitle = message.content.message;
        previousGroup.messages.push(message);
        previousGroup.isError = previousGroup.isError || message.isError;
      } else if (message.role === "tool" || isAIFCMessage(message)) {
        // These messages will not be displayed, but we display any errors
        // in the previous group
        if (previousGroup)
          previousGroup.isError = previousGroup.isError || message.isError;
      } else {
        acc.groups.push({
          role: message.role,
          groupTitle: isSystemMessage ? message.content.message : undefined,
          messages: [message],
          isError: message.isError,
          senderId: isSystemMessage || isAiMessage ? message.copilotId : "user",
        });
      }
      if (isAiMessage && message.suggestions?.length) {
        acc.lastAiSuggestions = message.suggestions;
      }
      return acc;
    },
    { groups: [] as MessageGroup[], lastAiSuggestions: [] as string[] },
  );

  // Update group titles
  for (const [index, group] of groups.entries()) {
    const lastMessage = group.messages[group.messages.length - 1];
    const isLastGroup = index === groups.length - 1;
    const isActiveGroup = isLoading && isLastGroup;

    if (
      group.role === "system" &&
      lastMessage.role === "system" &&
      lastMessage.content.eventType === "INFO"
    ) {
      // Whether orchestration was active is snapshotted onto the message when it
      // is created during streaming, so the title is stable regardless of the
      // current global orchestration toggle.
      const wasOrchestrating = lastMessage.orchestrationModeEnabled ?? false;
      if (wasOrchestrating && lastMessage.content.message) {
        // Orchestration run: keep the per-step status message as the title
        group.groupTitle = lastMessage.content.message;
      } else if (isActiveGroup && lastMessage.content.message) {
        // Show current task message in the title while actively processing
        group.groupTitle = lastMessage.content.message;
      } else if (!(wasOrchestrating || isActiveGroup)) {
        // Completed non-orchestration reasoning: show generic title
        group.groupTitle = "Step-by-step reasoning";
      }
    }
  }

  return { groupedMessages: groups, lastAiSuggestions };
}
