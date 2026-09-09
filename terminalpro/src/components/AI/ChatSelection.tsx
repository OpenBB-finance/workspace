import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type KeyboardEvent,
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import useIsMobile from "~/hooks/useIsMobile";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useCopilotStore, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { downloadChatAsMarkdown } from "~/lib/utils/chatExport";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { Popover, PopoverTrigger } from "../ds/atoms/Popover";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogTitle } from "../ds/dialogs/Dialog";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { type ChatMatch, getGroupedChats, useChatSearch } from "./hooks/useChatSearch";
import { useShallowStreamingStore } from "./hooks/useStreaming";

export default function ChatSelection() {
  const isMobile = useIsMobile();
  const { currentChatLabel, isFullscreen } = useShallowCopilotStore((state) => ({
    currentChatLabel: state.getCurrentChat().label,
    isFullscreen: state.isFullscreen,
  }));
  const [state, dispatch] = useStateReducer({
    popoverOpen: false,
    popoverWidth: 0,
    titleMaxWidth: 200,
    editChat: null as ChatMatch | null,
  });
  const loading = useShallowStreamingStore((state) => state.loading);

  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updateDimensions = useCallback(() => {
    const viewportWidth = window.innerWidth;

    // Mobile drawer doesn't render the resizable right-panel, so the desktop
    // DOM lookup below would early-return with popoverWidth stuck at 0.
    // Compute mobile bounds directly from viewport.
    if (isMobile) {
      dispatch({
        popoverWidth: viewportWidth - 16,
        titleMaxWidth: 240,
      });
      return;
    }

    const aiPanelDiv = document.querySelector('[data-panel-id="right-panel"]');
    const headerDiv = aiPanelDiv?.querySelector("[id='obb-copilot-header']");
    const buttonDiv = headerDiv?.querySelector('[id="obb-copilot-header-buttons"]');

    if (!(aiPanelDiv && headerDiv && buttonDiv)) {
      dispatch({ titleMaxWidth: 200 });
      return;
    }

    const buttonWidth = buttonDiv?.clientWidth || 120;
    const chevronWidth = 20; // chevron icon width
    const headerPadding = 16; // px-4 = 16px padding

    // Step 4: Calculate title width
    const headerWidth = headerDiv.clientWidth;
    const availableWidth = headerWidth - buttonWidth - chevronWidth - headerPadding;

    const titleMaxWidth = Math.max(
      120,
      Math.min(isFullscreen ? 500 : 300, availableWidth),
    );

    // Also update popover width - constrain to prevent horizontal scrolling
    const panelWidth = aiPanelDiv.clientWidth;

    // Desktop fullscreen: up to 40% of viewport, max 400px.
    // Desktop normal: up to 90% of panel width, min 280px, max 400px.
    const popoverWidth = Math.min(
      400,
      isFullscreen ? viewportWidth * 0.4 : Math.max(280, panelWidth * 0.9),
    );

    dispatch({ popoverWidth, titleMaxWidth });
  }, [isFullscreen, isMobile]);

  useEffect(() => {
    if (triggerRef.current) {
      // Initial calculation
      updateDimensions();

      // Observe the AI panel container (the one that actually changes size)
      const aiPanelContainer = document.querySelector('[data-panel-id="right-panel"]');

      if (aiPanelContainer) {
        // Step 5: Set up ResizeObserver on the correct panel container
        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(aiPanelContainer);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }
  }, [triggerRef, state.popoverOpen, updateDimensions]);

  const setEditChat = useCallback((chat: ChatMatch | null) => {
    dispatch({ editChat: chat });
  }, []);

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    dispatch({ popoverOpen: open });
  }, []);

  const chatItemsMemo = useMemo(
    () => (
      <ChatItems
        onClose={() => dispatch({ popoverOpen: false })}
        setEditChat={setEditChat}
      />
    ),
    [dispatch, setEditChat],
  );

  return (
    <>
      <Popover
        open={state.popoverOpen}
        onOpenChange={handlePopoverOpenChange}
        side="bottom"
        align={isFullscreen ? "center" : "start"}
        className="bg-general-bg-primary max-w-[95vw] overflow-hidden"
        style={{ width: state.popoverWidth, maxWidth: "95vw" }}
        content={chatItemsMemo}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <PopoverTrigger asChild={true} ref={triggerRef}>
          <Button
            variant="outlined"
            size="sm"
            role="combobox"
            className={cn(
              "px-0",
              "text-xs text-ds-text-body _copilot_area_button",
              "!border-transparent hover:!border-transparent focus-visible:!border-transparent !m-0 h-auto",
              {
                "w-full justify-center": isFullscreen,
                "justify-between flex-1 max-w-full": !isFullscreen,
                "opacity-50": loading,
              },
            )}
            disabled={loading}
          >
            <div className="flex items-center min-w-0 p-0 gap-1">
              <Tooltip message={currentChatLabel}>
                <span
                  className="truncate font-medium min-w-0 text-ds-text-heading"
                  style={{ maxWidth: `${state.titleMaxWidth}px` }}
                >
                  {currentChatLabel}
                </span>
              </Tooltip>
              <Icon
                id="chevron-right"
                className={cn(
                  "h-4 w-4 opacity-50 shrink-0 transition-transform duration-200",
                  state.popoverOpen && "rotate-90",
                )}
              />
            </div>
          </Button>
        </PopoverTrigger>
      </Popover>
      {state.editChat && (
        <EditChatDialog chat={state.editChat} onClose={() => setEditChat(null)} />
      )}
    </>
  );
}

