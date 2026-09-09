import { useEffect, useMemo, useState } from "react";
import Floater from "react-floater";
import { useLocation, useParams } from "react-router-dom";
import { useShallowAppStore } from "~/lib/state/app";
import {
  TUTORIAL_STEPS,
  type TutorialStep,
  useShallowTutorialStore,
} from "~/lib/state/tutorial";
import { Button } from "../ds/atoms/Button";
import { Dialog, DialogContent } from "../ds/dialogs/Dialog";
import Icon from "../Icon";

const TourGuide = () => {
  const { pathname } = useLocation();
  const { id } = useParams();
  const templateId = useShallowAppStore(
    (state) => state.getTabById(id)?.data?.templateId,
  );
  const { currentTutorial, currentStep, nextStep, prevStep, endTutorial } =
    useShallowTutorialStore((state) => ({
      currentTutorial: state.currentTutorial,
      currentStep: state.currentStep,
      nextStep: state.nextStep,
      prevStep: state.prevStep,
      endTutorial: state.endTutorial,
    }));

  const [isRendered, setIsRendered] = useState(false);

  const { tutorialSteps, step } = useMemo(() => {
    return {
      tutorialSteps: TUTORIAL_STEPS[currentTutorial],
      step: TUTORIAL_STEPS[currentTutorial]?.[currentStep] as TutorialStep,
    };
  }, [TUTORIAL_STEPS[currentTutorial], currentStep]);

  useEffect(() => {
    const delay = step?.delay ?? (currentStep === 0 ? 1000 : 250);

    const timer = setTimeout(() => {
      setIsRendered(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [currentStep, step]);

  useEffect(() => {
    setIsRendered(false);
    if (step?.targetElementSelector) {
      const timer = setTimeout(
        () => {
          const target = document.querySelector(step.targetElementSelector);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        },
        currentStep === 0 ? 2000 : 200,
      );

      return () => clearTimeout(timer);
    }
  }, [step]);

  if (!(currentTutorial && isRendered)) {
    return null; // No tutorial is active, so don't render anything
  }

  if (
    (currentTutorial === "grouping" || currentTutorial === "group_sector_companies") &&
    templateId !== "equityAnalyst"
  )
    return null;

  if (currentTutorial === "charting" && pathname !== "/app/charting") return null;

  if (!step) {
    return null; // No step is active, so don't render anything
  }

  if (!isRendered) {
    return null;
  }

  if (
    !step.targetElementSelector &&
    step.type === "dialog" &&
    currentTutorial === "charting"
  ) {
    return (
      <Dialog open={true}>
        <DialogContent className="bg-[#006699]! text-white rounded-[4px] p-4 max-h-[90vh] overflow-y-auto max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl [&>.DialogXButton]:hidden">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">{step.title}</p>
              <button
                onClick={() => {
                  endTutorial();
                }}
              >
                <Icon id="x" className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div
              className="text-xs"
              dangerouslySetInnerHTML={{ __html: step.description }}
            />
            <button
              className="underline-offset-4 underline mt-4 w-fit ml-auto text-light-300"
              onClick={endTutorial}
            >
              Finish tutorial
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (
    !step.targetElementSelector &&
    step.type === "dialog" &&
    currentTutorial === "onboarding"
  ) {
    return (
      <Dialog open={true}>
        <DialogContent
          className="dark:bg-dark-850 text-white
          rounded-[4px] max-h-[90vh] overflow-y-auto max-w-[90%]
          sm:max-h-[571px] sm:max-w-[507px] [&>.DialogXButton]:hidden"
        />
      </Dialog>
    );
  }

  return (
    <Floater
      key={step.targetElementSelector}
      open={true}
      offset={5}
      placement={step.side ?? "left"}
      styles={{
        arrow: {
          color: "#006699",
        },
        container: {
          backgroundColor: "#006699",
          color: "white",
          borderRadius: 4,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          minHeight: 137,
          minWidth: 280,
        },
      }}
      target={step.targetElementSelector}
      footer={
        <div className="mt-auto flex gap-2.5 justify-between text-xs">
          {currentStep > 0 && currentStep < tutorialSteps.length - 1 && (
            <>
              <Button variant="primary" size="xs" onClick={prevStep}>
                Previous
              </Button>
              <button className="underline-offset-4 underline" onClick={endTutorial}>
                Skip tutorial
              </button>
            </>
          )}
          {currentStep === 0 && (
            <>
              <button
                className="underline-offset-4 underline text-light-300"
                onClick={endTutorial}
              >
                Skip tutorial
              </button>
              <Button variant="primary" size="xs" onClick={nextStep}>
                Start tutorial
              </Button>
            </>
          )}
          {currentStep === tutorialSteps.length - 1 && (
            <>
              <Button variant="primary" size="xs" onClick={prevStep}>
                Previous
              </Button>
              <Button variant="primary" size="xs" onClick={endTutorial}>
                End tutorial
              </Button>
            </>
          )}
        </div>
      }
      content={
        <div
          className="flex flex-col gap-1 mb-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm">{step.title}</p>
            <button
              onClick={() => {
                endTutorial();
              }}
            >
              <Icon id="x" className="w-[18px] h-[18px]" />
            </button>
          </div>
          <div
            className="text-xs"
            dangerouslySetInnerHTML={{ __html: step.description }}
          />
        </div>
      }
    />
  );
};

export default TourGuide;
