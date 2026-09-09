import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { linkifyText } from "~/utils/linkifyText";

describe("linkifyText", () => {
  it("returns the original text when there is no URL", () => {
    render(<span>{linkifyText("Just some plain description.")}</span>);
    expect(screen.getByText("Just some plain description.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders an http(s) URL as a clickable external link", () => {
    render(
      <span>{linkifyText("Source: https://fred.stlouisfed.org/series/CPIAUCSL")}</span>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://fred.stlouisfed.org/series/CPIAUCSL");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("keeps surrounding text intact around the link", () => {
    render(<span>{linkifyText("See https://openbb.co for more.")}</span>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://openbb.co");
    expect(screen.getByText(/See/)).toBeInTheDocument();
    expect(screen.getByText(/for more\./)).toBeInTheDocument();
  });

  it("does not include trailing punctuation in the href", () => {
    render(<span>{linkifyText("Visit https://openbb.co.")}</span>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://openbb.co");
  });

  it("renders multiple URLs", () => {
    render(
      <span>{linkifyText("Docs https://a.com and data https://b.com here")}</span>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://a.com");
    expect(links[1]).toHaveAttribute("href", "https://b.com");
  });

  it("returns an empty array for empty input", () => {
    expect(linkifyText("")).toEqual([]);
  });

  it("supports plain http (not just https) for bare and markdown links", () => {
    render(
      <span>
        {linkifyText("Bare http://a.com and markdown [b](http://b.com)")}
      </span>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "http://a.com");
    expect(links[1]).toHaveAttribute("href", "http://b.com");
  });

  it("renders a markdown link with its label as the visible text", () => {
    render(
      <span>
        {linkifyText("Data sourced from [datagolf.com](https://datagolf.com).")}
      </span>,
    );
    const link = screen.getByRole("link", { name: "datagolf.com" });
    expect(link).toHaveAttribute("href", "https://datagolf.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/Data sourced from/)).toBeInTheDocument();
  });

  it("supports a mix of markdown links and bare URLs", () => {
    render(
      <span>
        {linkifyText("See [docs](https://a.com) or visit https://b.com directly")}
      </span>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://a.com");
    expect(links[0]).toHaveTextContent("docs");
    expect(links[1]).toHaveAttribute("href", "https://b.com");
    expect(links[1]).toHaveTextContent("https://b.com");
  });

  it("leaves non-link markdown formatting untouched", () => {
    render(<span>{linkifyText("Points **leverage** and ownership")}</span>);
    expect(screen.getByText("Points **leverage** and ownership")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
