import { getConfig } from "./runtimeConfig";

export type IdentityProvidersAvailable = "google" | "microsoft" | "okta";

export function getEnabledIdentityProviders(): IdentityProvidersAvailable[] {
  const providers = new Set(getConfig().authentication.identityProviders);
  return Array.from(providers).filter(
    (p): p is IdentityProvidersAvailable =>
      p === "google" || p === "microsoft" || p === "okta",
  );
}

export function getAllowedDataVendors(): string[] {
  return getConfig().data.allowedDataVendors;
}

export function getAllowedDBTypes(): string[] {
  return getConfig().data.allowedDbTypes;
}

export function getShowDemoRequestButton(): boolean {
  const cfg = getConfig();
  return cfg.ui.showDemoRequestButton && cfg.services.hubspotForms;
}

export function isOnPremDeployment(): boolean {
  // Before runtime config is bootstrapped (e.g. isolated unit renders) treat the
  // deployment as on-prem so hosted-only features stay off rather than crashing.
  const paymentsUrl = getConfig()?.urls?.backend || "";
  const isOpenBBHosted =
    paymentsUrl === "https://backend.openbb.co" ||
    paymentsUrl === "https://backend.openbb.dev" ||
    paymentsUrl === "https://payments.openbb.dev" ||
    paymentsUrl === "https://payments.openbb.co";
  return !isOpenBBHosted;
}

export function isLiteEnvironment(): boolean {
  return getConfig().ui.isLite;
}
