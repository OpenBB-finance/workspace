import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import { ReviewAppDialog } from "~/components/AdminMarketplace/ReviewAppDialog";

vi.mock("~/hooks/useAdminMarketplace", () => ({
  useAppSubscriptions: () => ({
    data: { active_count: 4, total_count: 12 },
    isLoading: false,
  }),
}));

vi.mock("~/components/LayoutAuth/AppCard/AppCard", () => ({
  default: () => <div data-testid="preview-app-card">AppCard</div>,
}));

vi.mock("~/components/Apps/ListedAppCard", () => ({
  ListedAppCard: () => <div data-testid="preview-listed-card">ListedAppCard</div>,
}));

vi.mock("~/components/Apps/ListedAppDetailsContent", () => ({
  ListedAppDetailsContent: () => (
    <div data-testid="preview-details">ListedAppDetailsContent</div>
  ),
}));

function makeApp(overrides: Partial<AdminApp> = {}): AdminApp {
  return {
    id: "app-1",
    vendor_id: "v-1",
    vendor_name: "JoseCompany",
    name: "Options Flow Scanner",
    version: "2",
    short_description: "Pulls live prices from prediction markets.",
    category: "Prediction Markets",
    tagline: "Live odds, Real markets",
    thumbnail_url: null,
    thumbnail_url_dark: null,
    thumbnail_url_light: null,
    media: [],
    screenshots: [],
    api_key_url: null,
    api_key_info_url: null,
    more_information_url: null,
    backend_base_url: "https://openbb-poly.workers.dev",
    apps_json_url: "https://openbb-poly.workers.dev/apps.json",
    widgets_json_url: "https://openbb-poly.workers.dev/widgets.json",
    is_built_in: false,
    auth_type: ["api_key"],
    auth_fields: null,
    status: "development",
    created_date: "2026-01-01T00:00:00Z",
    updated_date: "2026-01-02T00:00:00Z",
    last_fetched_at: null,
    last_fetch_status: "ok",
    last_fetch_error: null,
    last_verified_at: "2026-01-03T00:00:00Z",
    rejection_reason: null,
    widgets_count: 21,
    prompts_count: 0,
    mcp_servers: null,
    verification: null,
    ...overrides,
  };
}

function renderDialog(
  app: AdminApp = makeApp(),
  onAction = vi.fn(),
  actionPending = false,
) {
  return render(
    <ReviewAppDialog
      app={app}
      actionPending={actionPending}
      onClose={vi.fn()}
      onAction={onAction}
    />,
  );
}

describe("ReviewAppDialog", () => {
  it("renders header with by-line and status tag", () => {
    renderDialog();

    expect(screen.getByText("Options Flow Scanner")).toBeInTheDocument();
    expect(screen.getByText(/by:\s*JoseCompany/)).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
  });

  it("renders App Info detail sections and empty counts as dash", () => {
    renderDialog();

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Backend & URLs")).toBeInTheDocument();
    expect(screen.getByText("Admin meta")).toBeInTheDocument();

    expect(screen.getByText("Prediction Markets")).toBeInTheDocument();
    expect(screen.getByText("Live odds, Real markets")).toBeInTheDocument();
    expect(screen.getByText("api_key")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    // prompts_count 0 → "-"
    const promptsRow = screen.getByText("Prompts").closest("div");
    expect(promptsRow).toBeTruthy();
    expect(within(promptsRow!.parentElement as HTMLElement).getAllByText("-").length).toBeGreaterThan(0);

    expect(screen.getByText("https://openbb-poly.workers.dev")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // active subs
    expect(screen.getByText("12")).toBeInTheDocument(); // total subs
  });

  it("lists the custom auth fields a reviewer has to approve", () => {
    renderDialog(
      makeApp({
        auth_type: ["none", "custom"],
        auth_fields: [
          { id: "api_key", label: "API Key", key: "X-Api-Key", prefix: null },
          { id: "account", label: "Account", key: "Authorization", prefix: "Bearer " },
        ],
      }),
    );

    expect(screen.getByText("none, custom")).toBeInTheDocument();
    expect(screen.getByText(/API Key/)).toBeInTheDocument();
    expect(screen.getByText(/X-Api-Key/)).toBeInTheDocument();
    expect(screen.getByText(/Account/)).toBeInTheDocument();
    expect(screen.getByText(/Bearer/)).toBeInTheDocument();
  });

  it("shows the MCP server the listing will expose", () => {
    renderDialog(
      makeApp({
        mcp_servers: [
          {
            name: "POLY MCP",
            description: "OADA",
            url: "https://mcp.example.com/mcp",
            authType: "token",
          },
        ],
      }),
    );

    expect(screen.getByText(/POLY MCP/)).toBeInTheDocument();
    expect(screen.getByText("https://mcp.example.com/mcp")).toBeInTheDocument();
    expect(screen.getByText(/token/)).toBeInTheDocument();
  });

  it("renders auth fields and MCP rows as dashes when the app declares none", () => {
    renderDialog();

    const dashed = ["Auth fields", "MCP server"];
    for (const label of dashed) {
      const row = screen.getByText(label).parentElement as HTMLElement;
      expect(within(row).getByText("-")).toBeInTheDocument();
    }
  });

  it("switches to Final Preview with the same modes as submission preview", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: "Final Preview" }));

    expect(screen.getByText("Preview as")).toBeInTheDocument();
    // Default mode matches SubmissionPreview default (marketplace)
    expect(screen.getByTestId("preview-listed-card")).toBeInTheDocument();
  });

  it("places outlined utility actions left and decision actions right", () => {
    renderDialog();

    const reverify = screen.getByRole("button", { name: /Re-verify/i });
    const remove = screen.getByRole("button", { name: /Remove/i });
    const reject = screen.getByRole("button", { name: /^Reject$/i });
    const publish = screen.getByRole("button", { name: /^Publish$/i });

    expect(reverify).toBeEnabled();
    expect(remove).toBeEnabled();
    expect(reject).toBeEnabled();
    expect(publish).toBeEnabled();

    // Publish is the primary decision; reject secondary — both on the right group.
    const footer = reverify.closest(".border-t") ?? reverify.parentElement?.parentElement;
    expect(footer).toBeTruthy();
  });

  it("fires onAction when Publish is clicked", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const app = makeApp();
    renderDialog(app, onAction);

    await user.click(screen.getByRole("button", { name: /^Publish$/i }));
    expect(onAction).toHaveBeenCalledWith(app, "publish");
  });

  it("shows rejection reason when present", () => {
    renderDialog(makeApp({ rejection_reason: "Missing screenshots" }));
    expect(screen.getByText(/Missing screenshots/)).toBeInTheDocument();
  });
});
