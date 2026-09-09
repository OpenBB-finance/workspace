import { CheckCircledIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { memo, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { useGlobalTitleManager } from "~/hooks/useTitle";
import { useThemeStore } from "~/lib/state/theme";
import FloatingThemePreview from "../FloatingThemePreview";
import CloseCircleIcon from "../Icons/CloseCircle";
import WarningIcon from "../Icons/Warning";

export function RootLayout() {
  const { theme } = useThemeStore();
  useGlobalTitleManager();
  return useMemo(
    () => (
      <>
        <FloatingThemePreview />
        <Toaster
          position="top-right"
          closeButton={true}
          theme={theme}
          visibleToasts={10}
          expand
          toastOptions={{
            unstyled: true,
            classNames: {
              actionButton:
                "toast-action-btn mt-2 h-6 px-2 py-[4.5px] rounded text-2xs! font-medium!",
              cancelButton:
                "toast-cancel-btn mt-2 h-6 bg-transparent! border-b px-0 py-[4.5px] text-2xs! font-medium!",
              icon: "h-5 w-5 ml-0 mr-0",
              content: "[display:contents]!",
              title:
                "text-xs! font-bold! leading-5 break-words! flex-1! min-w-0! basis-[calc(100%-28px)]! pr-5!",
              description:
                "text-xs! leading-5 whitespace-pre-wrap break-words! basis-full!",
              closeButton:
                "right-0! left-auto! top-[25px]! mr-[5px] bg-transparent! border-0! text-light-900! [&>svg]:w-[14px]! [&>svg]:h-[14px]!",
              default:
                "flex flex-wrap pointer-events-auto! rounded p-4 w-[var(--width)] h-[var(--height)] border-2 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)] text-black text-xs items-start! gap-x-2! gap-y-1! [&>[data-content]+[data-button]]:ml-auto [&_label]:text-light-800 [&_label]:dark:text-light-800",
              success:
                "bg-[#CCF7DC] border-[#2DAC5C1A] [&_.toast-action-btn]:text-white [&_.toast-action-btn]:bg-[#2DAC5C] [&_.toast-action-btn:hover]:bg-[#238B50] [&_.toast-cancel-btn]:text-[#15803D]! [&_.toast-cancel-btn]:border-[#15803D] [&_.toast-cancel-btn:hover]:text-[#0F5F32] [&_.toast-cancel-btn:hover]:border-[#0F5F32]",
              info: "bg-[#C8E7FF] border-[#C8E7FF] [&_.toast-action-btn]:text-white [&_.toast-action-btn]:bg-[#0088CC] [&_.toast-action-btn:hover]:bg-[#006AA3] [&_.toast-cancel-btn]:text-[#006699]! [&_.toast-cancel-btn]:border-[#006699] [&_.toast-cancel-btn:hover]:text-[#004D73] [&_.toast-cancel-btn:hover]:border-[#004D73]",
              warning:
                "bg-[#FFD4A4] border-[#F18A1A1A] [&_.toast-action-btn]:text-white [&_.toast-action-btn]:bg-[#F18A1A] [&_.toast-action-btn:hover]:bg-[#D67514] [&_.toast-cancel-btn]:text-[#BA6509]! [&_.toast-cancel-btn]:border-[#BA6509] [&_.toast-cancel-btn:hover]:text-[#994F07] [&_.toast-cancel-btn:hover]:border-[#994F07] [&_a]:text-light-700! [&_a]:underline! hover:[&_a]:text-light-800!",
              error:
                "bg-[#FFC5C5] border-[#E03C3C1A] [&_.toast-action-btn]:text-white [&_.toast-action-btn]:bg-[#E03C3C] [&_.toast-action-btn:hover]:bg-[#C32F2F] [&_.toast-cancel-btn]:text-[#B91C1C]! [&_.toast-cancel-btn]:border-[#B91C1C] [&_.toast-cancel-btn:hover]:text-[#991515] [&_.toast-cancel-btn:hover]:border-[#991515]",
              loading:
                "bg-[#C8E7FF] border-[#C8E7FF] [&_.toast-action-btn]:text-white [&_.toast-action-btn]:bg-[#0088CC] [&_.toast-action-btn:hover]:bg-[#006AA3] [&_.toast-cancel-btn]:text-[#006699]! [&_.toast-cancel-btn]:border-[#006699] [&_.toast-cancel-btn:hover]:text-[#004D73] [&_.toast-cancel-btn:hover]:border-[#004D73]",
            },
          }}
          icons={{
            success: <CheckCircledIcon strokeWidth={1.5} className="text-[#15803D]" />,
            info: <InfoCircledIcon strokeWidth={1.5} className="text-[#065592]" />,
            warning: <WarningIcon strokeWidth={1.5} className="text-[#BA6509]" />,
            error: <CloseCircleIcon strokeWidth={1.5} className="text-[#B91C1C]" />,
          }}
        />
        <Outlet />
      </>
    ),
    [theme],
  );
}

export default memo(RootLayout);
