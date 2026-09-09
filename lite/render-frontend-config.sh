#!/bin/bash
# Renders /usr/share/nginx/html/config.js from environment variables.
#
# The SPA reads window.__APP_CONFIG__ from /config.js BEFORE the bundle loads
# (see terminalpro/public/config.js for the schema).
#
# Exposure model:
#   - OVERRIDABLE: declared with a `:=` default below and interpolated into the
#     heredoc as ${VAR}. An operator can change these with `docker run -e`.
#     Mirrors the "_unlocked" list in the Lite lock profile
#     (terminalpro/config-profiles/lite.locked.json).
#   - LOCKED: every other config field. Baked into the JS bundle at build time
#     by the strict Lite profile and forcibly overriding config.js at runtime,
#     so they can't be flipped even by editing this file or the generated
#     config.js. Locked fields are NOT emitted into config.js at all; fully
#     locked groups are emitted empty (e.g. whiteLabel: {}) so the object
#     still satisfies the app's Zod schema.
#
# config.js and the JS bundle are client-side. Anything that must be *truly*
# enforced is bundle-locked (see the profile) or lives in the backend — never
# a plain literal here.
set -euo pipefail

: "${CONFIG_OUT:=/usr/share/nginx/html/config.js}"

# --- Overridable at runtime (-e) --------------------------------------------
# URLs stay overridable: relative/proxied URLs are an operational necessity for
# self-hosting, even though the catalog annotates most as internal.
: "${BACKEND_URL:=/api}"
: "${AI_API_URL:=}"
: "${PLATFORM_URL:=}"
: "${DATABASE_API_URL:=}"

: "${AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER:=false}"

: "${AI_COPILOT_ENABLED:=true}"
: "${AI_COPILOT_OPENBB_COPILOT:=false}"
: "${AI_COPILOT_AI_ENHANCEMENTS:=true}"

: "${UI_SHOW_COMPANION_MCP_MODE:=true}"
: "${UI_SHOW_MINIMIZE_WIDGET:=true}"
: "${UI_SHOW_CHART_GENERATION:=true}"
: "${UI_SHOW_CHANGELOG:=true}"
: "${UI_SHOW_COPILOT_SWITCHER:=true}"
: "${UI_SHOW_MARKETPLACE:=true}"

: "${MCP_DEFAULT_SERVER_ENABLED:=true}"
: "${DATA_ALLOW_HTML_JS_EXECUTION:=true}"

# --- Locked-value notice (DEBUG only) ----------------------------------------
# Any frontend-config-shaped env var that is not one of the `:=` overridables
# above is bundle-locked in Lite and will be ignored. The overridable set is
# parsed from this file's own `:=` declarations, so there is no second list to
# keep in sync with the lock profile. Recognition is by knob-family prefix;
# MCP_/DATA_ are matched narrowly because the backend owns other vars under
# those prefixes (e.g. MCP_HOSTNAMES, DATA_DIR). Silent for end users (keeps
# locked knobs undiscoverable via logs); surfaced when DEBUG is set so
# operators debugging a config can see that their -e flag is being ignored.
if [[ "${DEBUG:-}" == "1" || "${DEBUG:-}" == "true" ]]; then
  _overridable=" $(sed -n 's/^: "\${\([A-Z0-9_]*\):=.*/\1/p' "${BASH_SOURCE[0]}" | tr '\n' ' ') "
  for _v in $(compgen -e); do
    case "$_v" in
      AUTHENTICATION_* | AI_COPILOT_* | UI_* | SERVICES_* | WL_* | ANALYTICS_* | \
        DATA_PACKAGE_* | DATA_ALLOWED_* | DATA_ALLOW_* | DATA_ODP_* | MCP_DEFAULT_*)
        if [[ "$_overridable" != *" $_v "* ]]; then
          echo "[render-frontend-config] NOTE: $_v is locked in Lite; ignoring the provided value." >&2
        fi
        ;;
    esac
  done
fi

# Only OVERRIDABLE knobs are emitted below — every locked field is intentionally
# absent, baked into the bundle by the Lite profile and applied at runtime
# regardless of what's here.
cat > "$CONFIG_OUT" <<EOF
window.__APP_CONFIG__ = {
  urls: {
    backend: "${BACKEND_URL}",
    ai: "${AI_API_URL}",
    platform: "${PLATFORM_URL}",
    database: "${DATABASE_API_URL}"
  },
  authentication: {
    sendUserEmailAsHeader: ${AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER}
  },
  authProviders: {},
  copilot: {
    enabled: ${AI_COPILOT_ENABLED},
    openbbCopilot: ${AI_COPILOT_OPENBB_COPILOT},
    aiEnhancements: ${AI_COPILOT_AI_ENHANCEMENTS}
  },
  ui: {
    showCompanionMode: ${UI_SHOW_COMPANION_MCP_MODE},
    showMinimizeWidget: ${UI_SHOW_MINIMIZE_WIDGET},
    showChartGeneration: ${UI_SHOW_CHART_GENERATION},
    showChangelog: ${UI_SHOW_CHANGELOG},
    showCopilotSwitcher: ${UI_SHOW_COPILOT_SWITCHER},
    showMarketplace: ${UI_SHOW_MARKETPLACE}
  },
  services: {},
  data: {
    allowHtmlJsExecution: ${DATA_ALLOW_HTML_JS_EXECUTION}
  },
  mcp: {
    defaultServerEnabled: ${MCP_DEFAULT_SERVER_ENABLED}
  },
  analytics: {},
  whiteLabel: {}
};
EOF
