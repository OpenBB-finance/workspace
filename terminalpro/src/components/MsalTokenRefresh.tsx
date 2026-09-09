import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useAuthStore, useShallowAuthStore } from "~/lib/state/auth";

export default function MsalTokenRefresh({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const authStore = useShallowAuthStore((s) => ({
    user: s.user,
    microsoftIdToken: s.microsoftIdToken,
    logout: s.logout,
  }));
  const [refreshTick, setRefreshTick] = useState(0);

  const checkTokenExpiration = useCallback(async () => {
    const { user, microsoftIdToken, logout } = authStore;
    // Prefer the account selected at sign-in; fall back to matching the
    // backend email for sessions that predate setActiveAccount being set
    const currentAccount =
      instance.getActiveAccount() ??
      accounts.find((acc) => acc.username.toLowerCase() === user.email.toLowerCase());
    if (!currentAccount) return microsoftIdToken ? logout() : null;

    const tokenRequest = {
      account: currentAccount,
      scopes: ["User.Read"],
      forceRefresh: true, // Forces to refresh token
      refreshTokenExpirationOffsetSeconds: 7200, // 2 hours
    };

    try {
      const res = await instance.acquireTokenSilent(tokenRequest);
      // Keeps the active-account pointer fresh, and adopts accounts matched
      // via the email fallback so legacy sessions self-heal
      instance.setActiveAccount(res.account);
      useAuthStore.setState({ microsoftIdToken: res?.idToken });
      // @ts-expect-error
      const expiresIn = res.idTokenClaims.exp * 1000 - Date.now();

      // Set a timeout to refresh the token 10% before it expires
      setTimeout(() => setRefreshTick((prev) => prev + 1), expiresIn * 0.9);
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        console.log("Token expired or interaction required. Logging out.");
        logout();
      } else {
        console.error("Error acquiring token silently:", e);
      }
    }
  }, [accounts, instance, authStore]);

  useEffect(() => {
    if (inProgress !== "none") return; // Wait until MSAL is done initializing
    checkTokenExpiration();
  }, [accounts, instance, refreshTick, inProgress]);

  return <>{children}</>;
}
