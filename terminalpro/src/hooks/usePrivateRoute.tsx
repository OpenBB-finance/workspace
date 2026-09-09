import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { validateUser } from "~/api/auth.api";
import { useShallowAuthStore } from "~/lib/state/auth";

export function usePrivateRoute(shouldValidate = true) {
  const navigate = useNavigate();
  const { user, logout, needsOnboarding } = useShallowAuthStore((state) => ({
    user: state.user,
    logout: state.logout,
    needsOnboarding: state.needsOnboarding,
  }));

  useEffect(() => {
    if (!user) {
      console.info("🚫 User is not logged in, redirecting to auth page");
      logout();
      return;
    }

    if (shouldValidate) {
      console.info("🔐 User is logged in, checking token validity");
      validateUser()
        .then((data) => {
          if (!data.success) {
            console.info("🚫 Token is invalid, redirecting to auth page");
            if (needsOnboarding) {
              navigate("/onboarding");
            } else {
              logout();
            }
          }
        })
        .catch((err) => {
          console.error("🚫 Token validation failed, redirecting to auth page", err);
          logout();
        });
    }
  }, [user, shouldValidate, logout, needsOnboarding, navigate]);
}
