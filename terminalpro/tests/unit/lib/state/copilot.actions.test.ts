import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCopilotChat } from "~/api/auth.api";
import {
  type AIMessage,
  type ArtifactT,
  type Chat,
  type Copilot,
  type ExternalCopilotHolder,
  type HumanMessage,
  useCopilotStore,
} from "~/lib/state/copilot";

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

// Mock the external API call
vi.mock("~/api/auth.api", () => ({
  getExternalCopilotHolders: vi.fn((_, callback) => callback([])),
  getCopilotChat: vi.fn(),
}));

// Mock deprecated flags toast
vi.mock("~/components/AI/hooks/utils", () => ({
  showDeprecatedFlagsToast: vi.fn(),
}));

describe("useCopilotStore - Actions", () => {
  const mockChat: Chat = {
    uuid: "chat-1",
    createdAt: 1000,
    label: "Test Chat",
    messages: [],
    lastOpened: 1000,
    agentIds: ["openbb-copilot"],
  };

  const mockHumanMessage: HumanMessage = {
    role: "human",
    content: "Hello",
    timestamp: 2000,
    copilotId: "openbb-copilot",
  };

  const mockAIMessage: AIMessage = {
    role: "ai",
    content: "Hi there!",
    timestamp: 2001,
    copilotId: "openbb-copilot",
  };

  beforeEach(() => {
    useCopilotStore.setState({
      chats: [mockChat],
      currentChat: mockChat.createdAt,
      questionsHistory: [],
      actionHistory: [],
      isTyping: false,
      selectedModelByAgent: { "openbb-copilot": "gpt-4" },
      selectedCopilot: null,
      externalCopilotHolders: [],
      orchestrationModeEnabled: false,
      agentOrchestrationMap: {},
      copilotTextSuggestions: [],
      showWelcome: true,
      isFullscreen: false,
      lastPanelState: "open",
      isButtonTriggered: false,
      isIntentionallyCollapsed: false,
      datetimeState: null,
      customFeatureStates: {},
      hoveredCitationWidgetId: null,
      hoveredTabId: null,
      chatsStoredInCloud: null,
    });
  });

  describe("setExternalCopilotHolders auto-selection", () => {
    const ritaHolder = {
      uuid: "holder-rita",
      url: "https://rita.example.com",
      enabled: true,
      copilots: [{ id: "rita", name: "Agent Rita" }],
    } as unknown as ExternalCopilotHolder;

    it("auto-selects the first available agent when none is selected (lite)", () => {
      useCopilotStore.setState({ selectedCopilot: null, externalCopilotHolders: [] });

      useCopilotStore.getState().setExternalCopilotHolders([ritaHolder]);

      expect(useCopilotStore.getState().selectedCopilot?.id).toBe("rita");
    });

    it("keeps a still-valid current selection", () => {
      useCopilotStore.setState({
        selectedCopilot: { id: "rita", name: "Agent Rita" } as Copilot,
        externalCopilotHolders: [],
      });

      useCopilotStore.getState().setExternalCopilotHolders([ritaHolder]);

      expect(useCopilotStore.getState().selectedCopilot?.id).toBe("rita");
    });

    it("preserves the built-in OpenBB copilot selection", () => {
      useCopilotStore.setState({
        selectedCopilot: { id: "openbb-copilot" } as Copilot,
        externalCopilotHolders: [],
      });

      useCopilotStore.getState().setExternalCopilotHolders([ritaHolder]);

      expect(useCopilotStore.getState().selectedCopilot?.id).toBe("openbb-copilot");
    });

    it("leaves selection null when there are no agents", () => {
      useCopilotStore.setState({ selectedCopilot: null, externalCopilotHolders: [] });

      useCopilotStore.getState().setExternalCopilotHolders([]);

      expect(useCopilotStore.getState().selectedCopilot).toBeNull();
    });
  });

  describe("Action History", () => {
    it("adds actions to history", () => {
      const { addAction } = useCopilotStore.getState();
      addAction("created widget");
      addAction("opened dashboard");

      expect(useCopilotStore.getState().actionHistory).toEqual([
        "created widget",
        "opened dashboard",
      ]);
    });

    it("keeps only last 5 actions", () => {
      const { addAction } = useCopilotStore.getState();
      for (let i = 0; i < 7; i++) {
        addAction(`action-${i}`);
      }

      const history = useCopilotStore.getState().actionHistory;
      expect(history).toHaveLength(5);
      expect(history[0]).toBe("action-2");
      expect(history[4]).toBe("action-6");
    });

    it("clears action history", () => {
      const { addAction, clearActionHistory } = useCopilotStore.getState();
      addAction("test");
      clearActionHistory();

      expect(useCopilotStore.getState().actionHistory).toEqual([]);
    });
  });

  describe("Chat Management", () => {
    it("adds a new chat", () => {
      const { addChat } = useCopilotStore.getState();
      const newChat: Chat = {
        uuid: "chat-2",
        createdAt: 2000,
        label: "New Chat",
        messages: [],
        agentIds: [],
      };

      addChat(newChat);

      expect(useCopilotStore.getState().chats).toHaveLength(2);
    });

    it("removes a chat", () => {
      const { removeChat } = useCopilotStore.getState();
      removeChat(mockChat.createdAt);

      expect(useCopilotStore.getState().chats).toHaveLength(0);
    });

    it("gets current chat", () => {
      const { getCurrentChat } = useCopilotStore.getState();
      const chat = getCurrentChat();

      expect(chat.uuid).toBe("chat-1");
    });

    it("sets current chat", () => {
      const newChat: Chat = {
        uuid: "chat-2",
        createdAt: 3000,
        label: "New Chat",
        messages: [],
        agentIds: [],
      };
      useCopilotStore.setState({
        chats: [mockChat, newChat],
      });

      const { setCurrentChat } = useCopilotStore.getState();
      setCurrentChat(3000);

      expect(useCopilotStore.getState().currentChat).toBe(3000);
    });

    it("updates chat label", () => {
      const { updateCopilotLabel } = useCopilotStore.getState();
      updateCopilotLabel(mockChat.createdAt, "Updated Label");

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.label).toBe("Updated Label");
    });

    it("resets chats to default", () => {
      const { resetChats } = useCopilotStore.getState();
      resetChats();

      const state = useCopilotStore.getState();
      expect(state.chats).toHaveLength(1);
      expect(state.chats[0].label).toBe("New chat");
    });
  });

  describe("Lazy Chat Loading", () => {
    beforeEach(() => {
      vi.mocked(getCopilotChat).mockReset();
    });

    it("fetches chat data from the server when messages haven't been loaded yet", async () => {
      const fetchedChat: Chat = {
        uuid: "chat-1",
        createdAt: 1721284317112,
        label: "Test Chat",
        messages: [mockHumanMessage],
        lastOpened: 1721284317112,
        agentIds: ["openbb-copilot"],
      };
      vi.mocked(getCopilotChat).mockResolvedValue(fetchedChat);

      useCopilotStore.setState({
        // simulating a chat list entry that hasn't loaded its messages yet
        chats: [{ ...mockChat, messages: undefined }],
      });

      await useCopilotStore.getState().loadChatData("chat-1");

      expect(getCopilotChat).toHaveBeenCalledWith("chat-1");
      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages).toEqual([mockHumanMessage]);
      expect(useCopilotStore.getState().currentChat).toBe(1721284317112);
    });

    it("does not re-fetch and just switches chats when messages are already loaded", async () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage] }],
        currentChat: 0,
      });

      await useCopilotStore.getState().loadChatData("chat-1");

      expect(getCopilotChat).not.toHaveBeenCalled();
      expect(useCopilotStore.getState().currentChat).toBe(1000);
    });

    it("does nothing when the chat uuid isn't found", async () => {
      await useCopilotStore.getState().loadChatData("missing-uuid");

      expect(getCopilotChat).not.toHaveBeenCalled();
      expect(useCopilotStore.getState().chats).toEqual([mockChat]);
    });

    it("keeps the previous chat selected when the fetch returns nothing", async () => {
      vi.mocked(getCopilotChat).mockResolvedValue(null);

      useCopilotStore.setState({
        // simulating a chat list entry that hasn't loaded its messages yet
        chats: [{ ...mockChat, messages: undefined }],
        currentChat: 0,
      });

      await useCopilotStore.getState().loadChatData("chat-1");

      expect(useCopilotStore.getState().currentChat).toBe(1000);
    });

    it("setCurrentChat(0) loads the most recently opened chat's data", async () => {
      const olderChat: Chat = {
        uuid: "chat-older",
        createdAt: 500,
        label: "Older Chat",
        messages: [mockHumanMessage],
        lastOpened: 500,
        agentIds: [],
      };
      const recentChat: Chat = {
        uuid: "chat-recent",
        createdAt: 2000,
        label: "Recent Chat",
        messages: [mockHumanMessage],
        lastOpened: 5000,
        agentIds: [],
      };
      useCopilotStore.setState({ chats: [olderChat, recentChat], currentChat: 0 });

      await useCopilotStore.getState().setCurrentChat(0);

      expect(useCopilotStore.getState().currentChat).toBe(2000);
    });
  });

  describe("Message Management", () => {
    it("adds a message to current chat", () => {
      const { addMessage } = useCopilotStore.getState();
      addMessage(mockHumanMessage);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages).toHaveLength(1);
      // @ts-expect-error - ignored for now
      expect(chat.messages[0].content).toBe("Hello");
    });

    it("adds human message to questions history", () => {
      const { addMessage } = useCopilotStore.getState();
      addMessage(mockHumanMessage);

      expect(useCopilotStore.getState().questionsHistory).toContain("Hello");
    });

    it("assigns a uuid to a message that doesn't already have one", () => {
      const { addMessage } = useCopilotStore.getState();
      addMessage({ ...mockHumanMessage, uuid: undefined });

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages[0].uuid).toBe("test-uuid-1234");
    });

    it("keeps an existing message uuid instead of overwriting it", () => {
      const { addMessage } = useCopilotStore.getState();
      addMessage({ ...mockHumanMessage, uuid: "existing-uuid" });

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages[0].uuid).toBe("existing-uuid");
    });

    it("removes messages by timestamps", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { removeMessages } = useCopilotStore.getState();
      removeMessages([mockHumanMessage.timestamp]);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages).toHaveLength(1);
      expect(chat.messages[0].role).toBe("ai");
    });

    it("removes artifacts that are no longer reachable after removing messages", () => {
      const orphanedArtifact: ArtifactT = {
        uuid: "art-orphan",
        type: "text",
        content: "orphaned",
      };
      const referencedArtifact: ArtifactT = {
        uuid: "art-kept",
        type: "text",
        content: "kept",
      };
      const aiWithOrphanRef: AIMessage = {
        role: "ai",
        content: "here is art-orphan",
        timestamp: 3000,
        copilotId: "openbb-copilot",
      };
      const aiWithKeptRef: AIMessage = {
        role: "ai",
        content: "here is art-kept",
        timestamp: 4000,
        copilotId: "openbb-copilot",
      };
      useCopilotStore.setState({
        chats: [
          {
            ...mockChat,
            messages: [aiWithOrphanRef, aiWithKeptRef],
            artifacts: [orphanedArtifact, referencedArtifact],
          },
        ],
      });

      const { removeMessages } = useCopilotStore.getState();
      removeMessages([aiWithOrphanRef.timestamp]);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages).toHaveLength(1);
      expect(chat.artifacts).toEqual([referencedArtifact]);
    });

    it("updates last AI message", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { updateLastMessage } = useCopilotStore.getState();
      updateLastMessage({ content: "Updated content", voteStatus: "thumbs_up" });

      const chat = useCopilotStore.getState().chats[0];
      const lastMsg = chat.messages[1] as AIMessage;
      expect(lastMsg.content).toBe("Updated content");
      expect(lastMsg.voteStatus).toBe("thumbs_up");
    });

    it("updates specific AI message property", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { updateAIMessage } = useCopilotStore.getState();
      updateAIMessage("voteStatus", "thumbs_down", mockAIMessage.timestamp);

      const chat = useCopilotStore.getState().chats[0];
      const aiMsg = chat.messages[1] as AIMessage;
      expect(aiMsg.voteStatus).toBe("thumbs_down");
    });

    it("sets last message error state", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockAIMessage] }],
      });

      const { updateLastMessageError } = useCopilotStore.getState();
      updateLastMessageError(true);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages[0].isError).toBe(true);
    });

    it("makes last message a function call", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockAIMessage] }],
      });

      const { makeLastMessageFC } = useCopilotStore.getState();
      makeLastMessageFC();

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages[0].isFC).toBe(true);
    });

    it("gets message by timestamp", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { getMessageByTimestamp } = useCopilotStore.getState();
      const msg = getMessageByTimestamp(mockHumanMessage.timestamp);

      expect(msg?.content).toBe("Hello");
    });

    it("resets content for current chat", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { resetContent } = useCopilotStore.getState();
      resetContent();

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.messages).toHaveLength(0);
    });
  });

  describe("Typing State", () => {
    it("sets typing state", () => {
      const { setIsTyping } = useCopilotStore.getState();
      setIsTyping(true);

      expect(useCopilotStore.getState().isTyping).toBe(true);
    });

    it("toggles typing state", () => {
      const { toggleTyping } = useCopilotStore.getState();
      toggleTyping();

      expect(useCopilotStore.getState().isTyping).toBe(true);

      toggleTyping();
      expect(useCopilotStore.getState().isTyping).toBe(false);
    });
  });

  describe("Model Selection", () => {
    it("sets selected model for agent", () => {
      const { setSelectedModelForAgent } = useCopilotStore.getState();
      setSelectedModelForAgent("openbb-copilot", "gpt-3.5-turbo");

      expect(useCopilotStore.getState().selectedModelByAgent["openbb-copilot"]).toBe(
        "gpt-3.5-turbo",
      );
    });
  });

  describe("Copilot Suggestions", () => {
    it("sets copilot text suggestions", () => {
      const { setCopilotTextSuggestions } = useCopilotStore.getState();
      const suggestions = [{ question: "What is AI?", matchCount: 5, idsLength: 3 }];

      setCopilotTextSuggestions(suggestions);

      expect(useCopilotStore.getState().copilotTextSuggestions).toEqual(suggestions);
    });
  });

  describe("Orchestration Mode", () => {
    it("enables orchestration mode", () => {
      const { setOrchestrationModeEnabled } = useCopilotStore.getState();
      setOrchestrationModeEnabled(true);

      expect(useCopilotStore.getState().orchestrationModeEnabled).toBe(true);
    });

    it("enables agent orchestration", () => {
      const { enableAgentOrchestration } = useCopilotStore.getState();
      enableAgentOrchestration("holder-1", "agent-1");

      expect(useCopilotStore.getState().agentOrchestrationMap).toEqual({
        "holder-1": ["agent-1"],
      });
    });

    it("disables agent orchestration", () => {
      useCopilotStore.setState({
        agentOrchestrationMap: { "holder-1": ["agent-1", "agent-2"] },
      });

      const { disableAgentOrchestration } = useCopilotStore.getState();
      disableAgentOrchestration("holder-1", "agent-1");

      expect(useCopilotStore.getState().agentOrchestrationMap).toEqual({
        "holder-1": ["agent-2"],
      });
    });

    it("toggles agent orchestration", () => {
      const { toggleAgentOrchestration } = useCopilotStore.getState();

      toggleAgentOrchestration("holder-1", "agent-1");
      expect(useCopilotStore.getState().agentOrchestrationMap["holder-1"]).toContain(
        "agent-1",
      );

      toggleAgentOrchestration("holder-1", "agent-1");
      expect(
        useCopilotStore.getState().agentOrchestrationMap["holder-1"],
      ).not.toContain("agent-1");
    });

    it("clears agent orchestration map", () => {
      useCopilotStore.setState({
        agentOrchestrationMap: { "holder-1": ["agent-1"] },
      });

      const { clearAgentOrchestrationMap } = useCopilotStore.getState();
      clearAgentOrchestrationMap();

      expect(useCopilotStore.getState().agentOrchestrationMap).toEqual({});
    });
  });

  describe("External Copilot Holders", () => {
    it("sets external copilot holders", () => {
      const { setExternalCopilotHolders } = useCopilotStore.getState();
      const holders = [
        { uuid: "h1", url: "http://example.com", headers: {}, copilots: [] },
      ];

      setExternalCopilotHolders(holders);

      expect(useCopilotStore.getState().externalCopilotHolders).toHaveLength(1);
    });

    it("deduplicates holders by URL", () => {
      const { setExternalCopilotHolders } = useCopilotStore.getState();
      const holders = [
        { uuid: "h1", url: "http://example.com", headers: {} },
        { uuid: "h2", url: "http://example.com", headers: {} },
      ];

      setExternalCopilotHolders(holders);

      expect(useCopilotStore.getState().externalCopilotHolders).toHaveLength(1);
    });
  });

  describe("UI State", () => {
    it("sets show welcome", () => {
      const { setShowWelcome } = useCopilotStore.getState();
      setShowWelcome(false);

      expect(useCopilotStore.getState().showWelcome).toBe(false);
    });

    it("sets fullscreen mode", () => {
      const { setIsFullscreen } = useCopilotStore.getState();
      setIsFullscreen(true);

      expect(useCopilotStore.getState().isFullscreen).toBe(true);
    });

    it("toggles fullscreen", () => {
      const { toggleFullscreen } = useCopilotStore.getState();
      toggleFullscreen();

      expect(useCopilotStore.getState().isFullscreen).toBe(true);
    });

    it("sets hovered citation widget id", () => {
      const { setHoveredCitationWidgetId } = useCopilotStore.getState();
      setHoveredCitationWidgetId("widget-123");

      expect(useCopilotStore.getState().hoveredCitationWidgetId).toBe("widget-123");
    });

    it("sets hovered tab id", () => {
      const { setHoveredTabId } = useCopilotStore.getState();
      setHoveredTabId("tab-1");

      expect(useCopilotStore.getState().hoveredTabId).toBe("tab-1");
    });

    it("shows datetime state", () => {
      const { showDatetime } = useCopilotStore.getState();
      showDatetime(1234567890, "group-1");

      expect(useCopilotStore.getState().datetimeState).toEqual({
        timestamp: 1234567890,
        targetGroupId: "group-1",
      });
    });

    it("hides datetime state", () => {
      useCopilotStore.setState({
        datetimeState: { timestamp: 123, targetGroupId: "g1" },
      });

      const { hideDatetime } = useCopilotStore.getState();
      hideDatetime();

      expect(useCopilotStore.getState().datetimeState).toBeNull();
    });
  });

  describe("Title Management", () => {
    it("sets title manually updated", () => {
      const { setTitleManuallyUpdated } = useCopilotStore.getState();
      setTitleManuallyUpdated(mockChat.createdAt, true);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.titleManuallyUpdated).toBe(true);
    });

    it("sets title needs update", () => {
      const { setTitleNeedsUpdate } = useCopilotStore.getState();
      setTitleNeedsUpdate(mockChat.createdAt, false);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.titleNeedsUpdate).toBe(false);
    });

    it("updates label and title needs update together", () => {
      const { updateCopilotLabelAndSetTitleNeedsUpdate } = useCopilotStore.getState();
      updateCopilotLabelAndSetTitleNeedsUpdate("New Label", false);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.label).toBe("New Label");
      expect(chat.titleNeedsUpdate).toBe(false);
    });
  });

  describe("Artifacts", () => {
    it("adds artifact to current chat", () => {
      const { addArtifactToCurrentChat } = useCopilotStore.getState();
      const artifact: ArtifactT = {
        uuid: "art-1",
        type: "text",
        content: "Test content",
      };

      addArtifactToCurrentChat(artifact);

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.artifacts).toHaveLength(1);
    });

    it("gets current chat artifact by id", () => {
      const artifact: ArtifactT = {
        uuid: "art-1",
        name: "Chart 1",
        type: "text",
        content: "Test",
      };
      useCopilotStore.setState({
        chats: [{ ...mockChat, artifacts: [artifact] }],
      });

      const { getCurrentChatArtifact } = useCopilotStore.getState();
      const result = getCurrentChatArtifact("Chart 1");

      expect(result?.uuid).toBe("art-1");
    });

    it("gets all current chat artifacts", () => {
      const artifacts: ArtifactT[] = [
        { uuid: "a1", type: "text", content: "t1" },
        { uuid: "a2", type: "text", content: "t2" },
      ];
      useCopilotStore.setState({
        chats: [{ ...mockChat, artifacts }],
      });

      const { getCurrentChatArtifacts } = useCopilotStore.getState();
      const result = getCurrentChatArtifacts();

      expect(result).toHaveLength(2);
    });

    it("excludes messages and artifacts from getChatsData", () => {
      const artifact: ArtifactT = { uuid: "art-1", type: "text", content: "t1" };
      useCopilotStore.setState({
        chats: [
          { ...mockChat, messages: [mockHumanMessage], artifacts: [artifact] },
        ],
      });

      const { getChatsData } = useCopilotStore.getState();
      const [chatData] = getChatsData();

      expect(chatData).not.toHaveProperty("messages");
      expect(chatData).not.toHaveProperty("artifacts");
      expect(chatData.uuid).toBe("chat-1");
    });

    it("removes unreachable artifacts", () => {
      const artifact1: ArtifactT = { uuid: "art-1", type: "text", content: "t1" };
      const artifact2: ArtifactT = { uuid: "art-2", type: "text", content: "t2" };
      const aiMsg: AIMessage = {
        role: "ai",
        content: "Here is art-1",
        timestamp: 1,
        copilotId: "test",
      };

      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [aiMsg], artifacts: [artifact1, artifact2] }],
      });

      const { removeUnreachableArtifacts } = useCopilotStore.getState();
      removeUnreachableArtifacts();

      const chat = useCopilotStore.getState().chats[0];
      expect(chat.artifacts).toHaveLength(1);
      expect(chat.artifacts?.[0].uuid).toBe("art-1");
    });
  });

  describe("User Prompt Retrieval", () => {
    it("gets user prompt for AI message", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockHumanMessage, mockAIMessage] }],
      });

      const { getUserPromptForAIMessage } = useCopilotStore.getState();
      const prompt = getUserPromptForAIMessage(mockAIMessage);

      expect(prompt).toBe("Hello");
    });

    it("returns undefined if no human message before AI message", () => {
      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [mockAIMessage] }],
      });

      const { getUserPromptForAIMessage } = useCopilotStore.getState();
      const prompt = getUserPromptForAIMessage(mockAIMessage);

      expect(prompt).toBeUndefined();
    });
  });

  describe("Citation Updates", () => {
    it("updates citations origin", () => {
      const aiMsgWithCitation: AIMessage = {
        role: "ai",
        content: "test",
        timestamp: 1,
        copilotId: "test",
        citations: [
          {
            id: "c1",
            source_info: {
              type: "widget",
              name: "Widget",
              origin: "old-origin",
              widget_id: "old-origin-widget-1",
            },
            signature: "sig",
          },
        ],
      };

      useCopilotStore.setState({
        chats: [{ ...mockChat, messages: [aiMsgWithCitation] }],
      });

      const { updateCitationsOrigin } = useCopilotStore.getState();
      updateCitationsOrigin("old-origin", "new-origin");

      const chat = useCopilotStore.getState().chats[0];
      const aiMsg = chat.messages[0] as AIMessage;
      expect(aiMsg.citations?.[0].source_info.origin).toBe("new-origin");
    });
  });
});
