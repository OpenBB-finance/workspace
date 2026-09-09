import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchChats } from "~/api/auth.api";
import { useChatSearch } from "~/components/AI/hooks/useChatSearch";
import { type Chat, useCopilotStore } from "~/lib/state/copilot";

vi.mock("~/api/auth.api", () => ({
  searchChats: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const chatA: Chat = {
  uuid: "chat-a",
  createdAt: 1000,
  label: "Weekend Trip",
  messages: [],
  lastInteraction: 1000,
  agentIds: [],
};

const chatB: Chat = {
  uuid: "chat-b",
  createdAt: 2000,
  label: "Budget Review",
  messages: [],
  lastInteraction: 2000,
  agentIds: [],
};

describe("useChatSearch", () => {
  beforeEach(() => {
    vi.mocked(searchChats).mockReset();
    useCopilotStore.setState({ chats: [chatA, chatB] });
  });

  it("returns all chats without querying the server when input is too short", () => {
    const { result } = renderHook(() => useChatSearch("ab"), {
      wrapper: createWrapper(),
    });

    expect(searchChats).not.toHaveBeenCalled();
    expect(result.current.totalChats).toBe(2);
    expect(result.current.filteredChats.map((c) => c.uuid)).toEqual([
      "chat-a",
      "chat-b",
    ]);
  });

  it("returns an empty result set while a search is in flight", () => {
    vi.mocked(searchChats).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useChatSearch("budget"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.filteredChats).toEqual([]);
  });

  it("queries the server with the raw input and returns fuzzy-matched results", async () => {
    vi.mocked(searchChats).mockResolvedValue({
      searchQuery: "budget",
      results: [
        {
          uuid: "chat-b",
          createdAt: 2000,
          label: "Budget Review",
          lastInteraction: 2000,
          recentMessages: ["We need to finalize the quarterly budget numbers"],
        },
      ],
    });

    const { result } = renderHook(() => useChatSearch("budget"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(searchChats).toHaveBeenCalledWith("budget");
    expect(result.current.filteredChats).toHaveLength(1);
    expect(result.current.filteredChats[0].uuid).toBe("chat-b");
  });

  it("skips the matched message snippet when the match is in the chat title", async () => {
    vi.mocked(searchChats).mockResolvedValue({
      searchQuery: "weekend",
      results: [
        {
          uuid: "chat-a",
          createdAt: 1000,
          label: "Weekend Trip",
          lastInteraction: 1000,
          recentMessages: ["unrelated content"],
        },
      ],
    });

    const { result } = renderHook(() => useChatSearch("weekend"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.filteredChats[0]).not.toHaveProperty("matchedMessage");
  });

  it("keeps totalChats reflecting the full chat list regardless of the active search", async () => {
    vi.mocked(searchChats).mockResolvedValue({ searchQuery: "budget", results: [] });

    const { result } = renderHook(() => useChatSearch("budget"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalChats).toBe(2);
  });
});
