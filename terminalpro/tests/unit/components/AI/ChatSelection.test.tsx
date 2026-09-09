import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchChats } from "~/api/auth.api";
import ChatSelection from "~/components/AI/ChatSelection";
import { type Chat, useCopilotStore } from "~/lib/state/copilot";
import { downloadChatAsMarkdown } from "~/lib/utils/chatExport";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("~/api/auth.api", () => ({
  searchChats: vi.fn(),
}));

vi.mock("~/lib/utils/chatExport", () => ({
  downloadChatAsMarkdown: vi.fn(),
}));

// @tanstack/react-virtual relies on real layout measurements (ResizeObserver-driven
// element sizes) that JSDOM never produces, which would report zero rendered rows.
// Render every row synchronously instead, matching the pattern used for
// NewAdvancedSelect's virtualized dropdown list.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: any) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        key: opts.getItemKey?.(i) ?? i,
        index: i,
        start: i * 32,
        size: 32,
      })),
    getTotalSize: () => opts.count * 32,
    measureElement: () => {},
    scrollToIndex: vi.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderChatSelection() {
  return render(<ChatSelection />, { wrapper: createWrapper() });
}

const now = Date.now();

const chatToday: Chat = {
  uuid: "chat-today",
  createdAt: now,
  label: "Today Chat",
  messages: [],
  lastInteraction: now,
  agentIds: ["openbb-copilot"],
};

const chatOlder: Chat = {
  uuid: "chat-older",
  createdAt: now - 10 * 24 * 60 * 60 * 1000,
  label: "Older Chat",
  messages: [
    { copilotId: "openbb-copilot", timestamp: now, role: "human", content: "Hi" },
  ],
  lastInteraction: now - 10 * 24 * 60 * 60 * 1000,
  agentIds: ["openbb-copilot"],
};

async function openPopover() {
  await userEvent.click(screen.getByRole("combobox"));
  const searchInput = await screen.findByPlaceholderText("Search chats");
  const dialog = screen.getByRole("dialog");
  return { searchInput, dialog };
}

