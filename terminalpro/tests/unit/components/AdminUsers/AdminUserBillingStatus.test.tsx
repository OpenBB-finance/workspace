import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminUserBillingStatus from "~/components/AdminUsers/AdminUserBillingStatus";

// Mock the local Tag component
vi.mock("~/components/ds/atoms/Tag", () => ({
  Tag: ({ color, children }: { color: string; children: React.ReactNode }) => (
    <span data-testid="tag" data-color={color}>
      {children}
    </span>
  ),
}));

describe("AdminUserBillingStatus Component", () => {
  it("renders 'Active' status with success color when value is true", () => {
    render(<AdminUserBillingStatus value={true} />);
    const tag = screen.getByTestId("tag");
    expect(tag).toHaveTextContent("Active");
    expect(tag).toHaveAttribute("data-color", "success");
  });

  it("renders 'Inactive' status with grey color when value is false", () => {
    render(<AdminUserBillingStatus value={false} />);
    const tag = screen.getByTestId("tag");
    expect(tag).toHaveTextContent("Inactive");
    expect(tag).toHaveAttribute("data-color", "grey");
  });
});
