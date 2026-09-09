import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardTabStrip from "~/components/LayoutAuth/Mobile/DashboardTabStrip";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn((selector) =>
    selector({
      items: {},
    }),
  ),
}));

vi.mock("~/lib/utils", () => ({
  cn: vi.fn((...args: any[]) => args.filter(Boolean).join(" ")),
  beautifySlug: vi.fn((s: string) => s),
}));

const makeTabs = (overrides: Partial<{ index: string; isFolder: boolean; data: { name: string } | null }>[]) =>
  Object.fromEntries(
    overrides.map((o, i) => {
      const index = o.index ?? `tab-${i}`;
      return [
        index,
        {
          index,
          isFolder: o.isFolder ?? false,
          data: o.data !== undefined ? o.data : { name: `Tab ${i}` },
        },
      ];
    }),
  );

function renderWithRoute(id: string | null) {
  const path = id ? `/app/${id}` : "/app";
  const routePattern = id ? "/app/:id" : "/app";

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePattern} element={<DashboardTabStrip />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardTabStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no id param is present", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([{ index: "tab-0" }, { index: "tab-1" }]),
      }),
    );

    const { container } = renderWithRoute(null);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when only one tab exists", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([{ index: "tab-0" }]),
      }),
    );

    const { container } = renderWithRoute("tab-0");

    expect(container.firstChild).toBeNull();
  });

  it("renders tab buttons when multiple tabs exist and id is present", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "Dashboard A" } },
          { index: "tab-1", data: { name: "Dashboard B" } },
        ]),
      }),
    );

    renderWithRoute("tab-0");

    expect(screen.getByText("Dashboard A")).toBeInTheDocument();
    expect(screen.getByText("Dashboard B")).toBeInTheDocument();
  });

  it("active tab has primary button styling", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    const { cn } = await import("~/lib/utils");

    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "Active Tab" } },
          { index: "tab-1", data: { name: "Inactive Tab" } },
        ]),
      }),
    );

    const cnMock = cn as Mock;
    cnMock.mockClear();

    renderWithRoute("tab-0");

    const activeCall = cnMock.mock.calls.find((args) =>
      args.includes("bg-btn-primary-bg text-btn-primary-label"),
    );
    expect(activeCall).toBeDefined();
  });

  it("inactive tab has secondary styling", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    const { cn } = await import("~/lib/utils");

    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "Active Tab" } },
          { index: "tab-1", data: { name: "Inactive Tab" } },
        ]),
      }),
    );

    const cnMock = cn as Mock;
    cnMock.mockClear();

    renderWithRoute("tab-0");

    const inactiveCall = cnMock.mock.calls.find((args) =>
      args.includes("bg-general-bg-secondary text-ds-text-body"),
    );
    expect(inactiveCall).toBeDefined();
  });

  it("clicking a tab navigates to that dashboard", async () => {
    const user = userEvent.setup();
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "First" } },
          { index: "tab-1", data: { name: "Second" } },
        ]),
      }),
    );

    renderWithRoute("tab-0");

    await user.click(screen.getByText("Second"));

    expect(mockNavigate).toHaveBeenCalledWith("/app/tab-1");
  });

  it("shows tab names from data", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "Macro Overview" } },
          { index: "tab-1", data: { name: "Equity Research" } },
          { index: "tab-2", data: { name: "Fixed Income" } },
        ]),
      }),
    );

    renderWithRoute("tab-0");

    expect(screen.getByText("Macro Overview")).toBeInTheDocument();
    expect(screen.getByText("Equity Research")).toBeInTheDocument();
    expect(screen.getByText("Fixed Income")).toBeInTheDocument();
  });

  it("shows 'Untitled' for tabs without a name", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: makeTabs([
          { index: "tab-0", data: { name: "" } },
          { index: "tab-1", data: { name: "" } },
        ]),
      }),
    );

    renderWithRoute("tab-0");

    const untitled = screen.getAllByText("Untitled");
    expect(untitled).toHaveLength(2);
  });

  it("does not render folder items as tabs", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        items: {
          folder: { index: "folder", isFolder: true, data: { name: "A Folder" } },
          "tab-0": { index: "tab-0", isFolder: false, data: { name: "Real Tab A" } },
          "tab-1": { index: "tab-1", isFolder: false, data: { name: "Real Tab B" } },
        },
      }),
    );

    renderWithRoute("tab-0");

    expect(screen.queryByText("A Folder")).not.toBeInTheDocument();
    expect(screen.getByText("Real Tab A")).toBeInTheDocument();
    expect(screen.getByText("Real Tab B")).toBeInTheDocument();
  });

  it("returns null when tabs without data are filtered out leaving only one visible", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        // One item has data, one does not — component filters by !isFolder && i.data
        items: {
          "tab-0": { index: "tab-0", isFolder: false, data: { name: "Only Tab" } },
          "tab-1": { index: "tab-1", isFolder: false, data: undefined },
        },
      }),
    );

    const { container } = renderWithRoute("tab-0");

    expect(container.firstChild).toBeNull();
  });
});
