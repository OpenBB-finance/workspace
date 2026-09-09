import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CopilotMessageTitle from "~/components/AI/CopilotMessageTitle";

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className: string }) => (
    <svg data-testid={`icon-${id}`} id={id} className={className} />
  ),
}));

vi.mock("~/components/Icons/LoadingSpinner", () => ({
  default: ({ className }: { className: string }) => (
    <svg data-testid="loading-spinner" className={className} />
  ),
}));

const defaultProps = {
  isExpanded: false,
  isExpandable: false,
  toggleDropdown: vi.fn(),
  content: "Test message",
  showIcon: true,
  isStepByStepInProgress: false,
  groupIndex: 0,
};

describe("CopilotMessageTitle - displayEventType logic", () => {
  it("shows error icon when ERROR and isLastGroup=true", () => {
    render(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="ERROR"
        isLastGroup={true}
      />,
    );

    expect(screen.getByTestId("icon-x-outline-circle")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-info-outline-circle")).not.toBeInTheDocument();
  });

  it("downgrades ERROR to INFO icon when isLastGroup=false", () => {
    render(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="ERROR"
        isLastGroup={false}
      />,
    );

    expect(screen.getByTestId("icon-info-outline-circle")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-x-outline-circle")).not.toBeInTheDocument();
  });

  it("downgrades WARNING to INFO icon when isLastGroup=false", () => {
    render(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="WARNING"
        isLastGroup={false}
      />,
    );

    expect(screen.getByTestId("icon-info-outline-circle")).toBeInTheDocument();
    expect(
      screen.queryByTestId("icon-exclamation-outline-triangle"),
    ).not.toBeInTheDocument();
  });

  it("keeps INFO as INFO regardless of isLastGroup", () => {
    const { rerender } = render(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="INFO"
        isLastGroup={true}
      />,
    );

    expect(screen.getByTestId("icon-info-outline-circle")).toBeInTheDocument();

    rerender(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="INFO"
        isLastGroup={false}
      />,
    );

    expect(screen.getByTestId("icon-info-outline-circle")).toBeInTheDocument();
  });

  it("shows WARNING icon when WARNING and isLastGroup=true", () => {
    render(
      <CopilotMessageTitle
        {...defaultProps}
        eventType="WARNING"
        isLastGroup={true}
      />,
    );

    expect(
      screen.getByTestId("icon-exclamation-outline-triangle"),
    ).toBeInTheDocument();
  });
});
