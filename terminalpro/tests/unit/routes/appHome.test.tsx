import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";
import MenuHomePage, { Card, DialogVideo } from "~/routes/appHome";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("~/components/LayoutAuth/WelcomeMessage", () => ({
  default: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    tier: string;
    isHelpPage: boolean;
  }) =>
    open ? (
      <div data-testid="welcome-message">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title?: string;
  }) => (
    <div data-testid="settings-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({
    children,
    open,
    onClose,
  }: {
    children: ReactNode;
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="base-dialog">
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Content: ({ children, value }: { children: ReactNode; value: string }) => (
    <div role="tabpanel" data-value={value}>
      {children}
    </div>
  ),
}));

describe("MenuHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.ui.showExternalDocLinks = true;
  });

  it("renders the Help and Documentation title", () => {
    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Help and Documentation")).toBeInTheDocument();
  });

  it("renders the Interactive Walkthrough card", () => {
    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Interactive Walkthrough")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start walkthrough/i }),
    ).toBeInTheDocument();
  });

  it("shows welcome message when Start Walkthrough is clicked", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    await user.click(screen.getByRole("button", { name: /start walkthrough/i }));

    expect(screen.getByTestId("welcome-message")).toBeInTheDocument();
  });

  it("closes welcome message when close button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    await user.click(screen.getByRole("button", { name: /start walkthrough/i }));
    expect(screen.getByTestId("welcome-message")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("welcome-message")).not.toBeInTheDocument();
  });

  it("renders documentation link when FF is enabled", () => {
    mockConfig.ui.showExternalDocLinks = true;

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Workspace Documentation")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /read documentation/i }),
    ).toBeInTheDocument();
  });

  it("renders external link icon on documentation button", () => {
    mockConfig.ui.showExternalDocLinks = true;

    render(
      <BrowserRouter>
        <MenuHomePage />
      </BrowserRouter>,
    );

    const docLink = screen.getByRole("link", { name: /read documentation/i });
    expect(docLink).toHaveAttribute("href", "https://docs.openbb.co/workspace");
    expect(docLink).toHaveAttribute("target", "_blank");

    const externalIcon = screen.getByTestId("icon-external-link-icon");
    expect(externalIcon).toBeInTheDocument();
    expect(docLink).toContainElement(externalIcon);
  });
});

describe("Card Component", () => {
  it("renders with title", () => {
    render(<Card title="Test Title">Card Content</Card>);

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  it("renders without title", () => {
    render(<Card>Card Content Only</Card>);

    expect(screen.getByText("Card Content Only")).toBeInTheDocument();
  });

  it("renders with action title", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Card title="Card Title" actionTitle={{ element: <span>Action</span>, onClick }}>
        Content
      </Card>,
    );

    const actionButton = screen.getByText("Action");
    expect(actionButton).toBeInTheDocument();

    await user.click(actionButton);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies extra className", () => {
    const { container } = render(<Card extraClassname="custom-class">Content</Card>);

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("custom-class");
  });
});

describe("DialogVideo Component", () => {
  it("renders thumbnail image", () => {
    render(<DialogVideo videoUrl="/video.mp4" thumbnail="/thumb.jpg" />);

    const thumbnail = screen.getByRole("img");
    expect(thumbnail).toHaveAttribute("src", "/thumb.jpg");
  });

  it("renders play button", () => {
    render(<DialogVideo videoUrl="/video.mp4" thumbnail="/thumb.jpg" />);

    const playButton = screen.getByRole("button", { name: /watch the video/i });
    expect(playButton).toBeInTheDocument();
  });

  it("opens dialog when clicking on thumbnail", async () => {
    const user = userEvent.setup();

    render(<DialogVideo videoUrl="/video.mp4" thumbnail="/thumb.jpg" />);

    await user.click(screen.getByRole("button", { name: /watch the video/i }));

    expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
  });

  it("closes dialog when clicking close button", async () => {
    const user = userEvent.setup();

    render(<DialogVideo videoUrl="/video.mp4" thumbnail="/thumb.jpg" />);

    await user.click(screen.getByRole("button", { name: /watch the video/i }));
    expect(screen.getByTestId("base-dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();
  });
});
