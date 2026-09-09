/*
 * Okta authentication configuration for OpenBB Terminal Pro.
 * Based on Okta Auth JS SDK: https://github.com/okta/okta-auth-js
 */

import { OktaAuth, type OktaAuthOptions } from "@okta/okta-auth-js";
import { getConfig } from "./runtimeConfig";

let _oktaAuth: OktaAuth | null = null;
let _initialized = false;

export function getOktaAuth(): OktaAuth | null {
  if (!_initialized) {
    _initialized = true;
    const cfg = getConfig();
    const clientId = cfg.authProviders.oktaClientId ?? "";
    const oktaDomain = cfg.authProviders.oktaDomain ?? "";

    if (oktaDomain) {
      const oktaAuthConfig: OktaAuthOptions = {
        clientId,
        issuer: `${oktaDomain}`,
        redirectUri: window.location.origin,
        scopes: ["openid", "profile", "email"],
        pkce: true,
        tokenManager: {
          storage: "sessionStorage",
        },
      };
      _oktaAuth = new OktaAuth(oktaAuthConfig);
    }
  }
  return _oktaAuth;
}

/**
 * Configuration for popup-based authentication.
 */
export const oktaLoginRequest = {
  scopes: ["openid", "profile", "email"],
  prompt: "select_account",
};
