import { Alert, Button } from "@openbb/ui";
import clsx from "clsx";
import { FormEvent, useState } from "react";
import { VERSION, VITE_ADDIN_BASE_URL, VITE_BACKEND_URL } from "~/constants";
import { useAuthStore } from "~/store/auth";
import Disclaimer from "./Disclaimer";

interface UserAlert {
  variant: "error" | "success" | "warning" | "info";
  title: string;
  message?: string;
}

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "excel",
  "X-OpenBB-Client": VITE_ADDIN_BASE_URL,
});

function FeedbackOption({ name }: { name?: string }) {
  return (
    <option value={name?.toLowerCase()}>{name || "Please Select..."}</option>
  );
}

export default function Feedback() {
  const [userAlert, setUserAlert] = useState<UserAlert | null>(null);
  const [selectedFeedbackType, setSelectedFeedbackType] = useState("");
  const [feedback, setFeedback] = useState("");
  const { user } = useAuthStore.getState();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      setUserAlert({
        variant: "error",
        title: "Please login and refresh this page",
        message: "You must be logged in to submit feedback",
      });
      return;
    }
    if (!feedback || feedback.length < 10 || feedback.length > 500) {
      setUserAlert({
        variant: "error",
        title: "Feedback must be between 10 and 500 characters",
        message: "This helps us understand how you feel about the product",
      });
      return;
    }
    if (selectedFeedbackType === "") {
      setUserAlert({
        variant: "error",
        title: "Please select a feedback type",
        message: "This helps us understand how you feel about the product",
      });
      return;
    }
    try {
      const res = await fetch(`${VITE_BACKEND_URL}/feedback`, {
        method: "POST",
        headers: getHeaders(user?.access_token),
        body: JSON.stringify({
          subject: `Excel Feedback : ${selectedFeedbackType}`,
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
        setUserAlert({
          variant: "success",
          title: "Feedback submitted",
          message: "Thank you for your feedback!",
        });
      } else {
        setUserAlert({
          variant: "error",
          title: "Error submitting feedback",
          message: "Please try again later",
        });
      }
    } catch (e) {
      setUserAlert({
        variant: "error",
        title: "Error submitting feedback",
        message: "Please try again later",
      });
    }
  }
  return (
    <div className="flex h-full flex-col items-center gap-5">
      <h1 className="w-full subtitle-md-bold">Feedback</h1>
      <hr className="my-0 w-full" />
      <div
        className={clsx(
          "data-[state=open]:data-[side=bottom]:animate-slideUpAndFade h-full w-full rounded p-4",
          "_dropdown-container",
          "z-50 p-2",
        )}
      >
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <label className="my-0 inline-flex w-full flex-col gap-2">
            Feedback type
            <select
              onChange={(e) => setSelectedFeedbackType(e.target.value)}
              value={selectedFeedbackType}
              className="_minimal-input-search !h-[34px] w-full"
            >
              {["", "Bug", "Feedback", "Feature"].map((name) => (
                <FeedbackOption key={name} name={name} />
              ))}
            </select>
          </label>
          <br />
          <label className="my-2 inline-flex w-full flex-col gap-2">
            Feedback
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter your feedback"
              className="_minimal-input-search max-h-[300px] min-h-[100px] w-full pt-2"
            />
          </label>

          {userAlert && (
            <Alert variant={userAlert.variant} title={userAlert.title}>
              {userAlert.message}
            </Alert>
          )}

          <div className="flex justify-center gap-2 p-5">
            <Button className="_btn-tertiary h-8 px-3 py-1 font-medium md:w-fit">
              Submit
            </Button>
          </div>
          <div className="mt-8 flex flex-1 justify-center">
            <Disclaimer />
          </div>
        </form>
      </div>
    </div>
  );
}
