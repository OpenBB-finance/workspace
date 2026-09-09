import { useState } from "react";
import { LETS_TALK_FORM_URL } from "~/lib/constants";
import { getShowDemoRequestButton } from "~/lib/onPremFeatureFlags";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";

const showDemoRequestButton = getShowDemoRequestButton();

export default function TrialExpiredWarning({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);

  const handleBookingClosed = () => {
    setBookingOpen(false);
  };

  return (
    <>
      <BaseDialog
        open={bookingOpen}
        onClose={handleBookingClosed}
        className="min-h-[80vh] max-h-[80vh] lg:max-w-3xl xl:max-w-5xl h-full"
      >
        <DialogTitle>Request a Demo</DialogTitle>
        <DialogDescription>
          Please select a date and time for the demo. We will send you a calendar
          invite.
        </DialogDescription>
        {showDemoRequestButton && (
          <iframe className="w-full h-full" src={LETS_TALK_FORM_URL} />
        )}
      </BaseDialog>
      <BaseDialog
        open={open}
        onClose={onClose}
        className="flex flex-col justify-center items-end w-[517px] p-4 gap-6 rounded-md bg-white dark:bg-[#1F1E23] text-black dark:text-white shadow-[0px_2px_10px_0px_rgba(0,0,0,0.40)] dark:shadow-[0px_2px_10px_0px_rgba(0,0,0,0.40)]"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Icon
              id="exclamation-outline-triangle"
              className="h-4 w-4 text-red-500 dark:text-white"
            />
            <DialogTitle className="text-[14px]">Your Trial Has Expired!</DialogTitle>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center w-full gap-4">
          <p className="text-xs">
            Thank you for using OpenBB Enterprise. Your trial period has come to an end,
            and you will lose access to key features, including Native Data
            Integrations, Excel Add-In, Security Bolt-Ons & Support, Team Collaboration,
            and Generous Copilot Queries & File Upload Limits.
          </p>
          <p className="text-xs">
            <strong>
              Ready to keep progressing without interruption? Check our{" "}
              <a
                href="https://openbb.co/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                pricing plan!
              </a>
            </strong>{" "}
            Contact us today to extend your trial or upgrade to Enterprise and maintain
            your full access.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} size="sm" variant="outlined">
            Continue with Free Plan
          </Button>
          <Button
            onClick={() => setBookingOpen(true)}
            size="sm"
            variant="primary"
            className="text-white bg-[#EF7D00] hover:bg-[#EF7D00]"
          >
            Upgrade Plan
          </Button>
        </DialogFooter>
      </BaseDialog>
    </>
  );
}
