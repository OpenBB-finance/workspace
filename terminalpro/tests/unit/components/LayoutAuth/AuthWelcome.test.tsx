import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthWelcome from "~/components/LayoutAuth/AuthWelcome";

const authState = {
  needsOnboarding: false,
  tosAccepted: false,
  user: { uuid: "user-1" } as { uuid: string } | null,
};

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (cb: (state: typeof authState) => unknown) => cb(authState),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: (cb: (state: { featureFlags: unknown }) => unknown) =>
    cb({ featureFlags: { tier: "pro" } }),
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({ ui: { showTos: false } }),
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/components/LayoutAuth/TrialExpiredWarning", () => ({
  default: () => null,
}));

vi.mock("~/components/LayoutAuth/WelcomeMessage", () => ({
  default: () => null,
}));

function renderAt(initialEntry: string) {
  const router = createMemoryRouter([{ path: "/app/:id", element: <AuthWelcome /> }], {
    initialEntries: [initialEntry],
  });
  const navigateSpy = vi.spyOn(router, "navigate");
  render(<RouterProvider router={router} />);
  return { router, navigateSpy };
}

describe("AuthWelcome", () => {
  beforeEach(() => {
    authState.needsOnboarding = false;
    authState.user = { uuid: "user-1" };
  });

  // Regression guard for the new-account navigation loop: landing on
  // /app/<id>?welcome=<entity> stripped the param with a *pushed* navigation on an
  // effect that also dispatched local state, so the effect re-ran and pushed again
  // until Chrome throttled navigation and every in-app link went dead.
  it("strips ?welcome with a single navigation", async () => {
    const { router, navigateSpy } = renderAt("/app/dash-1?welcome=openbb");

    await waitFor(() => expect(router.state.location.search).toBe(""));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it("strips ?moved_to_developer with a single navigation", async () => {
    const { router, navigateSpy } = renderAt("/app/dash-1?moved_to_developer=true");

    await waitFor(() => expect(router.state.location.search).toBe(""));

    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it("does not add a history entry when cleaning up the params", async () => {
    const { router } = renderAt("/app/dash-1?welcome=openbb");

    await waitFor(() => expect(router.state.location.search).toBe(""));

    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("leaves the URL alone when there are no welcome params", async () => {
    const { router, navigateSpy } = renderAt("/app/dash-1?tab=overview");

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/dash-1"));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe("?tab=overview");
  });
});
