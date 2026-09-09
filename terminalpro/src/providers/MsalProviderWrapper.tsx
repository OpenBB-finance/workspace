import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { type ReactNode, useMemo } from "react";
import { getMsalConfig } from "~/lib/microsoft-auth-config";

export default function MsalProviderWrapper({ children }: { children: ReactNode }) {
  const msalInstance = useMemo(() => new PublicClientApplication(getMsalConfig()), []);
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
