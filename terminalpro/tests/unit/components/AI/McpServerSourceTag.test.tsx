import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { McpServerSourceTag } from "~/components/AI/McpServerSourceTag";
import type { McpServer } from "~/lib/state/mcpTools";

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: { children: ReactNode; message: string }) => (
    <div title={message}>{children}</div>
  ),
}));

const baseServer: McpServer = {
  id: "s1",
  name: "Stock Data",
  url: "https://example.com/mcp",
  enabled: true,
  tools: [],
};

describe("McpServerSourceTag", () => {
  it("renders the vendor name with a provenance tooltip for marketplace servers", () => {
    render(
      <McpServerSourceTag
        server={{ ...baseServer, vendorAppUuid: "app-1", vendorName: "Polygon" }}
      />,
    );

    expect(screen.getByText("Polygon")).toBeInTheDocument();
    expect(
      screen.getByTitle("Added from the Polygon marketplace app"),
    ).toBeInTheDocument();
  });

  it("renders nothing when the server has no vendorAppUuid", () => {
    const { container } = render(
      <McpServerSourceTag server={{ ...baseServer, vendorName: "Polygon" }} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Polygon")).not.toBeInTheDocument();
  });

  it("renders nothing when the server has no vendorName", () => {
    const { container } = render(
      <McpServerSourceTag server={{ ...baseServer, vendorAppUuid: "app-1" }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("forwards className to the tag", () => {
    render(
      <McpServerSourceTag
        server={{ ...baseServer, vendorAppUuid: "app-1", vendorName: "Polygon" }}
        className="shrink-0"
      />,
    );

    expect(screen.getByText("Polygon")).toHaveClass("shrink-0");
  });
});