ChatSelection.displayName = "ChatSelection";

function highlightText(text: string, terms: string[]) {
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "gi"));
  if (parts.length <= 1) return text;

  const highlightedParts = new Set<string>();
  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    if (isMatch && !highlightedParts.has(part)) {
      highlightedParts.add(part);
      return (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-600">
          {part}
        </mark>
      );
    }
    return part;
  });
}

type ChatItemProps = {
  chat: ChatMatch;
  totalChats: number;
  setEditChat?: (chat: ChatMatch) => void;
  searchTerms?: string[];
  isSelected?: boolean;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  clearSelection?: () => void;
};

const ChatItem = memo((props: ChatItemProps) => {
  const {
    chat,
    totalChats,
    setEditChat,
    searchTerms,
    isSelected,
    buttonRef,
    clearSelection,
  } = props;

  const { currentChat, setCurrentChat, loadChatData, removeChat } =
    useShallowCopilotStore((state) => ({
      currentChat: state.currentChat,
      updateCopilotLabel: state.updateCopilotLabel,
      setTitleManuallyUpdated: state.setTitleManuallyUpdated,
      setCurrentChat: state.setCurrentChat,
      loadChatData: state.loadChatData,
      removeChat: state.removeChat,
    }));

  const dispatch = useShallowStreamingStore((state) => state.dispatch);
  const clearSelectedWidgets = useShallowCopilotDataStore(
    (state) => state.clearSelectedWidgets,
  );

  const handleChatSelection = useCallback(
    async (e: ReactMouseEvent<HTMLButtonElement> | number) => {
      if (typeof e !== "number") await loadChatData(chat.uuid);
      else setCurrentChat(e);
      dispatch({ files: [] });
      clearSelectedWidgets();
    },
    [chat.createdAt, setCurrentChat, loadChatData, clearSelectedWidgets],
  );

  const handleExport = useCallback(
    (e: ReactMouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      const fullChat = useCopilotStore
        .getState()
        .chats.find((c) => c.createdAt === chat.createdAt);
      if (!fullChat || fullChat.messages.length === 0) {
        toast.error("This chat has no messages to export");
        return;
      }
      downloadChatAsMarkdown(fullChat);
    },
    [chat.createdAt],
  );

  const displayText = chat.matchedMessage || chat.label;
  const highlightedText = useMemo(
    () => (searchTerms?.length ? highlightText(displayText, searchTerms) : displayText),
    [displayText, searchTerms],
  );

  return (
    <div className="flex gap-1 items-center" key={`row-${chat.uuid}`}>
      <button
        ref={buttonRef}
        className={cn(
          "flex w-full items-center justify-between text-left",
          "hover:bg-general-bg-primary-hover px-2 py-1.5 rounded-sm group",
          { "bg-general-bg-primary-hover": isSelected },
        )}
        key={`select-${chat.uuid}`}
        onClick={handleChatSelection}
        onMouseEnter={clearSelection}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {chat.createdAt === currentChat && (
              <Icon id="check" className="h-4 w-4 shrink-0" />
            )}
          </span>
          <Tooltip message={chat.label} id={`tooltip-${chat.uuid}`}>
            <span
              data-label={true}
              className="text-ds-text-subtitle truncate min-w-0 text-left"
            >
              {highlightedText}
            </span>
          </Tooltip>
        </span>
        <div
          className="hidden items-center gap-2 group-hover:flex
          text-ds-text-body shrink-0"
        >
          <Tooltip message="Export chat" position="top">
            <span className="hover:opacity-80" onClick={handleExport}>
              <Icon id="download" className="h-4 w-4 shrink-0" />
            </span>
          </Tooltip>
          <Tooltip message="Edit chat" position="top">
            <span
              className="hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                setEditChat?.(chat);
              }}
            >
              <Icon id="edit-03" className="h-4 w-4 shrink-0" />
            </span>
          </Tooltip>
          <Tooltip message="Delete chat" position="top">
            <span
              className="hover:opacity-80"
              onClick={(e) => {
                e.stopPropagation();
                if (totalChats === 1) {
                  toast.error("At least a chat window must remain");
                  return;
                }
                removeChat(chat.createdAt);
                // in case the chat that was deleted was the current one
                // we assign the last chat as the new one
                if (chat?.createdAt === currentChat) {
                  handleChatSelection(0);
                }
              }}
            >
              <Icon id="trash-04" className="h-4 w-4 shrink-0" />
            </span>
          </Tooltip>
        </div>
      </button>
    </div>
  );
});

