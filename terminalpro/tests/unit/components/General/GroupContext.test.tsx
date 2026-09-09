import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { type Mock, describe, expect, it, vi } from "vitest";
import { DataConnectorProvider } from "~/components/DataConnectors/Providers/DataConnectorProvider";
import GroupContext from "~/components/General/GroupContext";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowThemeStore } from "~/lib/state/theme";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  keepPreviousData: vi.fn(),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
  useAppStore: {
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: vi.fn(),
}));

vi.mock(
  "~/components/DataConnectors/Providers/DataConnectorProvider",
  async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
      ...actual,
      useDataConnectorContext: () => ({
        setOpen: vi.fn(),
      }),
    };
  },
);

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: vi.fn(() => ({
    getDashboardById: vi.fn().mockReturnValue({
      data: {
        widgets: [
          {
            id: "widget1",
            name: "Widget 1",
            connectionType: "advanced-backend",
            sourceName: "testSource",
          },
          {
            id: "widget2",
            name: "Widget 2",
            connectionType: "advanced-backend",
            sourceName: "testSource",
          },
        ],
      },
    }),
  })),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    isTabPath: vi.fn().mockReturnValue(true),
  };
});

describe("GroupContext Component", () => {
  const mockAddWidgets = vi.fn();
  const mockUpdateApiSource = vi
    .fn()
    .mockResolvedValue({ widgets: {}, errorMessage: null });
  const mockSetExportTemplatePopup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useShallowSharedAppStore).mockReturnValue(false);

    vi.mocked(useShallowAppStore).mockReturnValue({
      addWidgets: mockAddWidgets,
      getTabById: () => ({
        data: {
          widgets: [
            {
              id: "widget1",
              name: "Widget 1",
              connectionType: "advanced-backend",
              sourceName: "testSource1",
            },
            {
              id: "widget2",
              name: "Widget 2",
              connectionType: "advanced-backend",
              sourceName: "testSource2",
            },
          ],
        },
      }),
      getDashboardById: vi.fn().mockReturnValue({
        data: {
          widgets: [
            { id: "widget1", name: "Widget 1" },
            { id: "widget2", name: "Widget 2" },
          ],
        },
      }),
    });

    (useQuery as Mock).mockReturnValue({
      data: {},
      isLoading: false,
      isError: false,
      error: null,
      status: "success",
      isSuccess: true,
    });

    vi.mocked(useShallowBackendConnectorStore).mockReturnValue({
      apiSources: [
        {
          name: "testSource1",
          widgets: [
            {
              id: "widget1",
              name: "Widget 1",
              connectionType: "advanced-backend",
              sourceName: "testSource1",
            },
          ],
        },
        {
          name: "testSource2",
          widgets: [
            {
              id: "widget2",
              name: "Widget 2",
              connectionType: "advanced-backend",
              sourceName: "testSource2",
            },
          ],
        },
      ],
      updateApiSource: mockUpdateApiSource,
    });

    vi.mocked(useShallowThemeStore).mockReturnValue({
      setExportTemplatePopup: mockSetExportTemplatePopup,
    });
  });

  it("renders with default props", () => {
    render(
      <BrowserRouter>
        <DataConnectorProvider>
          <GroupContext>
            <div>Test Content</div>
          </GroupContext>
        </DataConnectorProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("handles 'Add markdown note' click", async () => {
    render(
      <BrowserRouter>
        <DataConnectorProvider>
          <GroupContext>
            <div>Test Content</div>
          </GroupContext>
        </DataConnectorProvider>
      </BrowserRouter>,
    );

    // Simulate right-click on the "Test Content"
    await userEvent.pointer({
      target: screen.getByText("Test Content"),
      keys: "[MouseRight]",
    });

    // Now find and click the "Add markdown note" option
    await userEvent.click(await screen.findByText("Add markdown note"));

    await waitFor(() => {
      expect(mockAddWidgets).toHaveBeenCalled();
    });
  });

  it("handles 'Add widgets' click", async () => {
    render(
      <BrowserRouter>
        <DataConnectorProvider>
          <GroupContext>
            <div>Test Content</div>
          </GroupContext>
        </DataConnectorProvider>
      </BrowserRouter>,
    );

    await userEvent.pointer({
      target: screen.getByText("Test Content"),
      keys: "[MouseRight]",
    });

    expect(await screen.findByText("Add widgets")).toBeInTheDocument();
  });

  it("Refresh backends should not show", async () => {
    render(
      <BrowserRouter>
        <DataConnectorProvider>
          <GroupContext>
            <div>Test Content</div>
          </GroupContext>
        </DataConnectorProvider>
      </BrowserRouter>,
    );

    await userEvent.pointer({
      target: screen.getByText("Test Content"),
      keys: "[MouseRight]",
    });

    expect(screen.queryByText("Refresh Backends")).not.toBeInTheDocument();
  });

  it("Export template should not show", async () => {
    render(
      <BrowserRouter>
        <DataConnectorProvider>
          <GroupContext>
            <div>Test Content</div>
          </GroupContext>
        </DataConnectorProvider>
      </BrowserRouter>,
    );

    await userEvent.click(screen.getByText("Test Content"));
    await userEvent.pointer({
      target: screen.getByText("Test Content"),
      keys: "[MouseRight]",
    });

    expect(screen.queryByText("Export Template")).not.toBeInTheDocument();
  });

  // TODO: Add tests for Refresh Backend and Export Template - I dont know how to get backendSources to be > 0
});
