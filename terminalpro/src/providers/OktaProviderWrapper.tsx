import { Security } from "@okta/okta-react";
import type { ReactNode } from "react";
import { getOktaAuth } from "~/lib/okta-auth-config";

export default function OktaProviderWrapper({ children }: { children: ReactNode }) {
  const oktaAuth = getOktaAuth();
  if (!oktaAuth) return <>{children}</>;
  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={() => {}}>
      {children}
    </Security>
  );
}
