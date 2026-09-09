import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";
import { useMemo } from "react";
import { searchChats } from "~/api/auth.api";
import {
  type AIMessage,
  type Chat,
  type HumanMessage,
  useShallowCopilotStore,
} from "~/lib/state/copilot";

export type ChatPick = Omit<Chat<HumanMessage | AIMessage>, "artifacts" | "messages">;

export type ChatMatch = ChatPick & { matchedMessage?: string };
export type SearchableChat = ChatPick & { recentMessages: string[] };

const fuseOptions: IFuseOptions<SearchableChat> = {
  keys: [
    { name: "label", weight: 3 }, // Prioritize title matches
    "recentMessages",
  ],
  includeScore: true,
  shouldSort: true,
  threshold: 0.1,
  includeMatches: true,
  minMatchCharLength: 2,
  useExtendedSearch: true,
  ignoreLocation: true,
};

/**
 * Finds the best matching message snippet for display
 */
function findMatchedMessageSnippet(
  messages: string[],
  searchQuery: string,
): string | undefined {
  const matchedTexts = searchQuery
    .split("|")
    .map((part) => part.toLowerCase().trim())
    .filter(Boolean);

  matchedTexts.push(
    ...matchedTexts.flatMap((part) =>
      part
        .split(" ")
        .map((subPart) => subPart.trim())
        .filter((subPart) => !matchedTexts.includes(subPart)),
    ),
  );

  for (const message of messages) {
    const lowerMessage = message.toLowerCase();
    const matched = matchedTexts.find((part) => lowerMessage.includes(part));
    const startIdx = matched ? lowerMessage.indexOf(matched) : -1;

    if (matched && startIdx !== -1) {
      const snippetStart = Math.max(0, startIdx - 20);
      const snippetEnd = Math.min(message.length, startIdx + matched.length + 20);
      let snippet = message.slice(snippetStart, snippetEnd).trim();

      if (startIdx > 0) snippet = `...${snippet}`;
      if (snippetEnd < message.length) snippet = `${snippet}...`;
      return snippet;
    }
  }

  return undefined;
}

export type GroupedChats = {
  today: ChatMatch[];
  yesterday: ChatMatch[];
  previous7Days: ChatMatch[];
  older: ChatMatch[];
};

/**
 * Groups chats by time periods based on lastOpened or createdAt
 */
function groupChatsByTime(chats: ChatMatch[]): GroupedChats {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - oneDayMs;
  const startOfDayBeforeYesterday = startOfYesterday - oneDayMs;
  const sevenDaysAgo = startOfToday - 7 * oneDayMs;

  const grouped: GroupedChats = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const chat of chats) {
    const timestamp = chat.lastInteraction || chat.createdAt;

    if (timestamp >= startOfToday) {
      grouped.today.push(chat);
    } else if (timestamp >= startOfYesterday) {
      grouped.yesterday.push(chat);
    } else if (timestamp >= sevenDaysAgo) {
      grouped.previous7Days.push(chat);
    } else {
      grouped.older.push(chat);
    }
  }

  return grouped;
}

export function getGroupedChats(chats: ChatMatch[]) {
  const grouped = groupChatsByTime(chats);
  return (
    [
      { key: "today", label: "Today", chats: grouped.today },
      { key: "yesterday", label: "Yesterday", chats: grouped.yesterday },
      {
        key: "previous7Days",
        label: "Previous 7 Days",
        chats: grouped.previous7Days,
      },
      { key: "older", label: "Older", chats: grouped.older },
    ] as const
  ).filter((group) => group.chats.length > 0);
}

export function useChatSearch(deferredInput: string) {
  const allChats = useShallowCopilotStore((s) => {
    const chats = s.getChatsData();

    return chats.map((c) => ({ ...c, recentMessages: [] }));
  });
  const enabled = deferredInput.length > 2;

  const { data, isLoading } = useQuery({
    queryKey: ["chatSearch", deferredInput],
    queryFn: async () => searchChats(deferredInput),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  });

  const filteredChats = useMemo(() => {
    if (enabled && !data) return [];
    if (!enabled) return allChats;
    const { searchQuery, results = [] } = data || {};

    const fuseResults = new Fuse(results, fuseOptions).search(searchQuery);

    return fuseResults.map((result) => {
      const { recentMessages, ...chat } = result.item;
      const matchedInTitle = result.matches?.some((m) => m.key === "label");
      if (matchedInTitle) return chat;

      const matchValues = result.matches?.map((m) => m.value);
      return {
        ...chat,
        matchedMessage: findMatchedMessageSnippet(
          matchValues || recentMessages,
          searchQuery,
        ),
      };
    });
  }, [enabled, data, allChats]);

  return { filteredChats, totalChats: allChats.length, isLoading };
}
