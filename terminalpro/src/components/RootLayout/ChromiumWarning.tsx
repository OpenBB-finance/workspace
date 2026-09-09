import { useThemeStore } from "~/lib/state/theme";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";

export default function ChromiumWarning() {
  const { userAcknowledgedNonChromium, setUserAcknowledgedNonChromium } =
    useThemeStore();
  const isNonChromium = !(window as any).chrome;
  return (
    <BaseDialog
      open={isNonChromium && !userAcknowledgedNonChromium}
      className="[&>.DialogXButton]:hidden"
    >
      <DialogTitle>Chromium Warning</DialogTitle>
      <div className="flex flex-col items-center justify-center h-full gap-4 pt-5 pb-7">
        <p className="text-sm">
          This site is optimized for Chromium-based browsers. Please use a
          Chromium-based browser for the best experience.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={() => setUserAcknowledgedNonChromium(true)} size="sm">
          I understand and wish to continue
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
