/**
 * Tests for walkthrough Zustand store
 *
 * Tests the walkthrough/tutorial state management including:
 * - Walkthrough start/restart
 * - Step navigation (next, prev, goTo)
 * - Walkthrough completion and ending
 * - PostHog analytics tracking
 * - Completed dates management
 * - State persistence and migration
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WALKTHROUGH_STEPS,
  cleanupWalkthroughPosthogProperties,
  useWalkthroughStore,
} from "~/lib/state/walkthrough";
import type { Walkthroughs } from "~/types/auth.type";

// Mock external dependencies
vi.mock("~/api/auth.api", () => ({
  updateZeroToHero: vi.fn().mockResolvedValue({}),
}));

vi.mock("dayjs", () => {
  const mockDayjs = () => ({
    toISOString: () => "2024-01-15T12:00:00.000Z",
    format: () => "2024-01-15",
    isSameOrAfter: () => true,
    quarter: () => 1,
    add: () => mockDayjs(),
    subtract: () => mockDayjs(),
  });
  mockDayjs.extend = vi.fn();
  mockDayjs.locale = vi.fn();
  return {
    default: mockDayjs,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

import posthog from "posthog-js";
import { toast } from "sonner";
import { updateZeroToHero } from "~/api/auth.api";

const DEFAULT_WALKTHROUGHS: Walkthroughs = {
  analyst_walkthrough: null,
};

describe("useWalkthroughStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    act(() => {
      useWalkthroughStore.setState({
        currentWalkthrough: null,
        currentStep: 0,
        walkthroughs: { ...DEFAULT_WALKTHROUGHS },
        workingDashboardUUID: null,
        copilotArtifact: null,
      });
    });
  });

  describe("initial state", () => {
    it("should have correct default values", () => {
      const state = useWalkthroughStore.getState();

      expect(state.currentWalkthrough).toBeNull();
      expect(state.currentStep).toBe(0);
      expect(state.walkthroughs).toEqual(DEFAULT_WALKTHROUGHS);
      expect(state.workingDashboardUUID).toBeNull();
      expect(state.copilotArtifact).toBeNull();
    });

    it("should have analyst_walkthrough defined in WALKTHROUGH_STEPS", () => {
      expect(WALKTHROUGH_STEPS.analyst_walkthrough).toBeDefined();
      expect(WALKTHROUGH_STEPS.analyst_walkthrough.length).toBeGreaterThan(0);
    });

    it("should have required properties on each step", () => {
      const steps = WALKTHROUGH_STEPS.analyst_walkthrough;

      for (const step of steps) {
        expect(step.id).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.targetElementSelector).toBeDefined();
        expect(step.description).toBeDefined();
      }
    });
  });

  describe("restartWalkthrough", () => {
    it("should start a walkthrough", () => {
      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-123");
      });

      const state = useWalkthroughStore.getState();
      expect(state.currentWalkthrough).toBe("analyst_walkthrough");
      expect(state.currentStep).toBe(0);
      expect(state.workingDashboardUUID).toBe("dashboard-123");
    });

    it("should reset current step to 0", () => {
      act(() => {
        useWalkthroughStore.setState({ currentStep: 5 });
      });

      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-456");
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(0);
    });

    it("should reset completed date for the walkthrough", () => {
      act(() => {
        useWalkthroughStore.setState({
          walkthroughs: {
            analyst_walkthrough: "2024-01-01T00:00:00.000Z",
          },
        });
      });

      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-123");
      });

      expect(
        useWalkthroughStore.getState().walkthroughs.analyst_walkthrough,
      ).toBeNull();
    });

    it("should register PostHog properties", () => {
      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-123");
      });

      expect(posthog.register).toHaveBeenCalledWith({
        isWalkthrough: true,
        walkthroughName: "analyst_walkthrough",
      });
    });

    it("should capture Started_Walkthrough event", () => {
      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-123");
      });

      expect(posthog.capture).toHaveBeenCalledWith("Started_Walkthrough", {
        walkthroughName: "analyst_walkthrough",
      });
    });
  });

  describe("nextStep", () => {
    it("should increment current step", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(1);
    });

    it("should capture step completion event", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      expect(posthog.capture).toHaveBeenCalledWith("Completed_Step_0", {
        walkthroughName: "analyst_walkthrough",
        stepId: "general-intro",
        step: 0,
      });
    });

    it("should increment through multiple steps", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(3);
    });
  });

  describe("prevStep", () => {
    it("should decrement current step", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 3,
        });
      });

      act(() => {
        useWalkthroughStore.getState().prevStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(2);
    });

    it("should decrement through multiple steps", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 5,
        });
      });

      act(() => {
        useWalkthroughStore.getState().prevStep();
        useWalkthroughStore.getState().prevStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(3);
    });
  });

  describe("goToStep", () => {
    it("should set current step to specific value", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().goToStep(5);
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(5);
    });

    it("should allow going to step 0", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 5,
        });
      });

      act(() => {
        useWalkthroughStore.getState().goToStep(0);
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(0);
    });
  });

  describe("endWalkthrough", () => {
    it("should reset walkthrough state", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 3,
          workingDashboardUUID: "dashboard-123",
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      const state = useWalkthroughStore.getState();
      expect(state.currentWalkthrough).toBeNull();
      expect(state.currentStep).toBe(0);
      expect(state.workingDashboardUUID).toBeNull();
    });

    it("should set completed date for walkthrough", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(useWalkthroughStore.getState().walkthroughs.analyst_walkthrough).toBe(
        "2024-01-15T12:00:00.000Z",
      );
    });

    it("should call updateZeroToHero API", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(updateZeroToHero).toHaveBeenCalled();
    });

    it("should cleanup PostHog properties", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(posthog.unregister).toHaveBeenCalledWith("isWalkthrough");
      expect(posthog.unregister).toHaveBeenCalledWith("walkthroughName");
    });

    it("should capture Finished_Walkthrough when on last step", () => {
      const lastStepIndex = WALKTHROUGH_STEPS.analyst_walkthrough.length - 1;

      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: lastStepIndex,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(posthog.capture).toHaveBeenCalledWith("Finished_Walkthrough", {
        walkthroughName: "analyst_walkthrough",
      });
    });

    it("should show success toast when walkthrough is finished", () => {
      const lastStepIndex = WALKTHROUGH_STEPS.analyst_walkthrough.length - 1;

      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: lastStepIndex,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Walkthrough completed!",
        expect.objectContaining({
          description: "Congratulations! You've completed the walkthrough.",
          action: expect.any(Object),
        }),
      );
    });

    it("should capture Left_Walkthrough when not on last step", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 2,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(posthog.capture).toHaveBeenCalledWith("Left_Walkthrough", {
        walkthroughName: "analyst_walkthrough",
        stepId: "general-meet-copilot",
        step: 2,
      });
    });

    it("should capture Skipped_Walkthrough when no current walkthrough", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: null,
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(posthog.capture).toHaveBeenCalledWith("Skipped_Walkthrough", {});
    });

    it("should not modify state when current walkthrough is null", () => {
      const walkthroughs = { analyst_walkthrough: null };

      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: null,
          walkthroughs,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(useWalkthroughStore.getState().walkthroughs).toEqual(walkthroughs);
    });
  });

  describe("setCompletedDates", () => {
    it("should update walkthroughs with new completed dates", () => {
      const newWalkthroughs: Walkthroughs = {
        analyst_walkthrough: "2024-02-01T00:00:00.000Z",
      };

      act(() => {
        useWalkthroughStore.getState().setCompletedDates(newWalkthroughs);
      });

      expect(useWalkthroughStore.getState().walkthroughs.analyst_walkthrough).toBe(
        "2024-02-01T00:00:00.000Z",
      );
    });

    it("should call updateZeroToHero when walkthroughs change", () => {
      const newWalkthroughs: Walkthroughs = {
        analyst_walkthrough: "2024-02-01T00:00:00.000Z",
      };

      act(() => {
        useWalkthroughStore.getState().setCompletedDates(newWalkthroughs);
      });

      expect(updateZeroToHero).toHaveBeenCalledWith(newWalkthroughs);
    });

    it("should not call updateZeroToHero when walkthroughs are equal", () => {
      const walkthroughs: Walkthroughs = {
        analyst_walkthrough: "2024-02-01T00:00:00.000Z",
      };

      act(() => {
        useWalkthroughStore.setState({ walkthroughs });
      });

      vi.clearAllMocks();

      act(() => {
        useWalkthroughStore.getState().setCompletedDates(walkthroughs);
      });

      expect(updateZeroToHero).not.toHaveBeenCalled();
    });

    it("should combine old and new walkthrough versions", () => {
      act(() => {
        useWalkthroughStore.setState({
          walkthroughs: {
            analyst_walkthrough: "2024-01-01T00:00:00.000Z",
          },
        });
      });

      const newWalkthroughs: Walkthroughs = {
        analyst_walkthrough: null,
      };

      act(() => {
        useWalkthroughStore.getState().setCompletedDates(newWalkthroughs);
      });

      expect(useWalkthroughStore.getState().walkthroughs.analyst_walkthrough).toBe(
        "2024-01-01T00:00:00.000Z",
      );
    });
  });

  describe("cleanupWalkthroughPosthogProperties", () => {
    it("should unregister walkthrough PostHog properties", () => {
      cleanupWalkthroughPosthogProperties();

      expect(posthog.unregister).toHaveBeenCalledWith("isWalkthrough");
      expect(posthog.unregister).toHaveBeenCalledWith("walkthroughName");
    });
  });

  describe("WALKTHROUGH_STEPS structure", () => {
    it("should have general-intro as first step", () => {
      expect(WALKTHROUGH_STEPS.analyst_walkthrough[0].id).toBe("general-intro");
    });

    it("should have general-help-docs as last step", () => {
      const lastStep = WALKTHROUGH_STEPS.analyst_walkthrough.at(-1);
      expect(lastStep?.id).toBe("general-help-docs");
    });

    it("should have valid side values", () => {
      const validSides = ["top", "bottom", "right", "left", undefined];

      for (const step of WALKTHROUGH_STEPS.analyst_walkthrough) {
        expect(validSides).toContain(step.side);
      }
    });

    it("should have unique step IDs", () => {
      const ids = WALKTHROUGH_STEPS.analyst_walkthrough.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("step properties", () => {
    it("should have onContinueAction on steps that need it", () => {
      const stepWithAction = WALKTHROUGH_STEPS.analyst_walkthrough.find(
        (s) => s.id === "general-intro",
      );
      expect(stepWithAction?.onContinueAction).toBe("expandCopilot");
    });

    it("should have beforeElementSelectionAction on steps that need it", () => {
      const stepWithBeforeAction = WALKTHROUGH_STEPS.analyst_walkthrough.find(
        (s) => s.id === "general-intro",
      );
      expect(stepWithBeforeAction?.beforeElementSelectionAction).toBe("newCopilotChat");
    });

    it("should have skipAutoNavigateBack for adding apps step", () => {
      const appsStep = WALKTHROUGH_STEPS.analyst_walkthrough.find(
        (s) => s.id === "general-adding-apps",
      );
      expect(appsStep?.skipAutoNavigateBack).toBe(true);
    });
  });

  describe("state transitions", () => {
    it("should handle complete walkthrough flow", () => {
      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-1");
      });

      expect(useWalkthroughStore.getState().currentWalkthrough).toBe(
        "analyst_walkthrough",
      );
      expect(useWalkthroughStore.getState().currentStep).toBe(0);

      act(() => {
        useWalkthroughStore.getState().nextStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(1);

      act(() => {
        useWalkthroughStore.getState().goToStep(5);
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(5);

      act(() => {
        useWalkthroughStore.getState().prevStep();
      });

      expect(useWalkthroughStore.getState().currentStep).toBe(4);

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      expect(useWalkthroughStore.getState().currentWalkthrough).toBeNull();
      expect(useWalkthroughStore.getState().currentStep).toBe(0);
    });

    it("should handle restart after completion", () => {
      act(() => {
        useWalkthroughStore.setState({
          walkthroughs: {
            analyst_walkthrough: "2024-01-01T00:00:00.000Z",
          },
        });
      });

      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "dashboard-new");
      });

      const state = useWalkthroughStore.getState();
      expect(state.currentWalkthrough).toBe("analyst_walkthrough");
      expect(state.currentStep).toBe(0);
      expect(state.walkthroughs.analyst_walkthrough).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle ending walkthrough multiple times", () => {
      act(() => {
        useWalkthroughStore.setState({
          currentWalkthrough: "analyst_walkthrough",
          currentStep: 0,
        });
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      act(() => {
        useWalkthroughStore.getState().endWalkthrough();
      });

      const state = useWalkthroughStore.getState();
      expect(state.currentWalkthrough).toBeNull();
    });

    it("should preserve workingDashboardUUID during steps", () => {
      act(() => {
        useWalkthroughStore
          .getState()
          .restartWalkthrough("analyst_walkthrough", "my-dashboard");
      });

      act(() => {
        useWalkthroughStore.getState().nextStep();
        useWalkthroughStore.getState().nextStep();
      });

      expect(useWalkthroughStore.getState().workingDashboardUUID).toBe("my-dashboard");
    });
  });
});
