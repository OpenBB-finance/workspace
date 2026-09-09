import type { AIMessage, MessageGroup } from "~/lib/state/copilot";

export interface DatetimePositionStrategy {
  shouldShowDatetime: boolean;
  targetGroupId: string | null;
  timestamp: number;
  reason: string;
}

/**
 * Determines datetime positioning strategy based on message termination scenario.
 *
 * @param message - The AI message to determine positioning for
 * @param allGroups - Array of all message groups in the conversation
 * @param currentGroupIndex - Index of the current message group
 * @returns Strategy object containing positioning information and reasoning
 */
export function getDatetimePositionStrategy(
  message: AIMessage,
  allGroups: MessageGroup[],
  currentGroupIndex: number,
): DatetimePositionStrategy {
  // Check for step-by-step reasoning FIRST, even for cancelled messages
  const stepByStepGroup = findPrecedingStepByStepReasoning(
    allGroups,
    currentGroupIndex,
  );

  if (stepByStepGroup) {
    return {
      shouldShowDatetime: true,
      targetGroupId: `group-${stepByStepGroup.index}`,
      timestamp: stepByStepGroup.timestamp,
      reason: message.isCancelled
        ? "cancelled_message_above_step_by_step"
        : "completed_message_above_step_by_step",
    };
  }

  // Normal completion scenario: show above AI message for all content
  if (message.content) {
    return {
      shouldShowDatetime: true,
      targetGroupId: `group-${currentGroupIndex}`,
      timestamp: message.timestamp,
      reason: "normal_completion_above_ai_message",
    };
  }

  // Default fallback for no content
  return {
    shouldShowDatetime: false,
    targetGroupId: null,
    timestamp: message.timestamp,
    reason: "no_datetime_needed",
  };
}

/**
 * Finds step-by-step reasoning group that precedes the current AI message.
 * Only considers step-by-step reasoning that immediately precedes the AI message.
 *
 * @param allGroups - Array of all message groups in the conversation
 * @param currentGroupIndex - Index of the current message group
 * @returns Object with index and timestamp of the preceding step-by-step group, or null if not found
 */
function findPrecedingStepByStepReasoning(
  allGroups: MessageGroup[],
  currentGroupIndex: number,
): { index: number; timestamp: number } | null {
  // Only look at the immediately preceding group or one group before that
  // This prevents associating old step-by-step reasoning with new AI messages
  const maxLookback = 2;
  const searchStart = Math.max(0, currentGroupIndex - maxLookback);

  for (let i = currentGroupIndex - 1; i >= searchStart; i--) {
    const candidateGroup = allGroups[i];

    if (
      candidateGroup &&
      candidateGroup.role === "system" &&
      (candidateGroup.groupTitle === "Step-by-step reasoning" ||
        candidateGroup.groupTitle?.includes("Step-by-step") ||
        // In orchestrator mode, system groups have different titles but should still be considered
        (candidateGroup.groupTitle && candidateGroup.groupTitle.length > 0)) &&
      candidateGroup.messages.length > 0
    ) {
      // Additional check: ensure there's no other AI message between this step-by-step and current message
      const hasIntermediateAI = allGroups
        .slice(i + 1, currentGroupIndex)
        .some((group) => group.role === "ai");

      if (hasIntermediateAI) {
        continue;
      }

      return {
        index: i,
        timestamp: candidateGroup.messages[0].timestamp,
      };
    }
  }

  return null;
}

/**
 * Enhanced version of datetime positioning strategy that handles additional edge cases.
 *
 * @param message - The AI message to determine positioning for
 * @param allGroups - Array of all message groups in the conversation
 * @param currentGroupIndex - Index of the current message group
 * @param isStreaming - Whether the message is currently being streamed (default: false)
 * @returns Enhanced strategy object with additional edge case handling
 */
export function getEnhancedDatetimePositionStrategy(
  message: AIMessage,
  allGroups: MessageGroup[],
  currentGroupIndex: number,
  isStreaming = false,
): DatetimePositionStrategy {
  const baseStrategy = getDatetimePositionStrategy(
    message,
    allGroups,
    currentGroupIndex,
  );

  // Handle streaming scenario
  if (isStreaming) {
    return {
      ...baseStrategy,
      reason: `${baseStrategy.reason}_during_streaming`,
    };
  }

  // Handle empty or null message content
  if (!message.content || message.content === null) {
    // Check if base strategy already found step-by-step reasoning - if so, use that instead
    if (
      baseStrategy.shouldShowDatetime &&
      baseStrategy.reason.includes("step_by_step")
    ) {
      return baseStrategy;
    }

    const targetId = `group-${currentGroupIndex}`;
    return {
      shouldShowDatetime: true,
      targetGroupId: targetId,
      timestamp: message.timestamp,
      reason: "empty_content_above_message",
    };
  }

  // Handle artifact-only responses (no text content)
  if (hasOnlyArtifacts(message.content) && !message.isCancelled) {
    const stepByStepGroup = findPrecedingStepByStepReasoning(
      allGroups,
      currentGroupIndex,
    );

    if (stepByStepGroup) {
      return {
        shouldShowDatetime: true,
        targetGroupId: `group-${stepByStepGroup.index}`,
        timestamp: stepByStepGroup.timestamp,
        reason: "artifact_only_above_reasoning",
      };
    }
  }

  return baseStrategy;
}

/**
 * Checks if message content contains only artifacts and no meaningful text.
 *
 * @param content - The message content to analyze
 * @returns True if content contains only artifacts with minimal text (< 10 chars)
 */
function hasOnlyArtifacts(content: string): boolean {
  if (!content) return false;

  // Remove artifact tags and check if remaining content is meaningful
  const withoutArtifacts = content
    .replace(/<artifact[^>]*>.*?<\/artifact>/gs, "")
    .replace(/<artifact[^>]*\/>/g, "")
    .trim();

  return withoutArtifacts.length < 10;
}
