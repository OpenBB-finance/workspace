import * as TabsPrimitive from "@radix-ui/react-tabs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import LayoutTab from "~/components/Settings/LayoutTab";
import { useShallowThemeStore } from "~/lib/state/theme";

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

const mockUpdateDisplaySettings = vi.fn();

(useShallowThemeStore as Mock).mockReturnValue({
  gridCorners: [],
  quickAddButtonVisible: true,
  collapsedPanelExpandOnHover: false,
  updateDisplaySettings: mockUpdateDisplaySettings,
});

describe("LayoutTab Component", () => {
  const renderComponent = () =>
    render(
      <TabsPrimitive.Root value="tab-layout">
        <LayoutTab />
      </TabsPrimitive.Root>,
    );

  it("renders the Quick add toolbar section with updated description", () => {
    renderComponent();
    expect(screen.getByText("Quick add toolbar")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Button on the bottom right corner of a dashboard to add widgets is always visible",
      ),
    ).toBeInTheDocument();
  });

  it("does not render any images in the Quick add toolbar section", () => {
    const { container } = renderComponent();
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
