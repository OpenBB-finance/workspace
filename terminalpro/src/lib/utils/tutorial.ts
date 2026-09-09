import { useTutorialStore } from "../state/tutorial";

export function changeStep(tutorial, step, extraFn?: () => void) {
  const { currentStep, nextStep, currentTutorial } = useTutorialStore.getState();
  if (currentTutorial !== tutorial) return;

  if (currentStep === step) {
    nextStep();
    if (extraFn) extraFn();
  }
}
