import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Changelog, type ChangelogChunk } from "~/components/General/Changelog";

describe("Changelog Component", () => {
  const mockChunks = [
    {
      version: "1.0.0",
      slug: "1-0-0",
      heading: "Version 1.0.0",
      changes: [
        {
          type: "new features",
          heading: "New Feature",
          content: "This is a new feature.",
        },
      ],
    },
    {
      content: "General updates and improvements.",
    },
  ];

  it("renders the changelog correctly", () => {
    render(<Changelog chunks={mockChunks as ChangelogChunk[]} />);
    expect(screen.getByText("Version 1.0.0")).toBeInTheDocument();
    expect(screen.getByText("New Feature")).toBeInTheDocument();
    expect(screen.getByText("This is a new feature.")).toBeInTheDocument();
    expect(screen.getByText("General updates and improvements.")).toBeInTheDocument();
  });
});
