import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpSuggestions } from "~/components/AI/FollowUpSuggestions";
import { createMessageGroups } from "~/components/AI/utils/createMessageGroups";
import type { AIMessage, HumanMessage, Message, SystemMessage } from "~/lib/state/copilot";

const { submitMock, streamingState } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  streamingState: { streamingStatus: "idle" as string, loading: false },
}));

vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  useCopilotContext: () => ({ handleSubmitRef: { current: submitMock } }),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: (
    selector: (s: { streamingStatus: string; loading: boolean }) => unknown,
  ) => selector(streamingState),
}));

vi.mock("~/components/Icon", () => ({
  default: () => <span data-testid="icon" />,
}));

const sysMsg = (
  message: string,
  orchestrationModeEnabled?: boolean,
  timestamp = 1,
): SystemMessage => ({
  role: "system",
  content: { eventType: "INFO", message },
  copilotId: "openbb-copilot",
  timestamp,
  orchestrationModeEnabled,
});

const aiMsg = (
  content: string,
  suggestions?: string[],
  timestamp = 1,
): AIMessage => ({
  role: "ai",
  content,
  copilotId: "openbb-copilot",
  timestamp,
  suggestions,
});

const humanMsg = (content: string, timestamp = 1): HumanMessage => ({
  role: "human",
  content,
  copilotId: "user",
  timestamp,
});

describe("createMessageGroups - reasoning title derives from per-message snapshot", () => {
  it("completed group with orchestration OFF snapshot shows generic title", () => {
    const messages: Message[] = [
      sysMsg("Analyzing your question...", false, 1),
      sysMsg("Searching widgets...", false, 2),
    ];

    const { groupedMessages } = createMessageGroups(messages, false);

    expect(groupedMessages).toHaveLength(1);
    expect(groupedMessages[0].groupTitle).toBe("Step-by-step reasoning");
  });

  it("completed group with orchestration ON snapshot keeps last dynamic status as title", () => {
    const messages: Message[] = [
      sysMsg("Analyzing your question...", true, 1),
      sysMsg("Searching widgets...", true, 2),
    ];

    const { groupedMessages } = createMessageGroups(messages, false);

    expect(groupedMessages).toHaveLength(1);
    expect(groupedMessages[0].groupTitle).toBe("Searching widgets...");
  });

  it("title does not depend on any external/global state - same input is stable", () => {
    const off: Message[] = [sysMsg("Searching widgets...", false, 1)];
    const on: Message[] = [sysMsg("Searching widgets...", true, 1)];

    // Identical messages + identical isLoading, only the per-message snapshot differs.
    expect(createMessageGroups(off, false).groupedMessages[0].groupTitle).toBe(
      "Step-by-step reasoning",
    );
    expect(createMessageGroups(on, false).groupedMessages[0].groupTitle).toBe(
      "Searching widgets...",
    );
  });

  it("active (loading) group shows dynamic status even without orchestration", () => {
    const messages: Message[] = [sysMsg("Searching widgets...", false, 1)];

    const { groupedMessages } = createMessageGroups(messages, true);

    expect(groupedMessages[0].groupTitle).toBe("Searching widgets...");
  });

  it("reloaded message without snapshot defaults to generic title when completed", () => {
    const messages: Message[] = [sysMsg("Searching widgets...", undefined, 1)];

    const { groupedMessages } = createMessageGroups(messages, false);

    expect(groupedMessages[0].groupTitle).toBe("Step-by-step reasoning");
  });

  it("last message snapshot wins within a merged group", () => {
    const messages: Message[] = [
      sysMsg("Analyzing your question...", true, 1),
      sysMsg("Searching widgets...", false, 2),
    ];

    const { groupedMessages } = createMessageGroups(messages, false);

    expect(groupedMessages).toHaveLength(1);
    expect(groupedMessages[0].groupTitle).toBe("Step-by-step reasoning");
  });
});

describe("createMessageGroups - lastAiSuggestions", () => {
  it("defaults to an empty array when no ai message carries suggestions", () => {
    const messages: Message[] = [humanMsg("Hi", 1), aiMsg("Hello there", undefined, 2)];

    const { lastAiSuggestions } = createMessageGroups(messages, false);

    expect(lastAiSuggestions).toEqual([]);
  });

  it("returns the suggestions from the only ai message that has them", () => {
    const messages: Message[] = [
      humanMsg("Hi", 1),
      aiMsg("Hello there", ["Show revenue", "What changed?"], 2),
    ];

    const { lastAiSuggestions } = createMessageGroups(messages, false);

    expect(lastAiSuggestions).toEqual(["Show revenue", "What changed?"]);
  });

  it("prefers the most recent ai message's suggestions over an earlier one's", () => {
    const messages: Message[] = [
      aiMsg("First answer", ["Old suggestion"], 1),
      humanMsg("Follow-up question", 2),
      aiMsg("Second answer", ["New suggestion"], 3),
    ];

    const { lastAiSuggestions } = createMessageGroups(messages, false);

    expect(lastAiSuggestions).toEqual(["New suggestion"]);
  });

  it("keeps the last non-empty suggestions when a later ai message has none", () => {
    const messages: Message[] = [
      aiMsg("First answer", ["Keep me"], 1),
      humanMsg("Follow-up question", 2),
      aiMsg("Second answer", undefined, 3),
    ];

    const { lastAiSuggestions } = createMessageGroups(messages, false);

    expect(lastAiSuggestions).toEqual(["Keep me"]);
  });
});

describe("FollowUpSuggestions", () => {
  beforeEach(() => {
    submitMock.mockClear();
    streamingState.streamingStatus = "idle";
    streamingState.loading = false;
  });

  it("renders each suggestion as a follow-up when idle", () => {
    render(<FollowUpSuggestions suggestions={["What changed?", "Show revenue"]} />);

    expect(screen.getByText("Follow-ups")).toBeInTheDocument();
    expect(screen.getByText("What changed?")).toBeInTheDocument();
    expect(screen.getByText("Show revenue")).toBeInTheDocument();
  });

  it("submits the clicked suggestion as a new question", () => {
    render(<FollowUpSuggestions suggestions={["Show revenue"]} />);

    fireEvent.click(screen.getByText("Show revenue"));

    expect(submitMock).toHaveBeenCalledWith({ question: "Show revenue" });
  });

  it("renders nothing when suggestions is null", () => {
    const { container } = render(<FollowUpSuggestions suggestions={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when suggestions is empty", () => {
    const { container } = render(<FollowUpSuggestions suggestions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while the assistant is streaming", () => {
    streamingState.streamingStatus = "streaming-started";
    const { container } = render(
      <FollowUpSuggestions suggestions={["Show revenue"]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while loading", () => {
    streamingState.loading = true;
    const { container } = render(
      <FollowUpSuggestions suggestions={["Show revenue"]} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
