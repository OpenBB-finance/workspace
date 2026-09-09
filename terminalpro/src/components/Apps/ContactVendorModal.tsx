import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import Avatar from "~/components/General/Avatar";
import { CONTACT_VENDOR_FORM_URL } from "~/lib/constants";
import type { ListedApp } from "~/types/listedApps";

interface ContactVendorModalProps {
  app: ListedApp | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactVendorModal({ app, isOpen, onClose }: ContactVendorModalProps) {
  const vendorInitials = useMemo(
    () =>
      app?.vendorName
        .split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase() ?? "",
    [app?.vendorName],
  );

  if (!app) return null;

  const imgSrc = app.vendorThumbnailUrl || app.thumbnail;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:!max-w-[560px] h-[80vh]"
        data-testid="_contact-vendor-modal"
      >
        <div className="flex items-center gap-2.5 shrink-0 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-general-bg-secondary">
            {imgSrc ? (
              <Avatar
                src={imgSrc}
                alt={app.vendorName}
                withVariantCva={false}
                imageClassName="w-full h-full object-cover"
              />
            ) : (
              <span className="text-ds-text-heading font-bold text-sm">
                {vendorInitials}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <DialogTitle className="truncate !pr-0">
              Contact {app.vendorName}
            </DialogTitle>
            <span className="body-xs-regular text-ds-text-caption truncate">
              {app.appName}
            </span>
          </div>
        </div>

        <DialogDescription className="sr-only">
          Get in touch with {app.vendorName} about {app.appName}.
        </DialogDescription>

        <div className="flex-auto min-h-0">
          <iframe
            title={`Contact ${app.vendorName}`}
            src={CONTACT_VENDOR_FORM_URL}
            className="h-full w-full rounded-md border border-general-border-secondary bg-general-bg-secondary"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
