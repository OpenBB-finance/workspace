import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/Resizable";

vi.mock("react-resizable-panels", () => ({
  Panel: ({ children, className, ...props }: any) => (
    <div data-testid="panel" className={className} {...props}>
      {children}
    </div>
  ),
  PanelGroup: ({ children, className, ...props }: any) => (
    <div data-testid="panel-group" className={className} {...props}>
      {children}
    </div>
  ),
  PanelResizeHandle: ({ children, className, ...props }: any) => (
    <div data-testid="panel-resize-handle" className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: () => ({
    isFullscreen: false,
  }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => false,
}));

vi.mock("~/components/LayoutAuth/AppLayout/hooks/usePanelsState", () => ({
  usePanelsState: () => false,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: any) => (
    <div data-testid="tooltip" data-message={message}>
      {children}
    </div>
  ),
}));

describe("Resizable Components", () => {
  describe("ResizablePanelGroup", () => {
    it("renders panel group with children", () => {
      render(
        <ResizablePanelGroup direction="horizontal">
          <div>Child content</div>
        </ResizablePanelGroup>,
      );

      expect(screen.getByTestId("panel-group")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("renders panel group structure correctly", () => {
      render(
        <ResizablePanelGroup direction="horizontal" className="custom-class">
          <div>Content</div>
        </ResizablePanelGroup>,
      );

      // The component wraps children in a panel group
      expect(screen.getByTestId("panel-group")).toBeInTheDocument();
    });
  });

  describe("ResizablePanel", () => {
    it("renders panel with children", () => {
      render(
        <ResizablePanel>
          <div>Panel content</div>
        </ResizablePanel>,
      );

      expect(screen.getByTestId("panel")).toBeInTheDocument();
      expect(screen.getByText("Panel content")).toBeInTheDocument();
    });

    it("applies className to panel", () => {
      render(
        <ResizablePanel className="panel-class">
          <div>Content</div>
        </ResizablePanel>,
      );

      expect(screen.getByTestId("panel")).toHaveClass("panel-class");
    });
  });

  describe("ResizableHandle", () => {
    it("renders resize handle", () => {
      render(<ResizableHandle />);

      expect(screen.getByTestId("panel-resize-handle")).toBeInTheDocument();
    });

    it("renders handle for left type", () => {
      render(<ResizableHandle type="left" withHandle={true} collapsed={true} />);

      expect(screen.getByTestId("panel-resize-handle")).toBeInTheDocument();
    });

    it("renders handle for right type", () => {
      render(<ResizableHandle type="right" withHandle={true} collapsed={true} />);

      expect(screen.getByTestId("panel-resize-handle")).toBeInTheDocument();
    });

    it("shows different icon when collapsed on left", () => {
      render(<ResizableHandle type="left" withHandle={true} collapsed={true} />);

      // When collapsed on left, should show layout icon
      expect(screen.getByTestId("icon-layout")).toBeInTheDocument();
    });

    it("shows different icon when collapsed on right", () => {
      render(<ResizableHandle type="right" withHandle={true} collapsed={true} />);

      // When collapsed on right, should show sparkles icon
      expect(screen.getByTestId("icon-sparkles-icon")).toBeInTheDocument();
    });

    it("shows tooltip when collapsed with handle", () => {
      render(<ResizableHandle type="left" withHandle={true} collapsed={true} />);

      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<ResizableHandle className="custom-handle" />);

      expect(screen.getByTestId("panel-resize-handle")).toHaveClass("custom-handle");
    });
  });
});
