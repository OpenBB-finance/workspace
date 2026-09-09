import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdvancedSelect, { type TSelectValues } from "~/components/NewAdvancedSelect";

vi.mock("~/lib/utils", () => ({
  beautifySlug: vi.fn().mockReturnValue("beautified-string"),
  cn: vi.fn(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: any) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        key: opts.getItemKey?.(i) ?? i,
        index: i,
        start: i * 28,
        size: 28,
      })),
    getTotalSize: () => opts.count * 28,
    measureElement: () => {},
  }),
}));

describe("AdvancedSelect Component", () => {
  const mockOnSelect = vi.fn();
  const testValues: TSelectValues[] = [
    { label: "Test 1", value: "test1" },
    { label: "Test 2", value: "test2" },
    { label: "Test 3", value: "test3" },
  ];

  it("renders with default props", () => {
    render(
      <AdvancedSelect
        label="Test Select"
        values={testValues}
        onSelect={mockOnSelect}
        selected="test1"
      />,
    );

    expect(screen.getByText("Test 1")).toBeInTheDocument();
  });

  it("handles selection change", async () => {
    render(
      <AdvancedSelect
        label="Test Select"
        values={testValues}
        onSelect={mockOnSelect}
        selected="test1"
      />,
    );

    userEvent.click(screen.getByText("Test 1"));

    // Wait for the dropdown options to be available
    await screen.findByText("Test 2");

    userEvent.click(screen.getByText("Test 2"));

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith("test2");
    });
  });

  it("renders with search icon when withSearch is true", async () => {
    const { container } = render(
      <AdvancedSelect
        label="Test Select"
        values={testValues}
        onSelect={mockOnSelect}
        selected="test1"
        forceSearch={true}
        withSearch={true}
      />,
    );

    userEvent.click(screen.getByText("Test 1"));

    // Wait for the dropdown to open
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    // Check that search input is present when withSearch is true
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
    });
  });

  it("renders with tooltip when toolTipMessage is provided", async () => {
    render(
      <AdvancedSelect
        label="Test Select"
        values={testValues}
        onSelect={mockOnSelect}
        selected="test1"
        toolTipMessage="This is a tooltip"
      />,
    );

    userEvent.hover(screen.getByText("Test 1"));

    // Use getAllByText to find all elements with the tooltip text
    const tooltips = await screen.findAllByText("This is a tooltip");

    // Assert that at least one tooltip is present
    expect(tooltips.length).toBeGreaterThan(0);
  });

  it("does not emit a stale selection when endpoint values finish loading", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const loadedValues: TSelectValues[] = [
      { label: "All categories", value: "All" },
      { label: "Crypto", value: "Crypto" },
    ];

    try {
      const { rerender } = render(
        <AdvancedSelect
          label="All categories"
          values={[{ label: "Loading...", value: "Loading..." }]}
          onSelect={onSelect}
          selected="All"
        />,
      );

      rerender(
        <AdvancedSelect
          label="Crypto"
          values={loadedValues}
          onSelect={onSelect}
          selected="Crypto"
        />,
      );

      await vi.advanceTimersByTimeAsync(350);

      expect(screen.getByText("Crypto")).toBeInTheDocument();
      expect(screen.queryByText("All categories")).not.toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not clear the selected value when endpoint options expand", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const categoryValues: TSelectValues[] = [
      { label: "All categories", value: "All" },
      { label: "Sports", value: "Sports" },
    ];
    const categoryAndTagValues: TSelectValues[] = [
      ...categoryValues,
      { label: "Sports > Baseball", value: "Sports>Baseball" },
    ];

    try {
      const { rerender } = render(
        <AdvancedSelect
          label="Sports"
          values={categoryValues}
          onSelect={onSelect}
          selected="Sports"
        />,
      );

      rerender(
        <AdvancedSelect
          label="Sports"
          values={categoryAndTagValues}
          onSelect={onSelect}
          selected="Sports"
        />,
      );

      await vi.advanceTimersByTimeAsync(350);

      expect(screen.getByText("Sports")).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
