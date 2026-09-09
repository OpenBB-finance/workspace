import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";

interface ExternalLinkDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  onOpenInIframe: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
  /** When false, the iframe option is disabled (e.g. no active dashboard to add the widget to). */
  canOpenInIframe?: boolean;
}

export function ExternalLinkDialog({
  open,
  onClose,
  url,
  onOpenInIframe,
  onOpenInNewTab,
  canOpenInIframe = true,
}: ExternalLinkDialogProps) {
  const handleIframeClick = () => {
    onOpenInIframe(url);
    onClose();
  };

  const handleNewTabClick = () => {
    onOpenInNewTab(url);
    onClose();
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="gap-4 md:gap-6 lg:max-w-[464px]"
    >
      <DialogHeader>
        <DialogTitle>Opening External Link</DialogTitle>
        <DialogDescription>
          You are about to open an external link:{" "}
          <span className="obb-hyper-link">{url}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="rounded overflow-hidden bg-light-50 dark:bg-dark-850">
        <div className="bg-light-100 dark:bg-dark-600 px-3 py-2 text-xs text-light-600 dark:text-light-600 border-b">
          <strong className="dark:text-light-300">Preview</strong> (iframe embedding
          test)
        </div>
        <div className="relative">
          <iframe src={url} width="100%" height="224" className="border-0" />
        </div>
      </div>
      <p className="dark:text-dark-50 text-light-600">
        The preview shows if this website can be embedded. If you see the content
        loading, the iframe option will work. If it shows an error or blank page, use
        "Open in new tab" instead.
      </p>

      <DialogFooter className="flex items-center justify-between gap-2">
        <Button variant="outlined" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleIframeClick}
            disabled={!canOpenInIframe}
            title={
              canOpenInIframe ? undefined : "Open a dashboard to add an iframe widget"
            }
          >
            Open in iframe
          </Button>
          <Button variant="primary" size="sm" onClick={handleNewTabClick}>
            Open in new tab
          </Button>
        </div>
      </DialogFooter>
    </BaseDialog>
  );
}
