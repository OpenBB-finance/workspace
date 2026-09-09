#!/bin/bash
# Renders /usr/share/nginx/html/config.js from environment variables.
#
# Full variant: expose every frontend runtime knob this renderer can support.
set -euo pipefail

: "${CONFIG_OUT:=/usr/share/nginx/html/config.js}"

csv_json_array() {
  local value="$1"
  if [[ -z "$value" ]]; then
    printf '[]'
    return
  fi

  local IFS=','
  local first=1
  local item
  printf '['
  for item in $value; do
    item="${item#"${item%%[![:space:]]*}"}"
    item="${item%"${item##*[![:space:]]}"}"
    [[ -z "$item" ]] && continue
    if [[ "$first" -eq 0 ]]; then
      printf ', '
    fi
    printf '"%s"' "$item"
    first=0
  done
  printf ']'
}

: "${BACKEND_URL:=/api}"
: "${AI_API_URL:=}"
: "${PLATFORM_URL:=}"
: "${DATABASE_API_URL:=}"

: "${AUTHENTICATION_ALLOW_EMAIL_LOGIN:=true}"
: "${AUTHENTICATION_ALLOW_REGISTRATION:=false}"
: "${AUTHENTICATION_ALLOW_FORGOT_PASSWORD:=false}"
: "${AUTHENTICATION_IDENTITY_PROVIDERS:=}"
: "${AUTHENTICATION_SEND_MICROSOFT_IDTOKEN:=false}"
: "${AUTHENTICATION_SEND_OKTA_IDTOKEN:=false}"
: "${AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER:=false}"

: "${GOOGLE_OAUTH_CLIENT_ID:=}"
: "${AZURE_CLIENT_ID:=}"
: "${AZURE_TENANT_ID:=}"
: "${OKTA_CLIENT_ID:=}"
: "${OKTA_DOMAIN:=}"

: "${AI_COPILOT_ENABLED:=true}"
: "${AI_COPILOT_OPENBB_COPILOT:=false}"
: "${AI_COPILOT_DOCUMENTATION_LINKS:=true}"
: "${AI_COPILOT_WEB_SEARCH:=true}"
: "${AI_COPILOT_SEC_FILINGS:=true}"
: "${AI_COPILOT_JINA_AI:=true}"
: "${AI_COPILOT_AI_ENHANCEMENTS:=true}"
: "${AI_COPILOT_SHOW_CUSTOM_KEY:=true}"

: "${UI_SHOW_COMPANION_MCP_MODE:=true}"
: "${UI_SHOW_MINIMIZE_WIDGET:=true}"
: "${UI_SHOW_CHART_GENERATION:=true}"
: "${UI_SHOW_FEEDBACK_BUTTON:=false}"
: "${UI_SHOW_INVITE_BUTTON:=false}"
: "${UI_SHOW_DEMO_REQUEST_BUTTON:=false}"
: "${UI_SHOW_ENTERPRISE_TAGS:=false}"
: "${UI_SHOW_EXTERNAL_DOCUMENTATION_LINKS:=true}"
: "${UI_SHOW_HELP_DOCUMENTATION:=true}"
: "${UI_SHOW_CHANGELOG:=true}"
: "${UI_SHOW_ONBOARDING_QUESTIONS:=false}"
: "${UI_SHOW_TOS:=false}"
: "${UI_SHOW_COPILOT_SWITCHER:=true}"
: "${UI_SHOW_REMOVE_FROM_ORG:=true}"
: "${UI_DEFAULT_THEME:=dark}"
: "${UI_ODP_DOWNLOAD_INSTALLER:=false}"
: "${UI_SHOW_SALES_EMAIL:=false}"
: "${UI_SHOW_MARKETPLACE:=true}"
: "${UI_IS_LITE:=false}"

: "${SERVICES_POSTHOG:=false}"
: "${SERVICES_HUBSPOT_FORMS:=false}"
: "${SERVICES_EMAIL:=false}"
: "${SERVICES_NIXTLA:=false}"
: "${SERVICES_CLOUDFLARE_WORKER:=false}"

: "${DATA_PACKAGE_DATA_ENABLED:=true}"
: "${DATA_ALLOWED_DATA_VENDORS:=}"
: "${DATA_ALLOWED_DB_TYPES:=database,snowflake,databricks,clickhouse}"
: "${DATA_ODP_INSTALLER_ENABLED:=false}"
: "${DATA_ALLOW_HTML_JS_EXECUTION:=true}"

: "${MCP_DEFAULT_SERVER_ENABLED:=true}"

: "${POSTHOG_KEY:=}"
: "${POSTHOG_URL:=}"

: "${WL_NAME:=OpenBB}"
: "${WL_SHORT_NAME:=OpenBB}"
: "${WL_LOGIN_IMAGE:=/assets/images/openbb_lettering.svg}"
: "${WL_LOGIN_IMAGE_DARK:=/assets/images/openbb_lettering_light.svg}"
: "${WL_LEFT_SIDEBAR_LOGO:=}"
: "${WL_LEFT_SIDEBAR_LOGO_DARK:=}"
: "${WL_FAVICON:=/favicon/favicon.ico}"
: "${WL_DESCRIPTION:=OpenBB workspace.}"
: "${WL_KEYWORDS:=OpenBB, finance, workspace}"
: "${WL_MAIN_COLOR:=#0088CC}"
: "${WL_FONT_FAMILY:=Inter}"
: "${WL_SHOW_FLOATING_THEME_PREVIEW:=false}"

IDP_JSON="$(csv_json_array "$AUTHENTICATION_IDENTITY_PROVIDERS")"
DATA_VENDOR_JSON="$(csv_json_array "$DATA_ALLOWED_DATA_VENDORS")"
DB_TYPE_JSON="$(csv_json_array "$DATA_ALLOWED_DB_TYPES")"

cat > "$CONFIG_OUT" <<EOF
window.__APP_CONFIG__ = {
  urls: {
    backend: "${BACKEND_URL}",
    ai: "${AI_API_URL}",
    platform: "${PLATFORM_URL}",
    database: "${DATABASE_API_URL}"
  },
  authentication: {
    allowEmailLogin: ${AUTHENTICATION_ALLOW_EMAIL_LOGIN},
    allowRegistration: ${AUTHENTICATION_ALLOW_REGISTRATION},
    allowForgotPassword: ${AUTHENTICATION_ALLOW_FORGOT_PASSWORD},
    identityProviders: ${IDP_JSON},
    sendMicrosoftIdToken: ${AUTHENTICATION_SEND_MICROSOFT_IDTOKEN},
    sendOktaIdToken: ${AUTHENTICATION_SEND_OKTA_IDTOKEN},
    sendUserEmailAsHeader: ${AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER}
  },
  authProviders: {
    googleClientId: "${GOOGLE_OAUTH_CLIENT_ID}",
    azureClientId: "${AZURE_CLIENT_ID}",
    azureTenantId: "${AZURE_TENANT_ID}",
    oktaClientId: "${OKTA_CLIENT_ID}",
    oktaDomain: "${OKTA_DOMAIN}"
  },
  copilot: {
    enabled: ${AI_COPILOT_ENABLED},
    openbbCopilot: ${AI_COPILOT_OPENBB_COPILOT},
    documentationLinks: ${AI_COPILOT_DOCUMENTATION_LINKS},
    webSearch: ${AI_COPILOT_WEB_SEARCH},
    secFilings: ${AI_COPILOT_SEC_FILINGS},
    jinaAi: ${AI_COPILOT_JINA_AI},
    aiEnhancements: ${AI_COPILOT_AI_ENHANCEMENTS},
    showCustomKey: ${AI_COPILOT_SHOW_CUSTOM_KEY}
  },
  ui: {
    showCompanionMode: ${UI_SHOW_COMPANION_MCP_MODE},
    showMinimizeWidget: ${UI_SHOW_MINIMIZE_WIDGET},
    showChartGeneration: ${UI_SHOW_CHART_GENERATION},
    showFeedbackButton: ${UI_SHOW_FEEDBACK_BUTTON},
    showInviteButton: ${UI_SHOW_INVITE_BUTTON},
    showDemoRequestButton: ${UI_SHOW_DEMO_REQUEST_BUTTON},
    showEnterpriseTags: ${UI_SHOW_ENTERPRISE_TAGS},
    showExternalDocLinks: ${UI_SHOW_EXTERNAL_DOCUMENTATION_LINKS},
    showHelpDocumentation: ${UI_SHOW_HELP_DOCUMENTATION},
    showChangelog: ${UI_SHOW_CHANGELOG},
    showOnboardingQuestions: ${UI_SHOW_ONBOARDING_QUESTIONS},
    showTos: ${UI_SHOW_TOS},
    showCopilotSwitcher: ${UI_SHOW_COPILOT_SWITCHER},
    showRemoveFromOrg: ${UI_SHOW_REMOVE_FROM_ORG},
    defaultTheme: "${UI_DEFAULT_THEME}",
    odpDownloadInstaller: ${UI_ODP_DOWNLOAD_INSTALLER},
    showSalesEmail: ${UI_SHOW_SALES_EMAIL},
    showMarketplace: ${UI_SHOW_MARKETPLACE},
    isLite: ${UI_IS_LITE}
  },
  services: {
    posthog: ${SERVICES_POSTHOG},
    hubspotForms: ${SERVICES_HUBSPOT_FORMS},
    email: ${SERVICES_EMAIL},
    nixtla: ${SERVICES_NIXTLA},
    cloudflareWorker: ${SERVICES_CLOUDFLARE_WORKER}
  },
  data: {
    packageDataEnabled: ${DATA_PACKAGE_DATA_ENABLED},
    allowedDataVendors: ${DATA_VENDOR_JSON},
    allowedDbTypes: ${DB_TYPE_JSON},
    openDataPlatformInstallerEnabled: ${DATA_ODP_INSTALLER_ENABLED},
    allowHtmlJsExecution: ${DATA_ALLOW_HTML_JS_EXECUTION}
  },
  mcp: {
    defaultServerEnabled: ${MCP_DEFAULT_SERVER_ENABLED}
  },
  analytics: {
    posthogKey: "${POSTHOG_KEY}",
    posthogUrl: "${POSTHOG_URL}"
  },
  whiteLabel: {
    name: "${WL_NAME}",
    shortName: "${WL_SHORT_NAME}",
    loginImage: "${WL_LOGIN_IMAGE}",
    loginImageDark: "${WL_LOGIN_IMAGE_DARK}",
    leftSidebarLogo: "${WL_LEFT_SIDEBAR_LOGO}",
    leftSidebarLogoDark: "${WL_LEFT_SIDEBAR_LOGO_DARK}",
    favicon: "${WL_FAVICON}",
    description: "${WL_DESCRIPTION}",
    keywords: "${WL_KEYWORDS}",
    mainColor: "${WL_MAIN_COLOR}",
    fontFamily: "${WL_FONT_FAMILY}",
    showFloatingThemePreview: ${WL_SHOW_FLOATING_THEME_PREVIEW}
  }
};
EOF
