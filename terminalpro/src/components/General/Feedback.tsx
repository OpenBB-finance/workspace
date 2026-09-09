import { type FormEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { VERSION } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore } from "~/lib/state/theme";
import { getHeaders } from "~/lib/utils/fetch";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";

function FeedbackOption({ name }: { name?: string }) {
  return <option value={name.toLowerCase()}>{name || "What brings you here?"}</option>;
}

export const uiShowFeedbackButtonFF = getConfig().ui.showFeedbackButton;
const servicesHubspotFormsFF = getConfig().services.hubspotForms;

export const isFeedbackEnabled = uiShowFeedbackButtonFF && servicesHubspotFormsFF;

export default function Feedback() {
  const { feedbackOpen, setFeedbackOpen } = useShallowThemeStore((state) => ({
    feedbackOpen: state.feedbackOpen,
    setFeedbackOpen: state.setFeedbackOpen,
  }));

  const [selectedFeedbackType, setSelectedFeedbackType] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const { user } = useAuthStore();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!feedback || feedback.length < 10 || feedback.length > 500) {
      toast.error("Feedback must be between 10 and 500 characters", {
        description: "This helps us understand how you feel about the product",
      });
      return;
    }
    if (selectedFeedbackType === "") {
      toast.error("Please select a feedback type", {
        description: "This helps us understand how you feel about the product",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getConfig().urls.backend}/feedback`, {
        method: "POST",
        headers: getHeaders(user?.token),
        body: JSON.stringify({
          subject: `Workspace Feedback : ${selectedFeedbackType}`,
          hs_pipeline_stage: 131040887,
          hs_pipeline: 66932112,
          ticket_email: user?.email,
          content: feedback,
          ticket_type: selectedFeedbackType,
          location_page: location.pathname,
          version: VERSION,
        }),
      });
      if (res.status === 200) {
        toast.success("Feedback submitted", {
          description: "Thank you for your feedback!",
        });
        setFeedbackOpen(false);
      } else {
        toast.error("Error submitting feedback", {
          description: "Please try again later",
        });
      }
    } catch (_e) {
      toast.error("Error submitting feedback", {
        description: "Please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isFeedbackEnabled) return null;

  return (
    <BaseDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)}>
      <DialogTitle>How can we help?</DialogTitle>
      <DialogDescription>
        Report a bug, share feedback, or suggest a feature.
      </DialogDescription>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="inline-flex w-full flex-col gap-2">
          <select
            onChange={(e) => setSelectedFeedbackType(e.target.value)}
            value={selectedFeedbackType}
            className="obb-minimal-input-search h-[34px]! w-full"
          >
            {["", "Report a bug", "Share feedback", "Request a feature"].map((name) => (
              <FeedbackOption key={name} name={name} />
            ))}
          </select>
        </label>
        <label className="inline-flex w-full flex-col gap-2">
          <textarea
            required={true}
            minLength={10}
            maxLength={500}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us more"
            className="obb-minimal-input-search h-24 w-full pt-2"
          />
        </label>

        <DialogFooter>
          <Button
            variant="outlined"
            size="sm"
            type="button"
            onClick={() => setFeedbackOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button size="sm" type="submit" disabled={isSubmitting}>
            Submit
          </Button>
        </DialogFooter>
      </form>
    </BaseDialog>
  );
}
