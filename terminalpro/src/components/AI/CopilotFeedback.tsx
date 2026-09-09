import { usePostHog } from "posthog-js/react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useGetCopilotRequestHeaders } from "~/components/AI/hooks/useGetCopilotRequestHeaders";
import { useStateReducer } from "~/hooks/useStateReducer";
import { type AIMessage, useShallowCopilotStore } from "~/lib/state/copilot";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

type VoteType = "thumbs_up" | "thumbs_down" | null;

type AIMessageFeedback = {
  voteStatus: VoteType;
  tags?: string[];
  user_comment?: string;
  showFeedbackModal?: boolean;
  loading?: boolean;
};

const FEEDBACK_OPTIONS = [
  "Not factually correct / Hallucinations / Inaccurate",
  "Didn't use the correct data (although it's available)",
  "Didn't fully follow instructions / Lazy / Incomplete",
  "OpenBB didn't have the right data for copilot to answer correctly",
  "Other",
] as const;

const TOOLTIP_PARAMS = {
  thumbs_up: {
    content: "You voted this answer as satisfactory",
    icon: "thumbs-up-fill-icon" as const,
  },
  thumbs_down: {
    content: "You voted this answer as unsatisfactory",
    icon: "thumbs-down-fill-icon" as const,
  },
};

export function CopilotFeedback({ message }: { message: AIMessage }) {
  const { updateAIMessage, getUserPromptForAIMessage, selectedCopilot } =
    useShallowCopilotStore((s) => ({
      updateAIMessage: s.updateAIMessage,
      getUserPromptForAIMessage: s.getUserPromptForAIMessage,
      selectedCopilot: s.selectedCopilot,
    }));

  const posthog = usePostHog();
  const getCopilotRequestHeaders = useGetCopilotRequestHeaders();
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  const [state, dispatch] = useStateReducer<AIMessageFeedback>({
    voteStatus: message.voteStatus ?? null,
    tags: [],
    user_comment: "",
    showFeedbackModal: false,
    loading: false,
  });

  const resetFeedback = useCallback(
    () =>
      dispatch({
        showFeedbackModal: false,
        tags: [],
        user_comment: "",
        voteStatus: message.voteStatus ?? null,
      }),
    [message.voteStatus, dispatch],
  );

  // Update the feedback submission logic in the onClick handler
  const handleFeedback = useCallback(
    async (vote: "thumbs_up" | "thumbs_down") => {
      const updatedState = {} as AIMessageFeedback;

      try {
        if (vote === "thumbs_down" && state.tags.length === 0) return;

        dispatch({ loading: true });

        updatedState.loading = false;

        const agentSupportsFeedback =
          selectedCopilot?.features?.feedback && selectedCopilot?.endpoints?.feedback;

        if (agentSupportsFeedback) {
          const feedbackPayload = {
            vote,
            tags: state.tags,
            user_comment: state.user_comment,
            ai_response: message.content,
            user_prompt: getUserPromptForAIMessage(message) ?? "",
            trace_id: message.traceId ?? "",
          };

          console.log(
            "[Feedback] Sending to agent:",
            selectedCopilot.endpoints.feedback,
            feedbackPayload,
          );

          const response = await fetch(selectedCopilot.endpoints.feedback, {
            method: "POST",
            headers: getCopilotRequestHeaders(message.traceId),
            body: JSON.stringify(feedbackPayload),
          });

          console.log("[Feedback] Agent response:", response.status);

          if (!response.ok) {
            throw new Error(`Agent feedback endpoint returned ${response.status}`);
          }
        } else if (posthog) {
          posthog.capture("ai_feedback", {
            copilot_feedback_direction: vote,
            copilot_feedback_group: state.tags,
            copilot_feedback_message: state.user_comment,
            copilot_response: message.content,
            copilot_user_prompt: getUserPromptForAIMessage(message),
            trace_id: message.traceId,
          });
        }

        updatedState.voteStatus = vote;
        updateAIMessage("voteStatus", vote, message.timestamp);
        toast.success("Thank you for your feedback!");

        if (vote === "thumbs_down") {
          updatedState.showFeedbackModal = false;
          updatedState.tags = [];
          updatedState.user_comment = "";
        }
      } catch (error) {
        toast.error("Failed to submit feedback");
        console.error("Error submitting feedback:", error);
        updatedState.voteStatus = null;
      } finally {
        if (Object.keys(updatedState).length > 0) {
          dispatch(updatedState);
        }
      }
    },
    [
      posthog,
      state.tags,
      state.user_comment,
      message,
      dispatch,
      updateAIMessage,
      getUserPromptForAIMessage,
      selectedCopilot,
      getCopilotRequestHeaders,
    ],
  );

  const agentHasFeedback = selectedCopilot?.features?.feedback;
  if (!message?.completionId && !agentHasFeedback) return null;

  return (
    <>
      {state.voteStatus ? (
        <Tooltip message={TOOLTIP_PARAMS[state.voteStatus].content}>
          <div className="p-1.25">
            <Icon
              id={TOOLTIP_PARAMS[state.voteStatus].icon}
              className="h-3.5 w-3.5 text-light-600 dark:text-light-300"
            />
          </div>
        </Tooltip>
      ) : (
        <>
          <Tooltip message="Report a satisfactory answer">
            <button
              onClick={() => {
                dispatch({ voteStatus: "thumbs_up" });
                handleFeedback("thumbs_up");
              }}
              className="hover:opacity-80"
            >
              <div className="p-1.25">
                <Icon
                  id="thumbs-up-icon"
                  className="h-3.5 w-3.5 text-light-600 dark:text-light-300"
                />
              </div>
            </button>
          </Tooltip>
          <Tooltip message="Report an unsatisfactory answer">
            <button
              onClick={() =>
                dispatch({ showFeedbackModal: true, voteStatus: "thumbs_down" })
              }
              className="hover:opacity-80"
            >
              <div className="p-1.25">
                <Icon
                  id="thumbs-down-icon"
                  className="h-3.5 w-3.5 text-light-600 dark:text-light-300"
                />
              </div>
            </button>
          </Tooltip>
        </>
      )}
      {state.showFeedbackModal && (
        <BaseDialog
          className="max-w-md"
          open={state.showFeedbackModal}
          onClose={resetFeedback}
        >
          <DialogTitle>Unsatisfactory copilot response</DialogTitle>
          <div className="space-y-4">
            {FEEDBACK_OPTIONS.map((option, index) => (
              <Checkbox
                key={index}
                label={option}
                checked={state.tags.includes(option)}
                onCheckedChange={(checked) =>
                  dispatch({
                    tags: (tags) => {
                      if (checked) {
                        return [...tags, option];
                      }
                      return tags.filter((tag) => tag !== option);
                    },
                  })
                }
              />
            ))}
          </div>
          <hr className="my-2 border-light-200 dark:border-dark-400" />
          <label className="inline-flex flex-col">
            <span>
              Additional Feedback{" "}
              <span className="text-light-500 dark:text-light-400 italic">
                (optional)
              </span>
            </span>
            <textarea
              placeholder="Add more details about your experience"
              className="text-xs p-2 overflow-y-auto w-full resize-none overflow-hidden
                bg-white border-light-300 text-light-900 dark:bg-dark-750 border
                dark:border-dark-300 dark:text-light-50 rounded my-1.5"
              rows={3}
              ref={feedbackInputRef}
              defaultValue={state.user_comment}
              onChange={(e) => {
                dispatch({ user_comment: e.target.value });
                if (!state.tags.includes("Other")) {
                  dispatch({ tags: (tags) => [...tags, "Other"] });
                }

                if (feedbackInputRef.current && !feedbackInputRef.current.value) {
                  feedbackInputRef.current.value = "";
                }
              }}
            />
          </label>
          <DialogFooter>
            <Button variant="outlined" size="sm" onClick={resetFeedback}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleFeedback("thumbs_down")}
              disabled={state.tags.length === 0}
              loading={state.loading}
            >
              Submit
            </Button>
          </DialogFooter>
        </BaseDialog>
      )}
    </>
  );
}
