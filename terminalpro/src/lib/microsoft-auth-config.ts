/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { type Configuration, LogLevel, type PopupRequest } from "@azure/msal-browser";
import { getConfig } from "./runtimeConfig";

let _msalConfig: Configuration | null = null;

export function getMsalConfig(): Configuration {
  if (!_msalConfig) {
    const cfg = getConfig();
    _msalConfig = {
      auth: {
        clientId: cfg.authProviders.azureClientId ?? "",
        authority: `https://login.microsoftonline.com/${cfg.authProviders.azureTenantId ?? ""}`,
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
            if (containsPii) {
              return;
            }
            switch (level) {
              case LogLevel.Error: {
                console.error(message);
                return;
              }
              case LogLevel.Info: {
                console.info(message);
                return;
              }
              case LogLevel.Verbose: {
                console.debug(message);
                return;
              }
              case LogLevel.Warning: {
                console.warn(message);
                return;
              }
            }
          },
          logLevel: LogLevel.Info,
        },
      },
    };
  }
  return _msalConfig;
}

/**
 * Scopes that are requested during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 */
export const loginRequest: PopupRequest = {
  scopes: ["User.Read"],
  prompt: "select_account",
};

/**
 * Configuration for Microsoft Graph API endpoints.
 */
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me" as const,
} as const;

/**
 * Add additional scopes here for Microsoft Graph API access.
 */
export const graphScopes = ["User.Read"] as const;
