import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Artifact from "~/components/AI/Artifact";
import { type ArtifactT, useCopilotStore } from "~/lib/state/copilot";

const mockNavigate = vi.fn();
const mockAddTab = vi.fn();
const mockToastError = vi.fn();
const mockItems = {
  "current-dashboard": {
    index: "current-dashboard",
    name: "Current dashboard",
    data: {
      name: "Current dashboard",
      type: "custom",
      widgets: [{ id: "existing-widget" }],
      gridLayout: {},
      groups: [],
      templateId: "custom-existing-dashboard",
    },
  },
};

// createCustomTemplateTab is exercised in createTemplates.test.ts; here we only assert
// the artifact wires the dashboard creation request correctly.
const mockCreateCustomTemplateTab = vi.fn(async (args: any) => {
  args.addTab?.({
    index: "built-dashboard",
    data: {
      name: "Built",
      type: "template",
      widgets: [{ id: "w1" }],
      gridLayout: { overview: [] },
      groups: [],
    },
  });
  return "dash-1";
});

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "current-dashboard" }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("~/lib/utils/createTemplates", async (orig) => ({
  ...(await orig<typeof import("~/lib/utils/createTemplates")>()),
  createCustomTemplateTab: (args: any) => mockCreateCustomTemplateTab(args),
}));

vi.mock("~/lib/state/app", async (orig) => ({
  ...(await orig<typeof import("~/lib/state/app")>()),
  useShallowAppStore: (selector: any) =>
    selector({ addTab: mockAddTab, items: mockItems }),
}));

function makeAppArtifact(): ArtifactT {
  return {
    uuid: "art-1",
    type: "app",
    name: "AAPL Overview",
    app: {
      name: "AAPL Overview",
      description: "Price and news for Apple",
      tabs: {
        overview: {
          id: "overview",
          name: "Overview",
          layout: [
            { i: "price", x: 0, y: 0, w: 40, h: 10 },
            { i: "news", x: 0, y: 10, w: 20, h: 8 },
          ],
        },
        research: {
          id: "research",
          name: "Research",
          layout: [{ i: "fundamentals", x: 0, y: 0, w: 40, h: 12 }],
        },
      },
      prompts: ["What is the trend?"],
    },
    widget_refs: [
      { i: "price", origin: "openbb", widget_id: "price" },
      { i: "news", origin: "openbb", widget_id: "news" },
      { i: "fundamentals", origin: "openbb", widget_id: "fundamentals" },
    ],
  } as unknown as ArtifactT;
}

describe("AppArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCopilotStore.setState({
      isFullscreen: false,
      isIntentionallyCollapsed: false,
      lastPanelState: "open",
    });
  });

  it("renders the app name, description, and tab/widget counts", () => {
    render(<Artifact artifact={makeAppArtifact()} />);

    expect(screen.getByText("AAPL Overview")).toBeInTheDocument();
    expect(screen.getByText("Price and news for Apple")).toBeInTheDocument();

    const card = screen.getByTestId("app-artifact");
    expect(card.textContent).toContain("2 tabs");
    expect(card.textContent).toContain("3 widgets");

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
  });

  it("opens as a dashboard with navigation and a per-widget source resolver", async () => {
    render(<Artifact artifact={makeAppArtifact()} />);

    fireEvent.click(screen.getByTestId("open-app-artifact-button"));

    await waitFor(() => expect(mockCreateCustomTemplateTab).toHaveBeenCalled());
    const args = mockCreateCustomTemplateTab.mock.calls.at(-1)?.[0];
    expect(args.navigate).toBe(mockNavigate);
    expect(args.template.name).toBe("AAPL Overview");
    expect(args.dashboardBehavior).toBe("new");
    expect(typeof args.resolveWidgetSource).toBe("function");
  });

  it("exits fullscreen without collapsing copilot when opening a new dashboard", async () => {
    useCopilotStore.setState({
      isFullscreen: true,
      isIntentionallyCollapsed: false,
      lastPanelState: "fullscreen",
    });

    render(<Artifact artifact={makeAppArtifact()} />);

    fireEvent.click(screen.getByTestId("open-app-artifact-button"));

    await waitFor(() => expect(mockCreateCustomTemplateTab).toHaveBeenCalled());
    const copilotState = useCopilotStore.getState();
    expect(copilotState.isFullscreen).toBe(false);
    expect(copilotState.isIntentionallyCollapsed).toBe(false);
    expect(copilotState.lastPanelState).toBe("open");
  });

  it("does not render the removed save action", () => {
    render(<Artifact artifact={makeAppArtifact()} />);

    expect(screen.queryByTestId("save-app-artifact-button")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("updates the current dashboard after confirming the dialog", async () => {
    render(<Artifact artifact={makeAppArtifact()} />);

    fireEvent.click(screen.getByTestId("update-current-dashboard-app-artifact-button"));
    fireEvent.click(await screen.findByText("Yes, update"));

    await waitFor(() => expect(mockCreateCustomTemplateTab).toHaveBeenCalled());
    const args = mockCreateCustomTemplateTab.mock.calls.at(-1)?.[0];
    expect(args.dashboardBehavior).toBe("current");
    expect(args.currentDashboard).toBe("current-dashboard");
  });
});
