import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AILibrary from "~/routes/aiLibrary";

vi.mock("~/components/AI/AIAgentsTab", () => ({
  AIAgentsTab: () => <div data-testid="ai-agents-tab">AIAgentsTab content</div>,
}));

vi.mock("~/components/AI/MCPServersTab", () => ({
  MCPServersTab: () => <div data-testid="mcp-servers-tab">MCPServersTab content</div>,
}));

vi.mock("~/components/AI/PromptsTab", () => ({
  PromptsTab: () => <div data-testid="prompts-tab">PromptsTab content</div>,
}));

vi.mock("~/components/AI/SkillsTab", () => ({
  SkillsTab: () => <div data-testid="skills-tab">SkillsTab content</div>,
}));

vi.mock("~/lib/constants", () => ({
  inSnowflakeNativeApp: false,
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const renderWithRouter = (initialRoute = "/app/ai-library") =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AILibrary />
    </MemoryRouter>,
  );

describe("AILibrary", () => {
  it("shows 'AI Library' header text", () => {
    renderWithRouter();
    expect(screen.getByText("AI Library")).toBeInTheDocument();
  });

  it("renders AI Agents tab active by default and shows AIAgentsTab content", () => {
    renderWithRouter();

    expect(screen.getByRole("tab", { name: "AI Agents" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByTestId("ai-agents-tab")).toBeInTheDocument();
    // Other tabs are force-mounted (always in DOM to preserve state)
    expect(screen.getByTestId("prompts-tab")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-servers-tab")).toBeInTheDocument();
  });

  it("renders tabs in the expected order", () => {
    renderWithRouter();
    const tabNames = screen.getAllByRole("tab").map((tab) => tab.textContent?.trim());
    expect(tabNames).toEqual(["AI Agents", "MCP Servers", "Skills", "Prompts"]);
  });

  it("switches to Prompts tab when clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByRole("tab", { name: "Prompts" }));

    expect(screen.getByRole("tab", { name: "Prompts" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "AI Agents" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    // All tabs are force-mounted (always in DOM to preserve state)
    expect(screen.getByTestId("prompts-tab")).toBeInTheDocument();
    expect(screen.getByTestId("ai-agents-tab")).toBeInTheDocument();
  });

  it("switches to MCP Servers tab when clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByRole("tab", { name: "MCP Servers" }));

    expect(screen.getByRole("tab", { name: "MCP Servers" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "AI Agents" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    // All tabs are force-mounted (always in DOM to preserve state)
    expect(screen.getByTestId("mcp-servers-tab")).toBeInTheDocument();
    expect(screen.getByTestId("ai-agents-tab")).toBeInTheDocument();
  });

  it("switches to Skills tab when clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByRole("tab", { name: "Skills" }));

    expect(screen.getByRole("tab", { name: "Skills" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "AI Agents" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    // All tabs are force-mounted (always in DOM to preserve state)
    expect(screen.getByTestId("skills-tab")).toBeInTheDocument();
    expect(screen.getByTestId("ai-agents-tab")).toBeInTheDocument();
  });

  it("activates MCP Servers tab when URL has ?tab=mcp-servers", () => {
    renderWithRouter("/app/ai-library?tab=mcp-servers");

    expect(screen.getByRole("tab", { name: "MCP Servers" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "AI Agents" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    // All tabs are force-mounted (always in DOM to preserve state)
    expect(screen.getByTestId("mcp-servers-tab")).toBeInTheDocument();
    expect(screen.getByTestId("ai-agents-tab")).toBeInTheDocument();
  });
});
