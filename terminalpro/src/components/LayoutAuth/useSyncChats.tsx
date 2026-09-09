import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { useCallback, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import { type PostUserChats, postUserChats } from "~/api/auth.api";
import { useShallowStreamingStore } from "~/components/AI/hooks/useStreaming";
import { type Chat, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { uuidv4 } from "~/lib/utils/utils";

export default function useSyncChats() {
  const [chats, remoteChats] = useShallowCopilotStore((state) => [
    state.chats,
    state.chatsStoredInCloud,
  ]);
  const updateRemoteChats = useShallowCopilotStore(
    (state) => state.updateChatsStoredInCloud,
  );
  const setUsage = useShallowFeatureFlagsStore((state) => state.setUsage);
  const isStreaming = useShallowStreamingStore(
    (s) => s.loading || s.streamingStatus === "streaming-started",
  );

  const saveChats = useCallback(async (currentChats: Chat[], previousChats: Chat[]) => {
    if (currentChats?.length === 0) return;
    try {
      const diff = diffChatsWithRemote(currentChats, previousChats);
      if (import.meta.env.DEV) console.log(diff);
      if (Object.keys(diff).length > 0) {
        const { status, usage } = await postUserChats(diff);
        if (status === 200) {
          updateRemoteChats(currentChats);

          if (usage) setUsage(usage);
        }
      }
    } catch (_) {}
  }, []);

  const saveChatsDebounced = useDebouncedCallback(saveChats, 5 * 1000, {
    trailing: true,
    maxWait: 3 * 1000,
  });

  useEffect(() => {
    saveChatsDebounced.cancel();
    if (isStreaming) return;

    saveChatsDebounced(cloneDeep(chats), remoteChats);
  }, [saveChatsDebounced, chats, isStreaming]);

  useEffect(() => {
    return () => {
      saveChatsDebounced.flush();
    };
  }, []);
}

const prepareChats = (chats: Chat[]) => {
  return chats.reduce(
    (acc, chat) => {
      const messages = chat.messages?.reduce(
        (acc, msg) => {
          msg.uuid = msg.uuid || uuidv4();
          acc[msg.uuid] = msg;
          return acc;
        },
        {} as Record<string, Chat["messages"][number]>,
      );
      acc[chat.uuid] = { ...chat, messages };
      return acc;
    },
    {} as Record<
      string,
      Omit<Chat, "messages"> & {
        messages: Record<string, Chat["messages"][number]>;
      }
    >,
  );
};

export const diffChatsWithRemote = (
  currentChats: Chat[],
  remoteChats: Chat[] | null,
  _shouldLog = true,
): PostUserChats => {
  if (!remoteChats) return {};
  if (!currentChats?.length) throw new Error("Current state is empty");
  const diff = {};

  const current = prepareChats(currentChats);
  const remote = prepareChats(remoteChats);

  // Iterate over each item in the current state
  for (const [key, value] of Object.entries(current)) {
    // If the item doesn't exist in the remote state or is different, add it to the diff
    const msgUuids = Object.keys(value?.messages || {});
    const lastMessage = value?.messages?.[msgUuids[msgUuids.length - 1]];
    if (lastMessage?.role === "ai" && lastMessage?.content === "") continue;

    if (!(remote[key] && isEqual(value, remote[key]))) {
      const messagesDiff = {};
      const remoteUuids = new Set(Object.keys(remote[key]?.messages || {}));

      for (const [uuid, msg] of Object.entries(value?.messages || {})) {
        const remoteMsg = remote[key]?.messages?.[uuid];
        if (!(remoteMsg && isEqual(msg, remoteMsg))) {
          messagesDiff[uuid] = msg;
          remoteUuids.delete(uuid);
        }
      }

      // check deleted messages
      for (const uuid of remoteUuids) {
        if (!value?.messages?.[uuid]) messagesDiff[uuid] = "DELETE";
      }

      diff[key] = { ...value, messages: messagesDiff };
    }
  }

  for (const key of Object.keys(remote)) {
    // If the item doesn't exist in the current state, mark it as "DELETE" in the diff
    if (!current[key]) {
      diff[key] = "DELETE";
    }
  }

  return diff;
};
