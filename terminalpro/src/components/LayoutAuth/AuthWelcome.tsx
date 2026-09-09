import { Fragment, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import TrialExpiredWarning from "./TrialExpiredWarning";
import WelcomeMessage from "./WelcomeMessage";

export default function AuthWelcome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { needsOnboarding, tosAccepted, isAuthenticated } = useShallowAuthStore(
    (state) => ({
      needsOnboarding: state.needsOnboarding,
      tosAccepted: state.tosAccepted,
      isAuthenticated: state.user !== null,
    }),
  );

  const [state, dispatch] = useStateReducer({
    showWarning: false,
    showWelcome: false,
    tosConditionsMet: false,
    tier: "",
  });
  const featureFlags = useShallowFeatureFlagsStore((state) => state.featureFlags);
  const uiShowTOSFF = getConfig().ui.showTos;

  const redirectedToOnboardingRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && needsOnboarding) {
      if (redirectedToOnboardingRef.current) return;
      redirectedToOnboardingRef.current = true;
      dispatch({ showWarning: true });
      toast.warning("Onboarding", {
        id: "onboarding",
        description: "Please complete the onboarding process to continue.",
      });
      navigate("/onboarding");
    } else if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, needsOnboarding, navigate]);

  // Consume the one-shot params the login / onboarding redirects add to the URL.
  // This must never depend on `state`: dispatching here would re-run the effect and
  // re-issue the navigation. It must also replace rather than push, so a landing on
  // /app/<id>?welcome=<entity> cannot grow the history stack.
  useEffect(() => {
    const movedToDeveloper = searchParams.get("moved_to_developer") === "true";
    const welcome = searchParams.get("welcome");
    if (!(movedToDeveloper || welcome !== null)) return;

    const updateState = {} as typeof state;
    if (movedToDeveloper) updateState.showWarning = true;
    if (welcome !== null) {
      updateState.showWelcome = true;
      updateState.tier = welcome;
    }
    dispatch(updateState);

    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete("moved_to_developer");
        newParams.delete("welcome");
        return newParams;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const tosConditionsMet = uiShowTOSFF && tosAccepted && featureFlags?.tier === "pro";
    dispatch({ tosConditionsMet });
  }, [uiShowTOSFF, tosAccepted, featureFlags?.tier]);

  return useMemo(
    () => (
      <Fragment key="auth-welcome-fragment">
        <TrialExpiredWarning
          open={state.showWarning}
          onClose={() => dispatch({ showWarning: false })}
        />
        {state.tosConditionsMet && (
          <WelcomeMessage
            open={state.showWelcome}
            tier={state.tier}
            onClose={() => dispatch({ showWelcome: false })}
          />
        )}
      </Fragment>
    ),
    [state],
  );
}
