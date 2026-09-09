import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { Dialog } from "~/components/ds/dialogs/Dialog";

describe("AdminDialogFooter Component", () => {
  it("renders correctly with provided props", () => {
    render(
      <Dialog>
        <AdminDialogFooter
          primaryButtonName="Submit"
          primaryButtonDisabled={false}
          primaryButtonVariant="primary"
          className="custom-class"
        />
      </Dialog>,
    );

    const cancelButton = screen.getByText("Cancel");
    const primaryButton = screen.getByText("Submit");

    expect(cancelButton).toBeInTheDocument();
    expect(primaryButton).toBeInTheDocument();
    expect(primaryButton).not.toBeDisabled();
  });

  it("disables the primary button when primaryButtonDisabled is true", () => {
    render(
      <Dialog>
        <AdminDialogFooter
          primaryButtonName="Submit"
          primaryButtonDisabled={true}
          primaryButtonVariant="primary"
        />
      </Dialog>,
    );

    const primaryButton = screen.getByText("Submit");
    expect(primaryButton).toBeDisabled();
  });

  it("calls onPrimaryButtonClick when primary button is clicked", () => {
    const handleClick = vi.fn();
    render(
      <Dialog>
        <AdminDialogFooter
          primaryButtonName="Submit"
          primaryButtonDisabled={false}
          primaryButtonVariant="primary"
          onPrimaryButtonClick={handleClick}
        />
      </Dialog>,
    );

    const primaryButton = screen.getByText("Submit");
    fireEvent.click(primaryButton);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