describe("ChatSelection", () => {
  beforeEach(() => {
    vi.mocked(searchChats).mockReset();
    vi.mocked(downloadChatAsMarkdown).mockReset();
    mockToast.error.mockReset();
    useCopilotStore.setState({
      chats: [chatToday, chatOlder],
      currentChat: chatToday.createdAt,
      isFullscreen: false,
    });
  });

  it("renders the trigger with the current chat's label", () => {
    renderChatSelection();

    expect(screen.getByRole("combobox")).toHaveTextContent("Today Chat");
  });

  it("opens the popover and lists chats grouped by time", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    expect(within(dialog).getByText("Today")).toBeInTheDocument();
    expect(within(dialog).getByText("Older")).toBeInTheDocument();
    expect(within(dialog).getByText("Today Chat")).toBeInTheDocument();
    expect(within(dialog).getByText("Older Chat")).toBeInTheDocument();
  });

  it("shows an empty state when there are no chats", async () => {
    useCopilotStore.setState({ chats: [], currentChat: 0 });
    renderChatSelection();
    const { dialog } = await openPopover();

    expect(
      within(dialog).getByText("No previous chats in History"),
    ).toBeInTheDocument();
  });

  it("collapses a group and hides its chats without removing the header", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    await userEvent.click(within(dialog).getByText("Today"));

    expect(within(dialog).queryByText("Today Chat")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Today")).toBeInTheDocument();
    expect(within(dialog).getByText("Older Chat")).toBeInTheDocument();
  });

  it("filters chats via search and highlights the matched text", async () => {
    vi.mocked(searchChats).mockResolvedValue({
      searchQuery: "today",
      results: [
        {
          uuid: "chat-today",
          createdAt: chatToday.createdAt,
          label: "Today Chat",
          lastInteraction: chatToday.lastInteraction,
          recentMessages: [],
        },
      ],
    });

    renderChatSelection();
    const { searchInput, dialog } = await openPopover();

    await userEvent.type(searchInput, "today");

    await waitFor(
      () => {
        expect(searchChats).toHaveBeenCalledWith("today");
      },
      { timeout: 3000 },
    );

    await waitFor(
      () => {
        expect(dialog.querySelector('[data-label="true"]')).toHaveTextContent(
          "Today Chat",
        );
      },
      { timeout: 3000 },
    );

    expect(within(dialog).queryByText("Older Chat")).not.toBeInTheDocument();
    const mark = dialog.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark).toHaveTextContent(/today/i);
  });

  it("selects a chat and updates the current chat in the store", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    await userEvent.click(within(dialog).getByText("Older Chat"));

    await waitFor(() => {
      expect(useCopilotStore.getState().currentChat).toBe(chatOlder.createdAt);
    });
  });

  it("moves the highlight through the results with ArrowDown/ArrowUp and selects with Enter", async () => {
    renderChatSelection();
    const { searchInput, dialog } = await openPopover();

    const todayRow = within(dialog).getByText("Today Chat").closest("button");
    const olderRow = within(dialog).getByText("Older Chat").closest("button");
    if (!(todayRow && olderRow)) throw new Error("chat rows not found");

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    expect(todayRow).toHaveClass("bg-general-bg-primary-hover");
    expect(olderRow).not.toHaveClass("bg-general-bg-primary-hover");

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    expect(olderRow).toHaveClass("bg-general-bg-primary-hover");
    expect(todayRow).not.toHaveClass("bg-general-bg-primary-hover");

    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() => {
      expect(useCopilotStore.getState().currentChat).toBe(chatOlder.createdAt);
    });
  });

  it("wraps to the last result when pressing ArrowUp with nothing highlighted", async () => {
    renderChatSelection();
    const { searchInput, dialog } = await openPopover();

    const olderRow = within(dialog).getByText("Older Chat").closest("button");
    if (!olderRow) throw new Error("chat row not found");

    fireEvent.keyDown(searchInput, { key: "ArrowUp" });
    expect(olderRow).toHaveClass("bg-general-bg-primary-hover");

    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() => {
      expect(useCopilotStore.getState().currentChat).toBe(chatOlder.createdAt);
    });
  });

  it("exports a chat as markdown", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    const row = within(dialog).getByText("Older Chat").closest("button");
    if (!row) throw new Error("chat row not found");
    await userEvent.click(within(row).getByTestId("icon-download"));

    expect(downloadChatAsMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: chatOlder.uuid }),
    );
  });

  it("edits a chat's label", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    const row = within(dialog).getByText("Older Chat").closest("button");
    if (!row) throw new Error("chat row not found");
    await userEvent.click(within(row).getByTestId("icon-edit-03"));

    const input = await screen.findByDisplayValue("Older Chat");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed Chat");
    await userEvent.click(screen.getByText("Update"));

    await waitFor(() => {
      const updated = useCopilotStore
        .getState()
        .chats.find((c) => c.uuid === chatOlder.uuid);
      expect(updated?.label).toBe("Renamed Chat");
    });
  });

  it("shows an error and keeps the chat when deleting the last remaining chat", async () => {
    useCopilotStore.setState({ chats: [chatToday], currentChat: chatToday.createdAt });
    renderChatSelection();
    const { dialog } = await openPopover();

    const row = within(dialog).getByText("Today Chat").closest("button");
    if (!row) throw new Error("chat row not found");
    await userEvent.click(within(row).getByTestId("icon-trash-04"));

    expect(mockToast.error).toHaveBeenCalledWith("At least a chat window must remain");
    expect(useCopilotStore.getState().chats).toHaveLength(1);
  });

  it("deletes a chat when more than one remains", async () => {
    renderChatSelection();
    const { dialog } = await openPopover();

    const row = within(dialog).getByText("Older Chat").closest("button");
    if (!row) throw new Error("chat row not found");
    await userEvent.click(within(row).getByTestId("icon-trash-04"));

    await waitFor(() => {
      expect(
        useCopilotStore.getState().chats.some((c) => c.uuid === chatOlder.uuid),
      ).toBe(false);
    });
  });
});
