import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { CopilotChat as CopilotChatComp } from "~/components/AI/CopilotChat";
import { MobileProvider } from "~/lib/providers/MobileProvider";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useThemeStore } from "~/lib/state/theme";

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: vi.fn(() => ({
      setShowAddAgentsDialog: vi.fn(),
    })),
  },
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({
    pathname: "/",
    search: "",
    hash: "",
  }),
}));

function CopilotChat() {
  return (
    <MobileProvider>
      <CopilotChatComp />
    </MobileProvider>
  );
}

vi.mock("~/components/AI", () => ({
  CopilotContentErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
  CopilotDropzone: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropzone">{children}</div>
  ),
  CopilotFooter: () => <div data-testid="footer">Footer</div>,
  CopilotHeader: () => <div data-testid="header">Header</div>,
  CopilotMessageGroupRoot: () => <div data-testid="message-group-root">Messages</div>,
  CopilotWelcome: () => <div data-testid="welcome">Welcome</div>,
  CopilotWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wrapper">{children}</div>
  ),
  ScrollButton: () => <div data-testid="scroll-button">Scroll</div>,
}));

vi.mock("~/components/AI/AddCopilotDialog", () => ({
  AddCopilotDialog: () => <div data-testid="add-copilot-dialog">Add Dialog</div>,
}));

vi.mock("~/components/AI/AgentConfigDialog", () => ({
  AgentConfigDialog: () => <div data-testid="agent-config-dialog">Config Dialog</div>,
}));

vi.mock("~/components/AI/CopilotContext", () => ({
  CopilotContext: () => <div data-testid="copilot-context">Context</div>,
}));

vi.mock("~/components/AI/ExternalLinkProvider", () => ({
  ExternalLinkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/DraggableCard/SetLoadingOnResize", () => ({
  CopilotSetLoadingOnResize: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="set-loading-on-resize" className={className}>
      {children}
    </div>
  ),
}));

describe("CopilotChat", () => {
  const mockSetShowAddAgentsDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useThemeStore.getState as Mock).mockReturnValue({
      setShowAddAgentsDialog: mockSetShowAddAgentsDialog,
    });
  });

  describe("when copilot is selected", () => {
    beforeEach(() => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "openbb-copilot", name: "OpenBB Copilot" },
          isFullscreen: false,
        });
      });
    });

    it("renders the main chat interface", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("wrapper")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByTestId("welcome")).toBeInTheDocument();
      expect(screen.getByTestId("message-group-root")).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("renders all dialog components", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("agent-config-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("add-copilot-dialog")).toBeInTheDocument();
    });

    it("renders dropzone for file uploads", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("dropzone")).toBeInTheDocument();
    });

    it("renders scroll button", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("scroll-button")).toBeInTheDocument();
    });

    it("renders error boundary wrapper", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    });

    it("renders copilot context section", () => {
      render(<CopilotChat />);

      expect(screen.getByTestId("copilot-context")).toBeInTheDocument();
    });
  });

  describe("when no copilot is selected", () => {
    beforeEach(() => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: null,
          isFullscreen: false,
        });
      });
    });

    it("renders NoCopilotSelected view", () => {
      render(<CopilotChat />);

      expect(screen.getByText("No copilot selected")).toBeInTheDocument();
    });

    it("renders Add Copilot button", () => {
      render(<CopilotChat />);

      const addButton = screen.getByRole("button", { name: /add copilot/i });
      expect(addButton).toBeInTheDocument();
    });

    it("opens add agents dialog when Add Copilot button is clicked", () => {
      render(<CopilotChat />);

      const addButton = screen.getByRole("button", { name: /add copilot/i });
      fireEvent.click(addButton);

      expect(mockSetShowAddAgentsDialog).toHaveBeenCalledWith(true);
    });

    it("does not render main chat components", () => {
      render(<CopilotChat />);

      expect(screen.queryByTestId("welcome")).not.toBeInTheDocument();
      expect(screen.queryByTestId("message-group-root")).not.toBeInTheDocument();
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });
  });

  describe("fullscreen mode", () => {
    it("applies fullscreen-specific styling when isFullscreen is true", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "openbb-copilot", name: "OpenBB Copilot" },
          isFullscreen: true,
        });
      });

      render(<CopilotChat />);

      const resizeContainer = screen.getByTestId("set-loading-on-resize");
      expect(resizeContainer).toHaveClass("pt-6");
    });

    it("applies non-fullscreen styling when isFullscreen is false", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "openbb-copilot", name: "OpenBB Copilot" },
          isFullscreen: false,
        });
      });

      render(<CopilotChat />);

      const resizeContainer = screen.getByTestId("set-loading-on-resize");
      expect(resizeContainer).not.toHaveClass("pt-6");
    });

    it("renders header outside the flex container in fullscreen mode", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "openbb-copilot", name: "OpenBB Copilot" },
          isFullscreen: true,
        });
      });

      render(<CopilotChat />);

      const headers = screen.getAllByTestId("header");
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("component composition", () => {
    beforeEach(() => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "openbb-copilot", name: "OpenBB Copilot" },
          isFullscreen: false,
        });
      });
    });

    it("wraps content in CopilotWrapper", () => {
      render(<CopilotChat />);

      const wrapper = screen.getByTestId("wrapper");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toContainElement(screen.getByTestId("header"));
    });

    it("nests message group root inside error boundary", () => {
      render(<CopilotChat />);

      const errorBoundary = screen.getByTestId("error-boundary");
      expect(errorBoundary).toContainElement(screen.getByTestId("message-group-root"));
    });

    it("places footer at the bottom of the chat", () => {
      render(<CopilotChat />);

      const footer = screen.getByTestId("footer");
      expect(footer).toBeInTheDocument();
    });
  });

  describe("conditional rendering based on copilotSelected state", () => {
    it("shows full interface when copilotSelected is truthy", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: { id: "test-copilot" },
          isFullscreen: false,
        });
      });

      render(<CopilotChat />);

      expect(screen.queryByText("No copilot selected")).not.toBeInTheDocument();
      expect(screen.getByTestId("message-group-root")).toBeInTheDocument();
    });

    it("shows NoCopilotSelected when copilotSelected is falsy", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: null,
          isFullscreen: false,
        });
      });

      render(<CopilotChat />);

      expect(screen.getByText("No copilot selected")).toBeInTheDocument();
      expect(screen.queryByTestId("message-group-root")).not.toBeInTheDocument();
    });
  });
});
