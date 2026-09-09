import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowWalkthroughStore } from "~/lib/state/walkthrough";
import { getAvailableTemplates } from "~/lib/templates";
import { uuidv4 } from "~/lib/utils";
import { createOnBoardingTemplate } from "~/lib/utils/createTemplates";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import WalkthroughIllustration from "../Icons/WalkthroughIllustration";

interface WelcomeMessageProps {
  open: boolean;
  tier: string;
  isHelpPage?: boolean;
  onClose: () => void;
}

export default function WelcomeMessage({
  open,
  isHelpPage,
  onClose,
}: WelcomeMessageProps) {
  const addTab = useShallowAppStore((state) => state.addTab);
  const { restartWalkthrough, endWalkthrough } = useShallowWalkthroughStore(
    (state) => ({
      restartWalkthrough: state.restartWalkthrough,
      endWalkthrough: state.endWalkthrough,
    }),
  );
  const navigate = useNavigate();

  const handleClose = useCallback(
    (isHelpPage: boolean) => {
      const toastDescription = (
        <span>
          You've skipped the walkthrough. You can access it later in the{" "}
          <Link to="/app/help-documentation" className="underline font-medium">
            Help and Documentation
          </Link>{" "}
          page.
        </span>
      );
      toast.info("Walkthrough skipped", {
        description: toastDescription,
      });
      onClose();
      if (!isHelpPage) {
        endWalkthrough();
        getAvailableTemplates().includes("onboarding") &&
          createOnBoardingTemplate({ addTab, navigate });
      }
    },
    [addTab, endWalkthrough, navigate, onClose],
  );

  const handleGeneralWalkthrough = useCallback(() => {
    onClose();
    const id = uuidv4();
    restartWalkthrough("analyst_walkthrough", id);
    addTab({
      index: id,
      data: {
        name: "Getting Started",
        type: "custom",
        widgets: [],
      },
    });
    setTimeout(() => {
      navigate(`/app/${id}`);
    }, 100);
  }, [addTab, navigate, onClose, restartWalkthrough]);

  return (
    <BaseDialog
      open={open}
      onClose={() => handleClose(isHelpPage)}
      className="p-0 gap-0 overflow-hidden"
    >
      <div className="w-full h-[340px] bg-brand-darker px-28 py-8 flex items-center justify-center">
        <WalkthroughIllustration />
      </div>
      <div className="bg-white p-8">
        <p className="body-lg-bold text-light-900 dark:text-light-900">
          Welcome to OpenBB Workspace 👋
        </p>
        <p className="mt-2.5 mb-6 body-md-regular text-light-900 dark:text-light-900">
          We've prepared a walkthrough to help you get started.
        </p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="primary" onClick={handleGeneralWalkthrough}>
            Get started
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="body-xs-medium text-light-900 dark:text-light-900 underline"
            onClick={() => handleClose(isHelpPage ?? false)}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </BaseDialog>
  );
}
