import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedTemplate } from "~/hooks/useAllTemplates";
import type { Source } from "~/lib/state/backendConnector";

let mockSource: Source | null = null;

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (s: any) => any) =>
    selector({
      theme: "light",
      setEditAppDialog: vi.fn(),
      setShareUserAppsPopupId: vi.fn(),
    }),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: (selector: (s: any) => any) =>
    selector({ featureFlags: { tier: "pro" } }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: (s: any) => any) =>
    selector({
      getApiSourceById: () => mockSource,
      refreshApiSourceById: vi.fn(),
    }),
}));

vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: (selector: (s: any) => any) =>
    selector({ servers: [], getMCPConnection: () => undefined }),
}));

vi.mock("~/lib/runtimeConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/runtimeConfig")>();
  return {
    ...actual,
    getConfig: () => {
      const config = actual.getConfig();
      return {
        ...config,
        whiteLabel: {
          ...config.whiteLabel,
          leftSidebarLogo: "",
          name: "OpenBB Workspace",
        },
        ui: {
          ...config.ui,
          odpDownloadInstaller: false,
        },
      };
    },
  };
});

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    inSnowflakeNativeApp: false,
  };
});

vi.mock("~/lib/appSubmissionFlag", () => ({
  useCanSubmitApp: () => false,
}));

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: unknown[]) =>
    (args as any[])
      .flatMap((a) =>
        typeof a === "object" && a !== null && !Array.isArray(a)
          ? Object.entries(a)
              .filter(([, v]) => v)
              .map(([k]) => k)
          : a,
      )
      .filter(Boolean)
      .join(" "),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/HoverPopover", () => ({
  HoverPopover: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/General/Avatar", () => ({
  AuthenticatedAvatar: () => <div data-testid="avatar" />,
}));

vi.mock("~/components/General/FeatureLock", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/ds/dialogs/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
}));

vi.mock("~/components/AI/WidgetTooltipItem", () => ({
  WidgetTooltipItem: () => null,
}));

vi.mock("~/components/AdminRoles/AddUsersSelect", () => ({
  getUserInitials: () => "U",
}));

vi.mock("~/components/Apps/McpAppPopover", () => ({
  McpAppPopover: () => null,
}));

vi.mock("./AppCardDropdown", () => ({
  AppCardDropdown: () => null,
}));

vi.mock("./PopoverContent", () => ({
  PopoverContent: () => null,
}));

vi.mock("./SharedWithPopover", () => ({
  SharedWithPopover: () => null,
}));

vi.mock("./Tag", () => ({ Tag: () => null }));

import AppCard from "~/components/LayoutAuth/AppCard/AppCard";

function makeTemplate(type: UnifiedTemplate["type"], sourceId = "src"): UnifiedTemplate {
  return {
    id: "tpl",
    name: "Tpl",
    description: "desc",
    type,
    widgets: [],
    prompts: [],
    onClick: vi.fn(),
    source: { id: sourceId, name: "src", url: "", endpointHeaders: [] } as any,
  };
}

function makeSource(status: Source["status"]): Source {
  return {
    id: "src",
    uuid: "src",
    name: "src",
    url: "https://x.com",
    endpointHeaders: [],
    status,
  };
}

function getCardEl(container: HTMLElement) {
  return container.querySelector('[role="button"]') as HTMLElement;
}

describe("AppCard isBackendLoading", () => {
  beforeEach(() => {
    mockSource = null;
  });

  it("does NOT show loading opacity when source.status is rehydrated", () => {
    mockSource = makeSource("rehydrated");
    const { container } = render(
      <MemoryRouter>
        <AppCard template={makeTemplate("listed")} setDeleteConfirm={vi.fn()} />
      </MemoryRouter>,
    );
    const card = getCardEl(container);
    expect(card.className).not.toContain("opacity-50");
    expect(card.className).not.toContain("cursor-wait");
  });

  it("does NOT show loading opacity when source.status is success", () => {
    mockSource = makeSource("success");
    const { container } = render(
      <MemoryRouter>
        <AppCard template={makeTemplate("listed")} setDeleteConfirm={vi.fn()} />
      </MemoryRouter>,
    );
    const card = getCardEl(container);
    expect(card.className).not.toContain("opacity-50");
  });

  it("shows loading opacity when source.status is pending", () => {
    mockSource = makeSource("pending");
    const { container } = render(
      <MemoryRouter>
        <AppCard template={makeTemplate("listed")} setDeleteConfirm={vi.fn()} />
      </MemoryRouter>,
    );
    const card = getCardEl(container);
    expect(card.className).toContain("opacity-50");
    expect(card.className).toContain("cursor-wait");
  });

  it("does NOT show loading opacity for non-listed template with no status (hydrated user app)", () => {
    mockSource = makeSource(undefined);
    const { container } = render(
      <MemoryRouter>
        <AppCard template={makeTemplate("user")} setDeleteConfirm={vi.fn()} />
      </MemoryRouter>,
    );
    const card = getCardEl(container);
    expect(card.className).not.toContain("opacity-50");
  });

  it("does NOT show loading opacity for listed template with undefined status (was buggy before)", () => {
    mockSource = makeSource(undefined);
    const { container } = render(
      <MemoryRouter>
        <AppCard template={makeTemplate("listed")} setDeleteConfirm={vi.fn()} />
      </MemoryRouter>,
    );
    const card = getCardEl(container);
    expect(card.className).not.toContain("opacity-50");
  });
});
