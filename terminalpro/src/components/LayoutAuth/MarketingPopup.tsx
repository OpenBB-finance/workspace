import dayjs from "dayjs";
import { useLocalStorage } from "usehooks-ts";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";

const webinarStartTime = dayjs.tz("2025-06-17T12:00:00", "America/New_York");

export default function MarketingPopup() {
  const { isProTier } = useShallowFeatureFlagsStore((state) => ({
    isProTier: state.featureFlags?.tier === "pro",
  }));
  const [webinarMay72025, setWebinarMay72025] = useLocalStorage(
    "webinar-june17-2025",
    dayjs().isBefore(webinarStartTime.add(1, "hour")),
  );

  const onClose = () => {
    setWebinarMay72025(false);
  };

  if (!webinarMay72025) return null;

  return (
    <BaseDialog
      open={webinarMay72025 && !isProTier} // we dont want to show the popup if the user is in pro tier
      onClose={onClose}
      className="p-0 gap-0"
    >
      <div className="w-full h-[180px]">
        <img
          src="https://openbb-cms.directus.app/assets/424d50c0-d30e-4415-8282-bfbc81cd567c?cachebuster=171523011200"
          alt=""
          className="w-full h-full only-sm:object-contain object-cover rounded-none sm:rounded-t"
        />
      </div>
      <div className="p-4 space-y-2.5">
        <DialogTitle>Join our webinar on June 17, 12:00 PM</DialogTitle>
        <DialogDescription>
          Explore how you can go from isolated AI agents to AI-assisted analytics
          workflows in this technical session led by our Head of AI, Michael Struwig.
          Leverage our advanced UI capabilities while maintaining full control over your
          AI implementation by bringing custom agents into the OpenBB Workspace. Join
          our webinar to learn more.
        </DialogDescription>
        <a
          href="https://us06web.zoom.us/webinar/register/3017471488150/WN_bm-dJ9yNTB2Kmvi2D-TMlA"
          target="_blank"
          rel="noreferrer noopener"
        >
          <Button variant="primary" size="sm" onClick={onClose}>
            Register now
          </Button>
        </a>
      </div>
    </BaseDialog>
  );
}
