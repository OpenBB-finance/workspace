import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminThemeSettings from "~/routes/admin/themeSettings";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("~/lib/state/tableChartThemes", () => ({
  useShallowTableChartThemesStore: vi.fn((selector: any) =>
    selector({ updateThemeSettings: vi.fn() }),
  ),
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
    tabs,
  }: {
    children: ReactNode;
    title: string;
    tabs: any[];
  }) => (
    <div data-testid="settings-layout">
      <h1>{title}</h1>
      <div data-testid="tabs">
        {tabs.map((tab) => (
          <button key={tab.id} data-tab-id={tab.id}>
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  ),
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Content: ({ children, value }: { children: ReactNode; value: string }) => (
    <div role="tabpanel" data-value={value}>
      {children}
    </div>
  ),
}));

vi.mock("~/components/ThemeSettings/TableSettings", () => ({
  TableSettings: () => <div data-testid="table-settings">Table Settings Component</div>,
}));

vi.mock("~/components/ThemeSettings/ChartSettings", () => ({
  ChartSettings: () => <div data-testid="chart-settings">Chart Settings Component</div>,
}));

vi.mock("~/components/ThemeSettings/GroupingSettings", () => ({
  GroupingSettings: () => (
    <div data-testid="grouping-settings">Grouping Settings Component</div>
  ),
}));

describe("AdminThemeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Theme Settings title", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByText("Theme Settings")).toBeInTheDocument();
  });

  it("renders the Tables tab", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByText("Tables")).toBeInTheDocument();
  });

  it("renders the Charts tab", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByText("Charts")).toBeInTheDocument();
  });

  it("renders the Grouping tab", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByText("Grouping")).toBeInTheDocument();
  });

  it("renders the TableSettings component", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("table-settings")).toBeInTheDocument();
  });

  it("renders the ChartSettings component", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("chart-settings")).toBeInTheDocument();
  });

  it("renders the GroupingSettings component", () => {
    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("grouping-settings")).toBeInTheDocument();
  });

  it("calls updateThemeSettings on mount", async () => {
    const { useShallowTableChartThemesStore } = await import(
      "~/lib/state/tableChartThemes"
    );
    const updateThemeSettings = vi.fn();

    vi.mocked(useShallowTableChartThemesStore).mockImplementation((selector: any) =>
      selector({ updateThemeSettings }),
    );

    render(
      <BrowserRouter>
        <AdminThemeSettings />
      </BrowserRouter>,
    );

    expect(updateThemeSettings).toHaveBeenCalled();
  });
});
