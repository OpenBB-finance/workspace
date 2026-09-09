import posthog from "posthog-js";
import React from "react";
import { createRoot } from "react-dom/client";
import { updateRibbon } from "~/commands/common.commands";
import {
  VERSION,
  VITE_ENV,
  VITE_POSTHOG_API_HOST,
  VITE_POSTHOG_API_KEY,
} from "~/constants";
import App from "./App";
import "./index.css";

/* global document, Office */

let isOfficeInitialized = false;

const render = (Component: typeof App) => {
  createRoot(document.getElementById("container") as HTMLElement).render(
    <React.StrictMode>
      {isOfficeInitialized ? <Component /> : <p>Loading...</p>}
      {/* <Component /> */}
    </React.StrictMode>,
  );
};

/* Render application after Office initializes */
Office.onReady(async () => {
  isOfficeInitialized = true;

  /* Initialize PostHog */
  posthog.init(VITE_POSTHOG_API_KEY, {
    api_host: VITE_POSTHOG_API_HOST,
  });

  /* Register global properties */
  posthog.register({
    addin_version: VERSION,
    office_context: {
      contentLanguage: Office.context.contentLanguage,
      displayLanguage: Office.context.displayLanguage,
      host: Office.context.host,
      platform: Office.context.platform,
      diagnostics: Office.context.diagnostics,
      requirements: Office.context.requirements,
    },
  });

  const shouldDisableAnalytics =
    VITE_ENV === "ONPREM" ||
    VITE_ENV === "DEVELOPMENT" ||
    !VITE_POSTHOG_API_KEY ||
    !VITE_POSTHOG_API_HOST;

  if (shouldDisableAnalytics) {
    posthog.opt_out_capturing();
  }

  render(App);
  updateRibbon();
});
