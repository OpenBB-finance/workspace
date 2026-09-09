import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";
import { getConfig } from "~/lib/runtimeConfig";

export default function GoogleProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={getConfig().authProviders.googleClientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
