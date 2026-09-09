import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateZeroToHero } from "~/api/auth.api";
import { TUTORIAL_STEPS, useTutorialStore } from "~/lib/state/tutorial";

vi.mock("~/api/auth.api", () => ({
  updateZeroToHero: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

import posthog from "posthog-js";

describe("Tutorial Store - Additional Tests", () => {
  beforeEach(() => {
    useTutorialStore.setState({
      currentTutorial: null,
      currentStep: 0,
      tutorials: {
        table_charting: null,
        grouping: null,
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      },
    });
    vi.clearAllMocks();
  });

  describe("TUTORIAL_STEPS", () => {
    it("has onboarding steps defined", () => {
      expect(TUTORIAL_STEPS.onboarding).toBeDefined();
      expect(TUTORIAL_STEPS.onboarding.length).toBeGreaterThan(0);
    });

    it("has table_charting steps defined", () => {
      expect(TUTORIAL_STEPS.table_charting).toBeDefined();
      expect(TUTORIAL_STEPS.table_charting.length).toBeGreaterThan(0);
    });

    it("has grouping steps defined", () => {
      expect(TUTORIAL_STEPS.grouping).toBeDefined();
      expect(TUTORIAL_STEPS.grouping.length).toBeGreaterThan(0);
    });

    it("each step has required properties", () => {
      for (const steps of Object.values(TUTORIAL_STEPS)) {
        for (const step of steps) {
          expect(step.title).toBeDefined();
          expect(step.description).toBeDefined();
        }
      }
    });
  });

  describe("restartTutorial", () => {
    it("should track posthog event when restarting", () => {
      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("grouping");

      expect(posthog.capture).toHaveBeenCalledWith("Started_Tutorial", {
        tutorial: "grouping",
      });
    });

    it("should clear existing completion date", () => {
      useTutorialStore.setState({
        tutorials: {
          table_charting: null,
          grouping: "2023-01-01",
          data_connectors: null,
          charting: null,
          group_sector_companies: null,
        },
      });

      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("grouping");

      expect(useTutorialStore.getState().tutorials.grouping).toBeNull();
    });

    it("should set currentStep to 0", () => {
      useTutorialStore.setState({ currentStep: 5 });

      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("data_connectors");

      expect(useTutorialStore.getState().currentStep).toBe(0);
    });
  });

  describe("startTutorial", () => {
    it("should not change state if tutorial already completed", () => {
      useTutorialStore.setState({
        tutorials: {
          table_charting: null,
          grouping: null,
          data_connectors: "2023-06-15",
          charting: null,
          group_sector_companies: null,
        },
        currentTutorial: null,
      });

      const { startTutorial } = useTutorialStore.getState();
      startTutorial("data_connectors");

      expect(useTutorialStore.getState().currentTutorial).toBeNull();
    });

    it("should start tutorial if not completed", () => {
      const { startTutorial } = useTutorialStore.getState();
      startTutorial("charting");

      expect(useTutorialStore.getState().currentTutorial).toBe("charting");
    });
  });

  describe("setCompletedDates", () => {
    it("merges local and cloud challenges", () => {
      useTutorialStore.setState({
        tutorials: {
          table_charting: "2023-01-15",
          grouping: null,
          data_connectors: null,
          charting: null,
          group_sector_companies: null,
        },
      });

      const { setCompletedDates } = useTutorialStore.getState();
      setCompletedDates({
        table_charting: null,
        grouping: "2023-02-20",
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      });

      const tutorials = useTutorialStore.getState().tutorials;
      expect(tutorials.table_charting).toBe("2023-01-15");
      expect(tutorials.grouping).toBe("2023-02-20");
    });

    it("does not sync if challenges match", () => {
      const challenges = {
        table_charting: "2023-01-15",
        grouping: null,
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      };

      useTutorialStore.setState({ tutorials: { ...challenges } });

      const { setCompletedDates } = useTutorialStore.getState();
      setCompletedDates(challenges);

      expect(updateZeroToHero).not.toHaveBeenCalled();
    });
  });

  describe("endTutorial", () => {
    it("does nothing if no current tutorial", () => {
      useTutorialStore.setState({ currentTutorial: null });

      const { endTutorial } = useTutorialStore.getState();
      endTutorial();

      // Should still be null and no API call
      expect(useTutorialStore.getState().currentTutorial).toBeNull();
    });

    it("sets completion timestamp", () => {
      useTutorialStore.setState({
        currentTutorial: "charting",
        tutorials: {
          table_charting: null,
          grouping: null,
          data_connectors: null,
          charting: null,
          group_sector_companies: null,
        },
      });

      const { endTutorial } = useTutorialStore.getState();
      endTutorial();

      const tutorials = useTutorialStore.getState().tutorials;
      expect(tutorials.charting).toBeTruthy();
      expect(typeof tutorials.charting).toBe("string");
    });
  });

  describe("step navigation edge cases", () => {
    it("prevStep can go to negative numbers", () => {
      useTutorialStore.setState({ currentStep: 0 });

      const { prevStep } = useTutorialStore.getState();
      prevStep();

      expect(useTutorialStore.getState().currentStep).toBe(-1);
    });

    it("goToStep with very large number works", () => {
      const { goToStep } = useTutorialStore.getState();
      goToStep(999);

      expect(useTutorialStore.getState().currentStep).toBe(999);
    });
  });
});
