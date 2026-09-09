import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListedAppCard } from "~/components/Apps/ListedAppCard";
import type { ListedApp } from "~/types/listedApps";

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: unknown[]) =>
    (args as (string | boolean | null | undefined)[]).filter(Boolean).join(" "),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

let mockTheme: "light" | "dark" = "light";

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (s: { theme: "light" | "dark" }) => unknown) =>
    selector({ theme: mockTheme }),
}));

const baseApp: ListedApp = {
  id: "app-1",
  vendorName: "Acme Corp",
  appName: "Acme Data",
  description: "A great data application",
  backendUrl: "https://example.com",
  thumbnail: "https://example.com/thumb.png",
  widgets: [],
};

describe("ListedAppCard", () => {
  beforeEach(() => {
    mockTheme = "light";
    vi.clearAllMocks();
  });

  it("renders appName as heading and description", () => {
    render(
      <ListedAppCard app={baseApp} isSubscribed={false} onOpenDetails={vi.fn()} />,
    );

    expect(screen.getByText("Acme Data")).toBeInTheDocument();
    expect(screen.getByText("A great data application")).toBeInTheDocument();
  });

  it("renders cover image from vendorThumbnailUrl when present", () => {
    const app: ListedApp = {
      ...baseApp,
      vendorThumbnailUrl: "https://example.com/vendor.png",
      thumbnailDark: "https://example.com/dark.png",
      thumbnailLight: "https://example.com/light.png",
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/vendor.png");
  });

  it("uses thumbnailLight in light theme when no vendorThumbnailUrl", () => {
    mockTheme = "light";
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "https://example.com/thumb.png",
      thumbnailLight: "https://example.com/light.png",
      thumbnailDark: "https://example.com/dark.png",
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/light.png",
    );
  });

  it("uses thumbnailDark in dark theme when no vendorThumbnailUrl", () => {
    mockTheme = "dark";
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "https://example.com/thumb.png",
      thumbnailLight: "https://example.com/light.png",
      thumbnailDark: "https://example.com/dark.png",
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/dark.png",
    );
  });

  it("falls back to thumbnail when theme-specific image is missing in light theme", () => {
    mockTheme = "light";
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "https://example.com/thumb.png",
      thumbnailLight: undefined,
      thumbnailDark: undefined,
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/thumb.png",
    );
  });

  it("falls back to thumbnail when theme-specific image is missing in dark theme", () => {
    mockTheme = "dark";
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "https://example.com/thumb.png",
      thumbnailLight: undefined,
      thumbnailDark: undefined,
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/thumb.png",
    );
  });

  it("renders vendor initials when there is no image src", () => {
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "",
      thumbnailLight: "",
      thumbnailDark: "",
      vendorThumbnailUrl: undefined,
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("renders max 2 chars uppercase vendor initials", () => {
    const app: ListedApp = {
      ...baseApp,
      vendorName: "Alpha Beta Gamma",
      thumbnail: "",
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("renders vendor initials when image fails to load", () => {
    const app: ListedApp = {
      ...baseApp,
      thumbnail: "https://example.com/thumb.png",
    };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("shows Included badge when app.isBuiltIn is true", () => {
    const app: ListedApp = { ...baseApp, isBuiltIn: true };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("shows Connected badge when isSubscribed is true and not built-in", () => {
    render(<ListedAppCard app={baseApp} isSubscribed={true} onOpenDetails={vi.fn()} />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("Included")).not.toBeInTheDocument();
  });

  it("shows no status badge when not subscribed and not built-in", () => {
    render(
      <ListedAppCard app={baseApp} isSubscribed={false} onOpenDetails={vi.fn()} />,
    );

    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.queryByText("Included")).not.toBeInTheDocument();
  });

  it("shows View Details button when subscribed", () => {
    render(<ListedAppCard app={baseApp} isSubscribed={true} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("button", { name: "View Details" })).toBeInTheDocument();
  });

  it("shows View Details button when built-in", () => {
    const app: ListedApp = { ...baseApp, isBuiltIn: true };

    render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

    expect(screen.getByRole("button", { name: "View Details" })).toBeInTheDocument();
  });

  it("shows Connect App button when not subscribed and not built-in", () => {
    render(
      <ListedAppCard app={baseApp} isSubscribed={false} onOpenDetails={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Connect App" })).toBeInTheDocument();
  });

  it("clicking the card root calls onOpenDetails", async () => {
    const onOpenDetails = vi.fn();
    const user = userEvent.setup();

    render(
      <ListedAppCard
        app={baseApp}
        isSubscribed={false}
        onOpenDetails={onOpenDetails}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const card = buttons.find(
      (el) => el.getAttribute("tabindex") === "0",
    ) as HTMLElement;
    await user.click(card);

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("clicking the inner button calls onOpenDetails exactly once without double-triggering", async () => {
    const onOpenDetails = vi.fn();
    const user = userEvent.setup();

    render(
      <ListedAppCard
        app={baseApp}
        isSubscribed={false}
        onOpenDetails={onOpenDetails}
      />,
    );

    const btn = screen.getByRole("button", { name: "Connect App" });
    await user.click(btn);

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("pressing Enter on the card root calls onOpenDetails", async () => {
    const onOpenDetails = vi.fn();
    const user = userEvent.setup();

    render(
      <ListedAppCard
        app={baseApp}
        isSubscribed={false}
        onOpenDetails={onOpenDetails}
      />,
    );

    const card = screen.getAllByRole("button")[0];
    card.focus();
    await user.keyboard("{Enter}");

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("pressing Space on the card root calls onOpenDetails", async () => {
    const onOpenDetails = vi.fn();
    const user = userEvent.setup();

    render(
      <ListedAppCard
        app={baseApp}
        isSubscribed={false}
        onOpenDetails={onOpenDetails}
      />,
    );

    const card = screen.getAllByRole("button")[0];
    card.focus();
    await user.keyboard(" ");

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  describe("New tag", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-13T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows 'New' tag when createdDate is within the last 7 days", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "2026-05-08T15:50:03Z", // ~5 days before now
      };

      render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("shows 'New' tag at exactly 7 days old", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "2026-05-06T12:00:00Z", // exactly 7 days before now
      };

      render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("does NOT show 'New' tag when createdDate is older than 7 days", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "2026-05-01T12:00:00Z", // 12 days before now
      };

      render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("does NOT show 'New' tag when createdDate is missing", () => {
      render(
        <ListedAppCard app={baseApp} isSubscribed={false} onOpenDetails={vi.fn()} />,
      );

      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("does NOT show 'New' tag when createdDate is invalid", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "not-a-date",
      };

      render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("does NOT show 'New' tag when app is already subscribed", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "2026-05-08T15:50:03Z",
      };

      render(<ListedAppCard app={app} isSubscribed={true} onOpenDetails={vi.fn()} />);

      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("does NOT show 'New' tag when app is built-in", () => {
      const app: ListedApp = {
        ...baseApp,
        createdDate: "2026-05-08T15:50:03Z",
        isBuiltIn: true,
      };

      render(<ListedAppCard app={app} isSubscribed={false} onOpenDetails={vi.fn()} />);

      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });
  });

  describe("Lite mode (browse-only)", () => {
    it("shows View Details instead of Connect App when isLite and not subscribed", () => {
      render(
        <ListedAppCard
          app={baseApp}
          isSubscribed={false}
          onOpenDetails={vi.fn()}
          isLite
        />,
      );

      expect(
        screen.getByRole("button", { name: "View Details" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Connect App" }),
      ).not.toBeInTheDocument();
    });

    it("clicking View Details in lite calls onOpenDetails", async () => {
      const onOpenDetails = vi.fn();
      const user = userEvent.setup();

      render(
        <ListedAppCard
          app={baseApp}
          isSubscribed={false}
          onOpenDetails={onOpenDetails}
          isLite
        />,
      );

      await user.click(screen.getByRole("button", { name: "View Details" }));

      expect(onOpenDetails).toHaveBeenCalledTimes(1);
    });
  });
});
