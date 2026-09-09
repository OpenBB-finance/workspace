import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadedFile } from "~/components/General/UploadedFile";

describe("UploadedFile", () => {
  it("renders the file name in a bordered chip", () => {
    const { container } = render(
      <UploadedFile name="dailyreport.pdf" status="uploaded" onClick={vi.fn()} />,
    );

    expect(screen.getByText("dailyreport.pdf")).toBeInTheDocument();

    const chip = container.firstElementChild;
    expect(chip).toHaveClass("border-general-border-primary");
    expect(chip).toHaveClass("bg-general-bg-primary");
  });

  it("renders the attachment icon with a neutral color", () => {
    render(<UploadedFile name="dailyreport.pdf" status="uploaded" onClick={vi.fn()} />);

    const icon = screen.getByTestId("icon-attachment-icon");
    expect(icon).toHaveClass("text-ds-text-caption");
    expect(icon.getAttribute("class")).not.toMatch(/text-brand/);
  });

  it("shows a spinner while pending", () => {
    render(<UploadedFile name="dailyreport.pdf" status="pending" onClick={vi.fn()} />);

    expect(screen.getByTestId("icon-mdi-loading")).toHaveClass("animate-spin");
  });

  it("shows a success icon when uploaded", () => {
    render(<UploadedFile name="dailyreport.pdf" status="uploaded" onClick={vi.fn()} />);

    expect(screen.getByTestId("icon-check")).toHaveClass("text-alert-success");
  });

  it("shows an error icon when failed", () => {
    render(<UploadedFile name="dailyreport.pdf" status="failed" onClick={vi.fn()} />);

    expect(screen.getByTestId("icon-x")).toHaveClass("text-alert-error");
  });

  it("calls onClick when the remove button is pressed", () => {
    const onClick = vi.fn();
    render(<UploadedFile name="dailyreport.pdf" status="uploaded" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove dailyreport.pdf" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe("readOnly", () => {
    it("hides the status icon and the remove button", () => {
      render(<UploadedFile name="dailyreport.pdf" readOnly={true} />);

      expect(screen.getByText("dailyreport.pdf")).toBeInTheDocument();
      expect(screen.getByTestId("icon-attachment-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Remove dailyreport.pdf" }),
      ).not.toBeInTheDocument();
    });
  });
});
