import { describe, expect, it, vi } from "vitest";
import { diffChatsWithRemote } from "~/components/LayoutAuth/useSyncChats";
import type { Chat, Message } from "~/lib/state/copilot";

vi.mock("uuid", () => ({ v4: () => "generated-uuid" }));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    role: "human",
    content: "hello",
    timestamp: 1,
    copilotId: "openbb-copilot",
    uuid: "msg-1",
    ...overrides,
  } as Message;
}

function makeChat(overrides: Partial<Chat> = {}): Chat {
  return {
    uuid: "chat-1",
    createdAt: 1000,
    label: "Test Chat",
    messages: [],
    ...overrides,
  };
}

describe("diffChatsWithRemote", () => {
  it("returns an empty diff when there are no remote chats yet", () => {
    const chat = makeChat();
    expect(diffChatsWithRemote([chat], null)).toEqual({});
  });

  it("throws when the current state is empty but remote chats exist", () => {
    const remoteChat = makeChat();
    expect(() => diffChatsWithRemote([], [remoteChat])).toThrow(
      "Current state is empty",
    );
  });

  it("returns an empty diff when current and remote chats are identical", () => {
    const chat = makeChat({ messages: [makeMessage()] });
    const remote = structuredClone(chat);

    expect(diffChatsWithRemote([chat], [remote])).toEqual({});
  });

  it("only includes messages that changed, not unchanged ones", () => {
    const unchanged = makeMessage({ uuid: "msg-1", content: "unchanged" });
    const changed = makeMessage({ uuid: "msg-2", content: "original" });
    const remote = makeChat({ messages: [unchanged, changed] });

    const editedMessage = makeMessage({ uuid: "msg-2", content: "edited" });
    const current = makeChat({ messages: [unchanged, editedMessage] });

    const diff = diffChatsWithRemote([current], [remote]);

    expect(diff["chat-1"]).toEqual({
      ...current,
      messages: { "msg-2": editedMessage },
    });
  });

  it("marks messages removed locally as DELETE in the diff", () => {
    const kept = makeMessage({ uuid: "msg-1" });
    const removed = makeMessage({ uuid: "msg-2", content: "bye" });
    const remote = makeChat({ messages: [kept, removed] });

    const current = makeChat({ messages: [kept] });

    const diff = diffChatsWithRemote([current], [remote]);

    expect(diff["chat-1"]).toEqual({
      ...current,
      messages: { "msg-2": "DELETE" },
    });
  });

  it("skips a chat entirely while its last message is an empty in-progress AI reply", () => {
    const human = makeMessage({ uuid: "msg-1", role: "human", content: "question" });
    const streamingAi = makeMessage({
      uuid: "msg-2",
      role: "ai",
      content: "",
    });
    const remote = makeChat({ messages: [human] });
    const current = makeChat({ messages: [human, streamingAi] });

    expect(diffChatsWithRemote([current], [remote])).toEqual({});
  });

  it("marks an entire chat as DELETE when it no longer exists locally", () => {
    const remoteOnly = makeChat({ uuid: "chat-2" });
    const stillPresent = makeChat({ uuid: "chat-1" });

    const diff = diffChatsWithRemote([stillPresent], [stillPresent, remoteOnly]);

    expect(diff["chat-2"]).toBe("DELETE");
    expect(diff["chat-1"]).toBeUndefined();
  });

  it("assigns a uuid to messages that don't have one yet", () => {
    const messageWithoutUuid = makeMessage({ uuid: undefined, content: "new" });
    const current = makeChat({ messages: [messageWithoutUuid] });

    const diff = diffChatsWithRemote([current], [makeChat({ messages: [] })]);

    expect(diff["chat-1"].messages).toEqual({ "generated-uuid": messageWithoutUuid });
  });
});
