import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateZeroToHero } from "~/api/auth.api";
import { useTutorialStore } from "~/lib/state/tutorial";

vi.mock("~/api/auth.api", () => ({
  updateZeroToHero: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

describe("Tutorial Store", () => {
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

  it("should start a tutorial", () => {
    const { startTutorial } = useTutorialStore.getState();
    startTutorial("table_charting");

    const state = useTutorialStore.getState();
    expect(state.currentTutorial).toBe("table_charting");
    expect(state.currentStep).toBe(0);
  });

  it("should not start a tutorial if already completed", () => {
    useTutorialStore.setState({
      tutorials: {
        table_charting: "2023-01-01",
        grouping: null,
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      },
    });

    const { startTutorial } = useTutorialStore.getState();
    startTutorial("table_charting");

    const state = useTutorialStore.getState();
    expect(state.currentTutorial).toBeNull();
  });

  it("should restart a tutorial even if completed", () => {
    useTutorialStore.setState({
      tutorials: {
        table_charting: "2023-01-01",
        grouping: null,
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      },
    });

    const { restartTutorial } = useTutorialStore.getState();
    restartTutorial("table_charting");

    const state = useTutorialStore.getState();
    expect(state.currentTutorial).toBe("table_charting");
    expect(state.tutorials.table_charting).toBeNull();
  });

  it("should navigate through steps", () => {
    const { nextStep, prevStep, goToStep } = useTutorialStore.getState();

    nextStep();
    expect(useTutorialStore.getState().currentStep).toBe(1);

    nextStep();
    expect(useTutorialStore.getState().currentStep).toBe(2);

    prevStep();
    expect(useTutorialStore.getState().currentStep).toBe(1);

    goToStep(5);
    expect(useTutorialStore.getState().currentStep).toBe(5);
  });

  it("should end a tutorial and update backend", () => {
    useTutorialStore.setState({ currentTutorial: "table_charting" });
    const { endTutorial } = useTutorialStore.getState();

    endTutorial();

    const state = useTutorialStore.getState();
    expect(state.currentTutorial).toBeNull();
    expect(state.tutorials.table_charting).toBeTruthy(); // Should be an ISO string
    expect(updateZeroToHero).toHaveBeenCalled();
  });

  it("should set completed dates and sync with backend if local state has newer info", () => {
    // Set local state with some completed tutorial
    useTutorialStore.setState({
      tutorials: {
        table_charting: "2023-01-01T00:00:00.000Z",
        grouping: null,
        data_connectors: null,
        charting: null,
        group_sector_companies: null,
      },
    });

    const { setCompletedDates } = useTutorialStore.getState();
    // Pass challenges where table_charting is null (e.g. cloud is behind)
    const cloudChallenges = {
      table_charting: null,
      grouping: null,
      data_connectors: null,
      charting: null,
      group_sector_companies: null,
    };

    setCompletedDates(cloudChallenges);

    const state = useTutorialStore.getState();
    // Combined should have the local date
    expect(state.tutorials.table_charting).toBe("2023-01-01T00:00:00.000Z");
    // Since combined != cloudChallenges, it should sync to backend
    expect(updateZeroToHero).toHaveBeenCalledWith(state.tutorials);
  });
});
