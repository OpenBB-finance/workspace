import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminUserStatus from "~/components/AdminUsers/AdminUserStatus";
import "@testing-library/jest-dom";

describe("AdminUserStatus", () => {
  it("replaces active to 'verified' and has the correct color css", async () => {
    const { getByText } = render(<AdminUserStatus value="active" />);
    const tagElement = getByText("verified");
    expect(tagElement).toBeInTheDocument();
    expect(tagElement).toHaveClass("bg-tag-green-bg");
  });

  it("handles 'null' input and displays '-' and has the correct color css", async () => {
    const { getByText } = render(<AdminUserStatus value="" />);
    const tagElement = getByText("-");
    expect(tagElement).toBeInTheDocument();
    expect(tagElement).toHaveClass("bg-tag-grey-bg");
  });
});
