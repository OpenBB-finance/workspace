import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ReactNode, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useUpdateEffect } from "usehooks-ts";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";

type DialogProps = {
  title?: string | ReactNode;
  children: ReactNode;
  trigger?: ReactNode;
  noTrigger?: boolean;
  hideCancel?: boolean;
  showPortal?: boolean;
  hideTitle?: boolean;
  otherNavElements?: ReactNode;
  extraOverlayClass?: string;
  extraDialogClass?: string;
  showBottomBar?: boolean;
  handleDialogClose?: () => void;
  actionBottomBar?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  cancelBottomBar?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  tooltip?: string;
  bottomBar?: ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  hideCloseButton?: boolean;
  modal?: boolean;
  initialOpen?: boolean;
  focusOnOpen?: boolean;
  ignoreClickOutside?: boolean;
};

/** @deprecated use /components/ds/Dialog instead */
export default function Dialog({
  title,
  children,
  noTrigger = false,
  hideTitle = false,
  trigger = null,
  otherNavElements = null,
  extraDialogClass = "",
  modal = true,
  extraOverlayClass = "",
  showBottomBar = false,
  bottomBar = null,
  showPortal = true,
  actionBottomBar = {
    label: "Save",
    onClick: () => {},
    disabled: false,
  },
  cancelBottomBar = {
    label: "Cancel",
    onClick: () => {},
    disabled: false,
  },
  hideCancel = false,
  tooltip,
  open: externalOpen,
  setOpen: externalSetOpen,
  handleDialogClose,
  hideCloseButton = false,
  initialOpen = false,
  focusOnOpen = true,
  ignoreClickOutside = false,
}: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalSetOpen !== undefined ? externalSetOpen : setInternalOpen;

  useUpdateEffect(() => {
    if (!open) {
      if (handleDialogClose) {
        handleDialogClose();
      }
    }
  }, [open]);

  const renderContent = () => (
    <DialogPrimitive.Content
      onPointerDownOutside={(e) => {
        if (!modal || ignoreClickOutside) e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
      onOpenAutoFocus={(e) => {
        if (!focusOnOpen) {
          e.preventDefault();
        }
      }}
      className={twMerge(
        "DialogContent fixed z-60 flex flex-col overflow-auto rounded p-4 text-xs",
        "max-h-[95vh] min-h-[246px] w-[95vw] max-w-[720px] md:w-full",
        "left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%]",
        "bg-white text-black dark:bg-[#1F1E23] dark:text-white",
        "text-black focus:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-main focus-visible:ring-opacity-75",
        extraDialogClass,
      )}
    >
      {!hideTitle && (
        <div className="flex items-start justify-between gap-10">
          <DialogPrimitive.Title className="text-lg font-bold">
            {title}
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 mt-2">
            {otherNavElements}
            {!hideCloseButton && (
              <Tooltip message="Close popup">
                <DialogPrimitive.Close tabIndex={-1}>
                  <Icon id="cross-icon" className="h-5 w-5" />
                </DialogPrimitive.Close>
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {children}
      {bottomBar}
      {showBottomBar && (
        <div className="mt-auto flex items-center justify-end gap-2.5">
          {!(hideCancel || hideCloseButton) && (
            <DialogPrimitive.Close
              className="obb-btn-outlined border px-3 py-1 font-medium md:w-fit"
              disabled={cancelBottomBar.disabled}
              onClick={cancelBottomBar.onClick}
            >
              {cancelBottomBar.label}
            </DialogPrimitive.Close>
          )}
          <DialogPrimitive.Close
            className="obb-btn-tertiary h-8 px-3 py-1 font-medium md:w-fit"
            disabled={actionBottomBar.disabled}
            onClick={actionBottomBar.onClick}
          >
            {actionBottomBar.label}
          </DialogPrimitive.Close>
        </div>
      )}
    </DialogPrimitive.Content>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal={modal}>
      {!noTrigger &&
        (tooltip ? (
          <Tooltip message={tooltip}>
            <DialogPrimitive.Trigger
              className={
                trigger
                  ? ""
                  : "text-left font-medium text-brand-main dark:text-brand-lighter"
              }
              title={title as string}
              asChild={!!trigger}
            >
              {trigger ? trigger : title}
            </DialogPrimitive.Trigger>
          </Tooltip>
        ) : (
          <DialogPrimitive.Trigger
            className={
              trigger
                ? ""
                : "text-left font-medium text-brand-main dark:text-brand-lighter"
            }
            title={title as string}
            asChild={!!trigger}
          >
            {trigger ? trigger : title}
          </DialogPrimitive.Trigger>
        ))}
      {showPortal ? (
        <DialogPrimitive.Portal>
          {modal ? (
            <DialogPrimitive.Overlay
              className={twMerge("obb-modal-overlay", extraOverlayClass)}
            />
          ) : (
            <div
              className={twMerge("obb-modal-overlay w-full h-full", extraOverlayClass)}
              onClick={() => {
                setOpen(false);
              }}
            />
          )}
          {renderContent()}
        </DialogPrimitive.Portal>
      ) : (
        <>
          <DialogPrimitive.Overlay
            className={twMerge("obb-modal-overlay", extraOverlayClass)}
          />
          {renderContent()}
        </>
      )}
    </DialogPrimitive.Root>
  );
}
