import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TextStyle from "~/components/AI/TextStyle";

vi.mock("~/components/AI/hooks/useMentions", () => ({
  useMentions: () => ({
    processMentions: (content: string) => ({
      result: content,
      mentions: [
        { id: "w1", trigger: "@", name: "Foo", group: "all" },
        { id: "w2", trigger: "@", name: "WebThing", group: "web" },
      ],
    }),
  }),
}));

vi.mock("~/components/AI/hooks/useSkillSuggestions", () => ({
  useSkillSuggestions: () => ({ skillOptions: [{ slashText: "/skill:my-skill" }] }),
}));

vi.mock("~/components/AI/hooks/useMcpToolSuggestions", () => ({
  useMcpToolSuggestions: () => ({ mcpToolOptions: [{ slashText: "/server_tool" }] }),
}));

vi.mock("~/components/AI/hooks/useSemanticViewSuggestions", () => ({
  useSemanticViewSuggestions: () => ({
    svOptions: [{ slashText: "/sv:DB.SCHEMA.VIEW" }],
  }),
}));

describe("TextStyle chip rendering", () => {
  it("renders a brand mention as a single unbreakable pill that ellipsizes", () => {
    render(<TextStyle content="hi @Foo there" />);

    const chip = screen.getByText("@Foo");
    // Static chip = one pill that never wraps; it truncates with an ellipsis
    // instead of splitting across lines.
    expect(chip).toHaveClass(
      "bg-copilot-mention-bg",
      "rounded-full",
      "inline-block",
      "max-w-full",
      "truncate",
      "align-middle",
    );
    // No absolute-positioned background hack, and no per-line cap cloning.
    expect(chip).not.toHaveClass("absolute");
    expect(chip).not.toHaveClass("box-decoration-clone");
  });

  it("exposes the full token via title so a truncated chip shows it on hover", () => {
    render(<TextStyle content="run /skill:my-skill and tag @Foo" />);

    expect(screen.getByText("@Foo")).toHaveAttribute("title", "@Foo");
    expect(screen.getByText("/skill:my-skill")).toHaveAttribute(
      "title",
      "/skill:my-skill",
    );
  });

  it("renders a web mention with the neutral chip token", () => {
    render(<TextStyle content="hi @WebThing there" />);

    const chip = screen.getByText("@WebThing");
    expect(chip).toHaveClass("bg-copilot-mention-web-bg", "text-copilot-mention-web-label");
    expect(chip).not.toHaveClass("bg-copilot-mention-bg");
  });

  it("renders slash commands (sv / skill / mcp) as chips", () => {
    render(
      <TextStyle content="run /sv:DB.SCHEMA.VIEW and /skill:my-skill and /server_tool" />,
    );

    for (const token of ["/sv:DB.SCHEMA.VIEW", "/skill:my-skill", "/server_tool"]) {
      expect(screen.getByText(token)).toHaveClass("bg-copilot-mention-bg");
    }
  });

  it("adds breathing room (horizontal padding + label color) in static mode", () => {
    render(<TextStyle content="hi @Foo" />);

    const chip = screen.getByText("@Foo");
    expect(chip).toHaveClass("px-1", "text-copilot-mention-label");
  });

  it("keeps the overlay chip flow-neutral so it stays glyph-aligned with the textarea", () => {
    render(<TextStyle content="hi @Foo" overlay />);

    const chip = screen.getByText("@Foo");
    expect(chip).toHaveClass(
      "bg-copilot-mention-bg",
      "rounded-full",
      "text-copilot-mention-label",
    );
    // Anything that shifts inline-flow wrapping would desync the pill from the
    // real <textarea>: no `px-1`, no truncation, no inline-block. Horizontal
    // padding is allowed because it's compensated by an equal negative margin.
    expect(chip).not.toHaveClass("px-1");
    expect(chip).not.toHaveClass("truncate");
    expect(chip).not.toHaveClass("inline-block");
    expect(chip).not.toHaveClass("max-w-full");
    // Slice (default) decoration, not clone, so a wrapped pill reads as one
    // continuous pill rather than a capped fragment per line.
    expect(chip).not.toHaveClass("box-decoration-clone");
    // Overlay sits under a pointer-events-none layer, so a hover title is moot.
    expect(chip).not.toHaveAttribute("title");
  });

  it("renders URLs as clickable informative links, not chips", () => {
    render(<TextStyle content="see https://example.com now" />);

    const link = screen.getByText("https://example.com");
    expect(link).toHaveClass("text-alert-informative", "cursor-pointer");
    expect(link).not.toHaveClass("bg-copilot-mention-bg");
  });

  it("renders an unresolvable mention as a muted chip instead of the raw token", () => {
    render(
      <TextStyle content="USE @[id:tab_id=abc&inner_tab=short-term-energy-outlook] to extract" />,
    );

    // The raw token must never reach the user.
    expect(screen.queryByText(/@\[id:/)).toBeNull();

    const chip = screen.getByText("@Short Term Energy Outlook");
    expect(chip).toHaveClass(
      "bg-general-bg-secondary",
      "text-ds-text-caption",
      "border-dashed",
      "truncate",
    );
    // Muted, not branded: a stale reference isn't an active mention.
    expect(chip).not.toHaveClass("bg-copilot-mention-bg");
    // Explanation goes through the shared Tooltip, not a native title.
    expect(chip).not.toHaveAttribute("title");
    expect(chip).toHaveAttribute("data-state");
  });

  it("keeps the raw token editable and flow-neutral when overlaying the textarea", () => {
    const token = "@[id:tab_id=abc&inner_tab=short-term-energy-outlook]";
    render(<TextStyle content={`USE ${token} to extract`} overlay />);

    // Relabelling would desync the highlight layer from the real <textarea>.
    const chip = screen.getByText(token);
    expect(chip).toHaveClass("bg-general-bg-secondary");
    expect(chip).not.toHaveClass("border-dashed");
    expect(chip).not.toHaveClass("px-1");
    expect(chip).not.toHaveAttribute("title");
    // No tooltip trigger either: the overlay is pointer-events-none.
    expect(chip).not.toHaveAttribute("data-state");
  });

  it("renders plain text without chip styling", () => {
    const { container } = render(<TextStyle content="just plain words" />);

    expect(container).toHaveTextContent("just plain words");
    expect(container.querySelector(".bg-copilot-mention-bg")).toBeNull();
  });
});
