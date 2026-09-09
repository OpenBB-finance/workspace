import { useCallback, useEffect, useState } from "react";
import Floater from "react-floater";
import { useNavigate } from "react-router-dom";
import { useWalkthroughActions } from "~/hooks/useWalkthroughActions";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  cleanupWalkthroughPosthogProperties,
  useShallowWalkthroughStore,
  WALKTHROUGH_STEPS,
} from "~/lib/state/walkthrough";
import { showNotification } from "~/lib/utils/toast";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

export function WalkthroughGuide() {
  const isDarkMode = useShallowThemeStore((state) => state.theme === "dark");
  const {
    currentWalkthrough,
    currentStep,
    step,
    walkthroughSteps,
    workingDashboardUUID,
    nextStep,
    prevStep,
    endWalkthrough,
  } = useShallowWalkthroughStore((state) => {
    const walkthroughSteps = WALKTHROUGH_STEPS[state.currentWalkthrough];
    return {
      currentWalkthrough: state.currentWalkthrough,
      currentStep: state.currentStep,
      workingDashboardUUID: state.workingDashboardUUID,
      nextStep: state.nextStep,
      prevStep: state.prevStep,
      endWalkthrough: state.endWalkthrough,
      walkthroughSteps,
      step: walkthroughSteps?.[state.currentStep],
    };
  });
  const navigate = useNavigate();

  const [isRendered, setIsRendered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walkthroughActions = useWalkthroughActions();

  const executeAction = useCallback(
    async (actionName: keyof typeof walkthroughActions | undefined) => {
      if (!actionName) return;

      try {
        setIsLoading(true);
        setError(null);

        const action = walkthroughActions[actionName];

        if (typeof action === "function") {
          await action();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("error", error);
      } finally {
        setIsLoading(false);
      }
    },
    [error, walkthroughActions],
  );

  const handleContinue = useCallback(async () => {
    if (!step) return;
    if ("onContinueAction" in step && step.onContinueAction) {
      if (Array.isArray(step.onContinueAction)) {
        for (const action of step.onContinueAction) {
          await executeAction(action);
        }
      } else {
        await executeAction(step.onContinueAction);
      }
    }
    if (
      !("skipAutoNavigateBack" in step && step.skipAutoNavigateBack) &&
      window.location.pathname !== `/app/${workingDashboardUUID}`
    ) {
      navigate(`/app/${workingDashboardUUID}`);
    }
    nextStep();
  }, [executeAction, navigate, nextStep, step, workingDashboardUUID]);

  useEffect(() => {
    const delay = currentStep === 0 ? 300 : 400;

    const timer = setTimeout(() => {
      setIsRendered(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [step]);

  const handleElementSelection = useCallback(
    async (retryCount = 0): Promise<void> => {
      if (!step) return;
      if ("beforeElementSelectionAction" in step) {
        await executeAction(step.beforeElementSelectionAction);
      }

      if (step?.targetElementSelector) {
        const target = document.querySelector(step.targetElementSelector);

        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (retryCount < 10) {
          // Element not found, retry after 200ms
          await new Promise((resolve) => setTimeout(resolve, 200));
          return handleElementSelection(retryCount + 1);
        }
      }
    },
    [executeAction, step],
  );

  useEffect(() => {
    setIsRendered(false);

    const delay = currentStep === 0 ? 800 : 100;

    const timer = setTimeout(() => handleElementSelection(), delay);

    return () => clearTimeout(timer);
    // Re-run when step or walkthrough changes, not when handleElementSelection reference changes.
    // This prevents isRendered from being reset to false on refresh due to walkthroughActions initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, currentWalkthrough]);

  useEffect(() => {
    if (currentWalkthrough) {
      const handleBodyClick = (e: MouseEvent) => {
        const isInsideFloater = (e.target as Element).closest("#react-floater-portal");
        const isInsideToast = (e.target as Element).closest("[data-sonner-toaster]");
        const isContextButton = (e.target as Element).closest("#expand-copilot-btn");

        if (!(isInsideFloater || isInsideToast || isContextButton)) {
          e.preventDefault();
          e.stopPropagation();
          showNotification({
            message: "Actions blocked",
            description:
              "You can't perform this action while the walkthrough is active. Please finish or close it to continue.",
            toastType: "warning",
            cancel: {
              label: "Skip Walkthrough",
              onClick: () => {
                endWalkthrough();
              },
            },
          });
        }
      };

      document.body.addEventListener("click", handleBodyClick, { capture: true });

      return () => {
        document.body.removeEventListener("click", handleBodyClick, { capture: true });
      };
    }
  }, [currentWalkthrough]);

  // Cleanup PostHog properties when the walkthrough is finished
  useEffect(() => {
    if (!currentWalkthrough) {
      cleanupWalkthroughPosthogProperties();
    }
  }, [currentWalkthrough]);

  if (!(currentWalkthrough && step && isRendered)) {
    return null;
  }

  return (
    <div className="z-999">
      <Floater
        key={step.targetElementSelector}
        open={true}
        offset={5}
        placement={step.side ?? "left"}
        styles={{
          arrow: {
            color: isDarkMode ? "var(--brand-darker)" : "var(--brand-main)",
          },
          container: {
            backgroundColor: isDarkMode ? "var(--brand-darker)" : "var(--brand-main)",
            color: "white",
            borderRadius: 4,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            minHeight: 137,
            minWidth: 300,
          },
          floater: {
            maxWidth: 350,
          },
        }}
        target={step.targetElementSelector}
        footer={
          <div className="mt-auto flex gap-2.5 justify-between text-xs pointer-events-auto">
            {currentStep === 0 ? (
              <div className="flex justify-end w-full">
                <Button
                  variant="primary"
                  size="xs"
                  onClick={handleContinue}
                  disabled={isLoading}
                >
                  Start
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={prevStep}
                  disabled={isLoading}
                >
                  Previous
                </Button>
                {currentStep < walkthroughSteps.length - 1 ? (
                  isLoading ? (
                    <Tooltip message="Copilot is still generating an answer">
                      <div>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={handleContinue}
                          className="ml-auto pointer-events-auto"
                          disabled={isLoading}
                        >
                          Show me
                        </Button>
                      </div>
                    </Tooltip>
                  ) : (
                    <div>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={handleContinue}
                        className="ml-auto pointer-events-auto"
                        disabled={isLoading}
                      >
                        Show me
                      </Button>
                    </div>
                  )
                ) : isLoading ? (
                  <Tooltip message="Copilot is still generating an answer">
                    <div>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={endWalkthrough}
                        className="ml-auto pointer-events-auto"
                        disabled={isLoading}
                      >
                        Done
                      </Button>
                    </div>
                  </Tooltip>
                ) : (
                  <div>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={endWalkthrough}
                      className="ml-auto pointer-events-auto"
                      disabled={isLoading}
                    >
                      Done
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        }
        content={
          <div
            className="flex flex-col gap-1"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-2xs text-white/80 tracking-[0.1em]">
                  STEP {currentStep + 1} OF {walkthroughSteps.length}
                </p>
                <button
                  className="pointer-events-auto"
                  onClick={() => {
                    showNotification({
                      message: "Skip Walkthrough",
                      description:
                        "Are you sure you want to skip the walkthrough? This action cannot be undone.",
                      toastType: "warning",
                      cancel: {
                        label: "Skip Walkthrough",
                        onClick: endWalkthrough,
                      },
                    });
                  }}
                >
                  <Icon id="x" className="size-[18px]" />
                </button>
              </div>
              <p className="font-bold text-sm">{step.title}</p>
            </div>
            <div className="text-xs mb-4">{step.description}</div>
          </div>
        }
      />
    </div>
  );
}

export default WalkthroughGuide;
