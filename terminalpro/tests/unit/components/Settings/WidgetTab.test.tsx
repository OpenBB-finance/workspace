import * as TabsPrimitive from "@radix-ui/react-tabs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import WidgetTab from "~/components/Settings/WidgetTab";
import { useShallowThemeStore } from "~/lib/state/theme";
import { mockConfig } from "../../../mocks/runtimeConfig";

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

const mockUpdateDisplaySettings = vi.fn();

(useShallowThemeStore as Mock).mockReturnValue({
  decimalDigits: 2,
  showWidgetControlsEllipsis: false,
  tablePagination: false,
  showMinimizeButton: false,
  updateDisplaySettings: mockUpdateDisplaySettings,
});

describe("WidgetTab Component", () => {
  const renderComponent = () =>
    render(
      <TabsPrimitive.Root value="widget">
        <WidgetTab />
      </TabsPrimitive.Root>,
    );

  it("renders the Widget control icons section with updated collapse description", () => {
    renderComponent();
    expect(screen.getByText("Widget control icons")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Collapse widget controls: Hides action icons behind a chevron, revealed on hover",
      ),
    ).toBeInTheDocument();
  });

  it("renders the minimize button label with updated description when feature flag is enabled", () => {
    mockConfig.ui.showMinimizeWidget = true;
    renderComponent();
    expect(
      screen.getByText(
        "Minimize button on header: Adds a minimize icon to collapse the widget in place",
      ),
    ).toBeInTheDocument();
  });

  it("does not render any images in the Widget control icons section", () => {
    const { container } = renderComponent();
    const images = container.querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
