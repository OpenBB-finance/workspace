import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Calendar } from "~/components/ui/Calendar";

/**
 * Rendered against the real DayPicker (Calendar.test.tsx mocks it away) so the
 * caption's dropdown row is actually built. Layout can't be measured in jsdom,
 * so these assert the sizing rules that keep the year from being clipped.
 */
describe("Calendar caption dropdowns", () => {
  it("sizes the year column to its content and lets the month take the rest", () => {
    const { container } = render(
      <Calendar isSingle mode="single" captionLayout="dropdown" />,
    );

    // `classNames.dropdowns` replaces the default `rdp-dropdowns` class, so
    // reach the row through the (untouched) dropdown roots.
    const dropdowns = container.querySelector(".rdp-dropdown_root")?.parentElement;
    // A fixed percentage split can't fit both "September" and a 4-digit year.
    expect(dropdowns).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_auto]");
  });

  it("renders the caption selects at the compact size, not the default md", () => {
    render(<Calendar isSingle mode="single" captionLayout="dropdown" />);

    const [monthTrigger, yearTrigger] = screen.getAllByRole("combobox");
    for (const trigger of [monthTrigger, yearTrigger]) {
      // size="xs" -> gap-1. (Padding comes from `dropdown`'s p-0.5, which wins
      // the twMerge against either size's padding.)
      expect(trigger).toHaveClass("gap-1");
      expect(trigger).not.toHaveClass("gap-2");
    }
  });
});
