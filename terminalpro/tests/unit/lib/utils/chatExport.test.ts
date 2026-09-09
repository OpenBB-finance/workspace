import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, Message } from "~/lib/state/copilot";
import { chatToMarkdown, downloadChatAsMarkdown } from "~/lib/utils/chatExport";

function human(content: string): Message {
  return { role: "human", content, copilotId: "c", timestamp: 0 };
}

function ai(content: string): Message {
  return { role: "ai", content, copilotId: "c", timestamp: 0 };
}

function makeChat(label: string, messages: Message[]): Chat {
  return { uuid: "1", createdAt: 0, label, messages };
}

describe("chatToMarkdown", () => {
  it("renders the label as a heading and human/AI turns", () => {
    const chat = makeChat("DXYZ holdings summary", [
      human("What are DXYZ's holdings?"),
      ai("DXYZ holds the following..."),
    ]);

    expect(chatToMarkdown(chat)).toBe(
      "# DXYZ holdings summary\n\n" +
        "**You:**\n\nWhat are DXYZ's holdings?\n\n" +
        "**AI:**\n\nDXYZ holds the following...\n",
    );
  });

  it("skips system and tool messages and empty content", () => {
    const chat = makeChat("Mixed", [
      { role: "system", content: {} as never, copilotId: "c", timestamp: 0 },
      human("   "),
      ai("Real answer"),
    ]);

    const md = chatToMarkdown(chat);
    expect(md).not.toContain("**You:**");
    expect(md).toContain("**AI:**\n\nReal answer");
  });

  it("falls back to a default title when label is empty", () => {
    expect(chatToMarkdown(makeChat("  ", [ai("hi")]))).toContain("# Untitled chat");
  });
});

describe("downloadChatAsMarkdown", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates an anchor with a slugified .md filename and clicks it", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadChatAsMarkdown(makeChat("DXYZ holdings summary", [ai("hi")]));

    expect(anchor.download).toBe("dxyz-holdings-summary.md");
    expect(anchor.href).toBe("blob:fake");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
