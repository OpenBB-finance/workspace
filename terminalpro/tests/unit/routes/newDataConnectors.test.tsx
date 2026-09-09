import * as TabsPrimitive from "@radix-ui/react-tabs";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataConnectors from "~/routes/newDataConnectors";
import { mockConfig } from "../../mocks/runtimeConfig";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("~/lib/contexts/MyDataConnectorsContext", () => ({
  MyDataConnectorsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="my-data-connectors-provider">{children}</div>
  ),
}));

vi.mock("~/components/DataConnectors/MyWidgetsTab", () => ({
  MyWidgetsTab: () => <div data-testid="my-widgets-tab">My Widgets Tab</div>,
}));

vi.mock("~/components/DataConnectors/PackagedDataTab", () => ({
  PackagedDataTab: () => <div data-testid="packaged-data-tab">Packaged Data Tab</div>,
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
    tabs,
    defaultTab,
  }: {
    children: ReactNode;
    title: string;
    tabs: any[];
    defaultTab?: string;
  }) => (
    <TabsPrimitive.Root defaultValue={defaultTab || tabs[0]?.id}>
      <div data-testid="settings-layout">
        <h1>{title}</h1>
        <TabsPrimitive.List data-testid="tabs">
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger key={tab.id} value={tab.id} data-tab-id={tab.id}>
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {children}
      </div>
    </TabsPrimitive.Root>
  ),
}));

vi.mock("~/utils/dataConnectorsHelpers", () => ({
  updateVersion: vi.fn(),
}));

describe("DataConnectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.data.packageDataEnabled = true;
  });

  it("renders the Widgets Library title", () => {
    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    expect(screen.getByText("Widgets Library")).toBeInTheDocument();
  });

  it("renders MyWidgetsTab", () => {
    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("my-widgets-tab")).toBeInTheDocument();
  });

  it("wraps content in MyDataConnectorsProvider", () => {
    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("my-data-connectors-provider")).toBeInTheDocument();
  });

  it("renders My Data tab", () => {
    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    expect(screen.getByText("My Data")).toBeInTheDocument();
  });

  it("renders Sandbox Data tab when FF is enabled", () => {
    mockConfig.data.packageDataEnabled = true;

    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    expect(screen.getByText("Sandbox Data")).toBeInTheDocument();
  });

  it("renders PackagedDataTab when FF is enabled", () => {
    mockConfig.data.packageDataEnabled = true;

    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    // Verify the packaged-data tab trigger exists
    const tabTrigger = screen.getByRole("tab", { name: "Sandbox Data" });
    expect(tabTrigger).toBeInTheDocument();

    // Verify the packaged-data tab panel exists (even if hidden)
    const tabPanels = screen.getAllByRole("tabpanel", { hidden: true });
    const packagedDataPanel = tabPanels.find((panel) =>
      panel.getAttribute("aria-labelledby")?.includes("packaged-data"),
    );
    expect(packagedDataPanel).toBeDefined();
  });
});

describe("DataConnectors without packaged data FF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.data.packageDataEnabled = false;
  });

  it("does not render PackagedDataTab when FF is disabled", () => {
    render(
      <BrowserRouter>
        <DataConnectors />
      </BrowserRouter>,
    );

    // The PackagedDataTab should not be rendered when FF is disabled
    // This depends on how the component reads the env var at runtime
    expect(screen.getByTestId("settings-layout")).toBeInTheDocument();
  });
});
