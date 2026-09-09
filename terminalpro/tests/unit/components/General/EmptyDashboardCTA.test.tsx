import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FileProvider } from "~/components/DataConnectors/FileProvider";
import { useDataConnectorContext } from "~/components/DataConnectors/Providers/DataConnectorContext";
import EmptyDashboardCTA from "~/components/General/EmptyDashboardCTA";
import { TabProvider } from "~/lib/contexts/TabContext";
import { useShallowThemeStore } from "~/lib/state/theme";

// Mock dependencies
vi.mock("~/components/DataConnectors/Providers/DataConnectorContext", () => ({
  useDataConnectorContext: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

describe("EmptyDashboardCTA Component", () => {
  const mockSetOpen = vi.fn();
  const mockChangeSearch = vi.fn();
  const mockSetInitialSelectedSearchTab = vi.fn();
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
    (useDataConnectorContext as Mock).mockReturnValue({
      setOpen: mockSetOpen,
    });
    (useShallowThemeStore as Mock).mockReturnValue({
      changeSearch: mockChangeSearch,
      setInitialSelectedSearchTab: mockSetInitialSelectedSearchTab,
    });
  });

  const renderWithQueryClient = (ui: React.ReactElement) =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <TabProvider currentTab="" tabId="test-tab" layouts={[]}>
            <FileProvider>{ui}</FileProvider>
          </TabProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

  it("renders the component correctly", () => {
    renderWithQueryClient(<EmptyDashboardCTA />);
    const widgetTitle = screen.queryAllByText("Add Widgets");
    const templateTitle = screen.queryAllByText("Browse Apps");
    const filesTitle = screen.queryAllByText("Add your files");
    expect(widgetTitle[0]).toBeInTheDocument();
    expect(templateTitle[0]).toBeInTheDocument();
    expect(filesTitle[0]).toBeInTheDocument();
  });

  it("opens widget search on button click", () => {
    renderWithQueryClient(<EmptyDashboardCTA />);
    const addConnectionButtons = screen.queryAllByRole("button", {
      name: "Add widgets",
    });
    fireEvent.click(addConnectionButtons[0]);
    expect(mockChangeSearch).toHaveBeenCalledWith(true);
  });

  it("opens templates dialog on button click", () => {
    renderWithQueryClient(<EmptyDashboardCTA />);
    const addTemplateButtons = screen.queryAllByRole("button", {
      name: "Browse apps",
    });
    const addTemplateButton = addTemplateButtons[0];
    // Expect the button to be in the document
    expect(addTemplateButton).toBeInTheDocument();
  });
});
