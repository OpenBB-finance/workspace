import { describe, expect, it, vi } from "vitest";
import { useTutorialStore } from "~/lib/state/tutorial";
import { changeStep } from "~/lib/utils/tutorial";

vi.mock("~/lib/state/tutorial", () => ({
  useTutorialStore: {
    getState: vi.fn(),
  },
}));

describe("tutorial utils", () => {
  it("should increment step if conditions are met", () => {
    const nextStep = vi.fn();
    const extraFn = vi.fn();
    vi.mocked(useTutorialStore.getState).mockReturnValue({
      currentTutorial: "test-tutorial",
      currentStep: 1,
      nextStep,
    } as any);

    changeStep("test-tutorial", 1, extraFn);

    expect(nextStep).toHaveBeenCalled();
    expect(extraFn).toHaveBeenCalled();
  });

  it("should not increment if tutorial does not match", () => {
    const nextStep = vi.fn();
    vi.mocked(useTutorialStore.getState).mockReturnValue({
      currentTutorial: "other-tutorial",
      currentStep: 1,
      nextStep,
    } as any);

    changeStep("test-tutorial", 1);

    expect(nextStep).not.toHaveBeenCalled();
  });

  it("should not increment if step does not match", () => {
    const nextStep = vi.fn();
    vi.mocked(useTutorialStore.getState).mockReturnValue({
      currentTutorial: "test-tutorial",
      currentStep: 2,
      nextStep,
    } as any);

    changeStep("test-tutorial", 1);

    expect(nextStep).not.toHaveBeenCalled();
  });
});
