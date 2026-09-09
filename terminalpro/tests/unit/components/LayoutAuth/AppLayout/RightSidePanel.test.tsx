import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSetMobileCopilotDrawer = vi.fn();
let mockMobileState = {
  mobileCopilotDrawer: false,
  setMobileCopilotDrawer: mockSetMobileCopilotDrawer,
};

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({ copilot: { enabled: true } }),
}));

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: vi.fn((selector: (s: typeof mockMobileState) => unknown) =>
    selector(mockMobileState),
  ),
}));

vi.mock("~/components/AI/CopilotChat", () => ({
  default: () => <div data-testid="copilot-chat">CopilotChat</div>,
}));

vi.mock("~/components/AI", () => ({
  CopilotChatErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  CopilotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useStreamingStore: { getState: () => ({ dispatch: vi.fn() }) },
}));

vi.mock("~/components/General/Table/hooks/utils", () => ({
  useIsFirstRender: () => false,
}));

vi.mock("~/components/ui/EdgeHoverZone", () => ({
  EdgeHoverZone: () => null,
}));

vi.mock("~/components/ui/Resizable", () => ({
  ResizableHandle: () => null,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("~/lib/state/copilot", () => ({
  useCopilotStore: { getState: () => ({}) },
  useShallowCopilotStore: vi.fn(() => ({})),
}));

vi.mock("~/components/AI/hooks/useCopilotAvailable", () => ({
  useCopilotAvailable: () => true,
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(() => false),
}));

vi.mock("./hooks/usePanelsState", () => ({
  useLayoutPanelsState: () => [{}, vi.fn()],
}));

import { MobileRightSidePanel } from "~/components/LayoutAuth/AppLayout/RightSidePanel";

describe("MobileRightSidePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMobileState = {
      mobileCopilotDrawer: false,
      setMobileCopilotDrawer: mockSetMobileCopilotDrawer,
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders #expand-copilot-mobile-btn in DOM when drawer is closed", () => {
    const { container } = render(<MobileRightSidePanel />);

    const btn = container.querySelector("#expand-copilot-mobile-btn");
    expect(btn).not.toBeNull();
    expect(btn?.tagName).toBe("BUTTON");
    expect(screen.queryByTestId("copilot-chat")).not.toBeInTheDocument();
  });

  it("clicking #expand-copilot-mobile-btn opens the drawer", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileRightSidePanel />);

    const btn = container.querySelector("#expand-copilot-mobile-btn");
    expect(btn).not.toBeNull();
    await user.click(btn as HTMLElement);

    expect(mockSetMobileCopilotDrawer).toHaveBeenCalledWith(true);
  });

  it("renders the drawer + CopilotChat when mobileCopilotDrawer is true", () => {
    mockMobileState = {
      mobileCopilotDrawer: true,
      setMobileCopilotDrawer: mockSetMobileCopilotDrawer,
    };

    const { container } = render(<MobileRightSidePanel />);

    expect(container.querySelector("#expand-copilot-mobile-btn")).not.toBeNull();
    expect(screen.getByTestId("copilot-chat")).toBeInTheDocument();
  });
});
