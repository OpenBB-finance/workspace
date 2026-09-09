import type React from "react";
import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogContent, DialogTitle } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import useIsMobile from "~/hooks/useIsMobile";

const getDeviceType = (): "iOS" | "Android" | "Desktop" => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return "iOS";
  }

  // Android detection
  if (/android/i.test(userAgent)) {
    return "Android";
  }

  // If not iOS or Android, assume it's a desktop
  return "Desktop";
};

const InstallPrompt: React.FC = () => {
  const isMobile = useIsMobile();
  const [show, setShow] = useLocalStorage("pwaInstallPrompt", true);
  const deviceType = getDeviceType();

  const InstallInstructions = useMemo(() => {
    switch (deviceType) {
      case "iOS":
        return (
          <>
            To install the app, you need to add this website to your home screen. Tap
            the <span className="font-medium">share button</span> and choose{" "}
            <span className="font-medium">Add to Home Screen</span> in the options.
          </>
        );
      case "Android":
        return (
          <>
            To install the app, you need to add this website to your home screen. In
            your Chrome browser menu, tap the <span className="font-medium">More</span>{" "}
            button and choose <span className="font-medium">Add to Home Screen</span> in
            the options.
          </>
        );
      case "Desktop":
        return (
          <>
            To install the app, you can add this website to your bookmarks or create a
            shortcut on your desktop.
          </>
        );
      default:
        return (
          <>
            To install the app, please follow the instructions for your specific device.
          </>
        );
    }
  }, [deviceType]);

  return (
    <BaseDialog open={show && isMobile} onClose={() => setShow(false)}>
      <DialogContent>
        <DialogTitle className="inline-flex items-center">
          <Icon id="phone-01" className="w-6 h-6 text-brand-lighter mr-1" />
          {deviceType === "iOS" ? "Add To Home Screen" : "Install App"}
        </DialogTitle>
        <img
          src="/assets/images/illustration-pwa.svg"
          className="w-[132px] h-[144px] mx-auto"
          alt="PWA Install Prompt"
        />
        <button tabIndex={0} className="sr-only" />
        <p>{InstallInstructions}</p>
        <p>
          Learn more about
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 obb-hyper-link"
          >
            progressive web apps
          </a>
          .
        </p>
      </DialogContent>
    </BaseDialog>
  );
};

export default InstallPrompt;
