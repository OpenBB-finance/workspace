import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import ModelPicker from "~/components/AI/ModelPicker";
import { useShallowCopilotStore } from "~/lib/state/copilot";

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  SelectRoot: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid="select-root" data-value={value}>
      {children}
      <input
        data-testid="select-input"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        readOnly
      />
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button data-testid="select-trigger">{children}</button>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => (
    <div data-testid={`select-item-${value}`} data-value={value}>
      {children}
    </div>
  ),
}));

const MODELS = [
  { id: "openai:gpt-4o", name: "GPT-4o" },
  { id: "openai:gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "openrouter:anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
];

function mockCopilotStore(overrides: {
  models?: typeof MODELS | undefined;
  agentId?: string;
  selectedModelByAgent?: Record<string, string>;
}) {
  const models = "models" in overrides ? overrides.models : MODELS;
  const agentId = overrides.agentId ?? "test-agent";
  const selectedModelByAgent = overrides.selectedModelByAgent ?? {};

  const setSelectedModelForAgent = vi.fn();

  (useShallowCopilotStore as Mock).mockImplementation((selector) =>
    selector({
      selectedCopilot: agentId
        ? { id: agentId, models }
        : null,
      selectedModelByAgent,
      setSelectedModelForAgent,
    }),
  );

  return { setSelectedModelForAgent };
}

describe("ModelPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when agent has no models", () => {
    mockCopilotStore({ models: undefined });
    const { container } = render(<ModelPicker />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when models array is empty", () => {
    mockCopilotStore({ models: [] });
    const { container } = render(<ModelPicker />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no agent selected", () => {
    (useShallowCopilotStore as Mock).mockImplementation((selector) =>
      selector({
        selectedCopilot: null,
        selectedModelByAgent: {},
        setSelectedModelForAgent: vi.fn(),
      }),
    );
    const { container } = render(<ModelPicker />);
    expect(container.innerHTML).toBe("");
  });

  it("renders select with all model options", () => {
    mockCopilotStore({});
    render(<ModelPicker />);

    expect(screen.getByTestId("select-root")).toBeInTheDocument();
    expect(screen.getByTestId("select-item-openai:gpt-4o")).toBeInTheDocument();
    expect(screen.getByTestId("select-item-openai:gpt-4o-mini")).toBeInTheDocument();
    expect(
      screen.getByTestId("select-item-openrouter:anthropic/claude-sonnet-4.6"),
    ).toBeInTheDocument();
  });

  it("defaults to first model when no stored selection", () => {
    mockCopilotStore({});
    render(<ModelPicker />);

    const root = screen.getByTestId("select-root");
    expect(root.getAttribute("data-value")).toBe("openai:gpt-4o");
  });

  it("uses stored model when valid", () => {
    mockCopilotStore({
      selectedModelByAgent: { "test-agent": "openai:gpt-4o-mini" },
    });
    render(<ModelPicker />);

    const root = screen.getByTestId("select-root");
    expect(root.getAttribute("data-value")).toBe("openai:gpt-4o-mini");
  });

  it("falls back to first model when stored model is stale", () => {
    const { setSelectedModelForAgent } = mockCopilotStore({
      selectedModelByAgent: { "test-agent": "deleted-model" },
    });
    render(<ModelPicker />);

    const root = screen.getByTestId("select-root");
    expect(root.getAttribute("data-value")).toBe("openai:gpt-4o");
    expect(setSelectedModelForAgent).toHaveBeenCalledWith(
      "test-agent",
      "openai:gpt-4o",
    );
  });

  it("calls setSelectedModelForAgent with the agent id and chosen model on change", () => {
    const { setSelectedModelForAgent } = mockCopilotStore({});
    render(<ModelPicker />);

    fireEvent.change(screen.getByTestId("select-input"), {
      target: { value: "openrouter:anthropic/claude-sonnet-4.6" },
    });

    expect(setSelectedModelForAgent).toHaveBeenCalledWith(
      "test-agent",
      "openrouter:anthropic/claude-sonnet-4.6",
    );
  });

  it("keeps separate model selections per agent", () => {
    mockCopilotStore({
      agentId: "agent-a",
      selectedModelByAgent: {
        "agent-a": "openai:gpt-4o-mini",
        "agent-b": "openrouter:anthropic/claude-sonnet-4.6",
      },
    });
    render(<ModelPicker />);

    const root = screen.getByTestId("select-root");
    expect(root.getAttribute("data-value")).toBe("openai:gpt-4o-mini");
  });

  it("renders model display names not IDs", () => {
    mockCopilotStore({});
    render(<ModelPicker />);

    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o Mini")).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet 4.6")).toBeInTheDocument();
  });
});
