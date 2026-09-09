import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { toPng } from "html-to-image";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import Icon from "./Icon";

export default function WidgetFullscreen({
  widgetId,
  header,
  open,
  setOpen,
}: {
  widgetId: string;
  header: ReactNode;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const containerElement = document.getElementById(widgetId);
    const targetElement = containerElement?.querySelector(
      ".widgetContent",
    ) as HTMLElement;
    if (targetElement) {
      // Save the original styles
      const originalParentOverflow = targetElement.style.overflow;
      const originalParentHeight = targetElement.style.height;

      // Adjust the styles to fit the content
      targetElement.style.overflow = "hidden";
      targetElement.style.height = "100%";

      toPng(targetElement, {
        pixelRatio: 1.5,
        quality: 1,
        /*width: targetElement.scrollWidth,
                height: targetElement.scrollHeight,*/
      })
        .then((dataUrl) => {
          setImage(dataUrl);

          // Reset the styles
          targetElement.style.overflow = originalParentOverflow;
          targetElement.style.height = originalParentHeight;
        })
        .catch((error) => {
          console.error("oops, something went wrong!", error);

          // Reset the styles
          targetElement.style.overflow = originalParentOverflow;
          targetElement.style.height = originalParentHeight;
        });
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="DialogOverlay fixed inset-0 z-20 bg-black/30 backdrop-blur-[1px] backdrop-filter" />
        <DialogPrimitive.Content
          className={clsx(
            "DialogContent fixed z-20 flex flex-col gap-4 overflow-hidden rounded p-6",
            "max-h-[80vh] w-[95vw] md:w-[70vw]",
            "left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%]",
            "bg-white text-black dark:bg-[#151518] dark:text-white",
            "focus:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-main focus-visible:ring-opacity-50",
          )}
        >
          <div className="max-w-[200px]">{header}</div>
          <DialogPrimitive.Close
            className={clsx(
              "absolute right-3.5 top-3.5 inline-flex items-center justify-center rounded-full",
            )}
          >
            <Icon
              id="cross-icon"
              className="z-0 h-3 w-3 text-light-800 hover:text-light-900 dark:text-light-300 dark:hover:text-light-400"
            />
          </DialogPrimitive.Close>

          <div className="overflow-auto bg-white dark:bg-[#151518]" /*ref={ref}*/>
            {image ? (
              <img src={image} className="mx-auto" />
            ) : (
              <div className="flex items-center justify-center min-h-[200px]">
                Loading...
              </div>
            )}
            {/*Children.map(children, (child) => {
                            if (isValidElement(child)) {
                                if (child?.props?.className?.includes("min-h-[200px]")) {
                                    // replace min-h-[200px] with min-h-[300px]
                                    return cloneElement(child, {
                                        // @ts-ignore
                                        className: child.props.className.replace(
                                            "min-h-[200px]",
                                            "min-h-[600px]",
                                        ),
                                    });
                                }
                                return child;
                            }
                            return child;
                        })*/}
          </div>

          <div className="flex mt-auto justify-between">
            <button
              onClick={() => {
                if (image) {
                  const link = document.createElement("a");
                  link.download = "widget.png";
                  link.href = image;
                  link.click();
                }
              }}
              className="inline-flex w-fit items-center gap-3 text-xs text-light-400 hover:text-light-600 dark:hover:text-light-300"
            >
              <Icon id="download-icon" className="h-4 w-4" />
              Export
            </button>
            <p className="text-light-400 dark:text-[#4c4c57] text-xs">
              ⚠️ This feature is still experimental.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