ChatItem.displayName = "ChatItem";

type ChatRow =
  | { type: "header"; key: string; groupKey: string; label: string }
  | { type: "chat"; key: string; chat: ChatMatch };

const GroupHeader = memo(
  ({
    label,
    groupKey,
    collapsed,
    onToggle,
  }: {
    label: string;
    groupKey: string;
    collapsed: boolean;
    onToggle: (groupKey: string) => void;
  }) => (
    <button
      onClick={() => onToggle(groupKey)}
      className="flex w-full items-center gap-1 text-[10px] font-normal
      text-ds-text-caption px-2 py-1 uppercase
      tracking-wide hover:text-ds-text-body transition-colors"
    >
      <Icon
        id="chevron-right"
        className={cn(
          "h-3 w-3 transition-transform duration-200",
          !collapsed && "rotate-90",
        )}
      />
      {label}
    </button>
  ),
);
GroupHeader.displayName = "GroupHeader";

type ChatItemsProps = {
  onClose: () => void;
  setEditChat: (chat: ChatMatch | null) => void;
};

const ChatItems = memo((props: ChatItemsProps) => {
  const { onClose, setEditChat } = props;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [state, dispatch] = useStateReducer({
    searchInput: "",
    collapsedGroups: {} as Record<string, boolean>,
    selectionIndex: -1,
  });
  const [deferredInput] = useDebounceValue(state.searchInput.trim(), 300);
  const isSearching = deferredInput.length >= 2;

  const { filteredChats, totalChats, isLoading } = useChatSearch(deferredInput);
  const currentChat = useCopilotStore((s) => s.currentChat);

  const chatRowRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const onInputChange = useCallback(
    (val: string) => {
      dispatch({ searchInput: val });
      if (searchInputRef.current) {
        searchInputRef.current.value = val;
      }
    },
    [searchInputRef],
  );

  const toggleGroup = useCallback((groupKey: string) => {
    dispatch({
      collapsedGroups: (prev) => ({
        ...prev,
        [groupKey]: !prev[groupKey],
      }),
    });
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup: reset search input when component unmounts
      dispatch({ searchInput: "" });
    };
  }, []);

  const rows = useMemo<ChatRow[]>(() => {
    if (filteredChats.length === 0) return [];

    if (isSearching) {
      return filteredChats.map((chat) => ({ type: "chat", key: chat.uuid, chat }));
    }

    return getGroupedChats(filteredChats).flatMap((group) => {
      const { key: groupKey, label, chats } = group;
      const groupRows: ChatRow[] = [
        { type: "header", key: `header-${groupKey}`, groupKey, label },
      ];
      if (state.collapsedGroups[groupKey]) return groupRows;
      const groupChats = chats.map((chat) => ({ type: "chat", key: chat.uuid, chat }));
      return groupRows.concat(groupChats as ChatRow[]);
    });
  }, [filteredChats, isSearching, state.collapsedGroups]);

  // search text is highlighted inline by ChatItem, gated on isLoading so
  // stale placeholder results aren't highlighted with the new query's terms
  const searchTerms = useMemo(() => {
    if (!isSearching || isLoading) return undefined;
    const terms = deferredInput
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    terms.push(
      ...terms.flatMap((part) =>
        part
          .split(" ")
          .map((subPart) => subPart.trim())
          .filter((subPart) => !terms.includes(subPart)),
      ),
    );

    return terms;
  }, [isSearching, isLoading, deferredInput]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? 26 : 32),
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  useEffect(() => {
    // Scroll the active chat into view once, when the popover first mounts.
    const index = rows.findIndex(
      (row) => row.type === "chat" && row.chat.createdAt === currentChat,
    );
    if (index === -1) return;
    queueMicrotask(() => virtualizer.scrollToIndex(index, { align: "center" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The visible rows change whenever the search/grouping/collapse state does,
  // so any previously highlighted row may no longer exist.
  useEffect(() => {
    dispatch({ selectionIndex: -1 });
  }, [rows.length]);

  const chatIndexes = useMemo(
    () =>
      rows
        .map((row, index) => (row.type === "chat" ? index : -1))
        .filter((index) => index !== -1),
    [rows],
  );

  const moveSelection = useCallbackRef((key: "ArrowDown" | "ArrowUp") => {
    if (chatIndexes.length === 0) return;
    let nextPos = null;

    const currentPos = chatIndexes.indexOf(state.selectionIndex);
    if (currentPos === -1) {
      nextPos = key === "ArrowDown" ? 0 : chatIndexes.length - 1;
    } else {
      const direction = key === "ArrowDown" ? 1 : -1;
      nextPos = (currentPos + direction + chatIndexes.length) % chatIndexes.length;
    }

    const nextIndex = chatIndexes[nextPos];
    dispatch({ selectionIndex: nextIndex });
    virtualizer.scrollToIndex(nextIndex, { align: "auto" });
  });

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (searchInputRef.current?.value) {
          dispatch({ searchInput: "" });
          e.stopPropagation();
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(e.key);
        return;
      }

      if (e.key === "Enter" && state.selectionIndex !== -1) {
        e.preventDefault();
        chatRowRefs.current[state.selectionIndex]?.click();
      }
    },
    [searchInputRef, chatRowRefs, onClose, moveSelection, state.selectionIndex],
  );

  const clearSelection = useCallback(() => dispatch({ selectionIndex: -1 }), []);
  const buttonRef = useCallback(
    (rowIndex: number) => (el: HTMLButtonElement | null) => {
      chatRowRefs.current[rowIndex] = el;
    },
    [chatRowRefs],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="px-2 pt-2">
        <Input
          ref={searchInputRef}
          type="text"
          prefix={<Icon id="search" />}
          defaultValue={state.searchInput}
          onChange={onInputChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search chats"
          className="w-full"
        />
      </div>
      <div ref={containerRef} className="overflow-y-auto max-h-[300px] select-none!">
        {rows.length === 0 ? (
          <div className="text-center text-sm text-ds-text-caption py-4">
            {isSearching ? "No chats found" : "No previous chats in History"}
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.type === "header" ? (
                    <GroupHeader
                      label={row.label}
                      groupKey={row.groupKey}
                      collapsed={!!state.collapsedGroups[row.groupKey]}
                      onToggle={toggleGroup}
                    />
                  ) : (
                    <ChatItem
                      chat={row.chat}
                      totalChats={totalChats}
                      setEditChat={setEditChat}
                      clearSelection={clearSelection}
                      searchTerms={searchTerms}
                      isSelected={virtualRow.index === state.selectionIndex}
                      buttonRef={buttonRef(virtualRow.index)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ChatItems.displayName = "ChatItems";

function EditChatDialog(props: { chat: ChatMatch; onClose: () => void }) {
  const { chat, onClose } = props;

  const { updateCopilotLabel, setTitleManuallyUpdated } = useShallowCopilotStore(
    (state) => ({
      updateCopilotLabel: state.updateCopilotLabel,
      setTitleManuallyUpdated: state.setTitleManuallyUpdated,
    }),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = useCallback(() => {
    if (inputRef.current) {
      const newName = inputRef.current.value;
      if (newName) {
        updateCopilotLabel(chat.createdAt, newName);
        onClose();
        setTitleManuallyUpdated(chat.createdAt, true);
      }
    }
  }, [inputRef, chat.createdAt, updateCopilotLabel, setTitleManuallyUpdated, onClose]);

  return (
    <BaseDialog open={chat !== null} onClose={onClose}>
      <DialogTitle>Edit Chat</DialogTitle>
      <input
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }
        }}
        ref={inputRef}
        defaultValue={chat.label}
        key={`input-${chat.uuid}`}
        className="obb-minimal-input-search !h-[34px] w-full my-4"
      />
      <div
        className="mt-auto flex items-center justify-end gap-2.5"
        key={`footer-${chat.uuid}`}
      >
        <DialogClose className="obb-btn-secondary-v2 px-3 py-1 font-medium md:w-fit">
          Cancel
        </DialogClose>
        <button
          onClick={handleSubmit}
          className="obb-btn-tertiary h-8 px-3 py-1 font-medium md:w-fit"
        >
          Update
        </button>
      </div>
    </BaseDialog>
  );
}
