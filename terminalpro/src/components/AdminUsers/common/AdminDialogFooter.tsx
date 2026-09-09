import { Button } from "~/components/ds/atoms/Button";
import { DialogClose, DialogFooter } from "~/components/ds/dialogs/Dialog";

export default function AdminDialogFooter({
  primaryButtonName,
  primaryButtonDisabled,
  primaryButtonVariant = "primary",
  onPrimaryButtonClick,
  className,
  primaryButtonTestId,
}: {
  primaryButtonName: string;
  primaryButtonDisabled?: boolean;
  primaryButtonVariant?: "primary" | "secondary" | "outlined" | "danger";
  onPrimaryButtonClick?: () => void;
  className?: string;
  primaryButtonTestId?: string;
}) {
  return (
    <DialogFooter className={className}>
      <DialogClose asChild={true}>
        <Button variant="outlined" size="sm">
          Cancel
        </Button>
      </DialogClose>
      <Button
        size="sm"
        type="submit"
        variant={primaryButtonVariant}
        disabled={primaryButtonDisabled}
        onClick={onPrimaryButtonClick}
        data-testid={primaryButtonTestId}
      >
        {primaryButtonName}
      </Button>
    </DialogFooter>
  );
}
