import { HttpResponse, http, passthrough } from "msw";

// Default mock data
export const mockUser = {
  uuid: "test-user-uuid",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  token: "mock-jwt-token",
  is_superuser: false,
  accepted_pro_tos: true,
  is_trial_entity: false,
};

export const mockValidateResponse = {
  uuid: "test-user-uuid",
  email: "test@example.com",
  valid: true,
};

export const mockDashboardData = {
  owned: {
    "dashboard-1": {
      content: {
        name: "Test Dashboard",
        tabs: [],
        widgets: {},
      },
      updated_at: new Date().toISOString(),
    },
  },
  shared: {},
  entity_shared: {},
};

export const mockUsage = {
  copilot_messages: { used: 10, limit: 100 },
  file_uploads: { used: 5, limit: 50 },
  widgets: { used: 20, limit: 200 },
};

export const mockFeatureFlags = {
  tier: "pro",
  features: {
    copilot: true,
    file_uploads: true,
    custom_widgets: true,
  },
};

// Base URL for API - matches VITE_PAYMENTS_URL in tests
const BASE_URL = "https://backend.openbb.dev";

export const handlers = [
  // ============ Auth Endpoints ============

  // Login
  http.post(`${BASE_URL}/pro/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === "invalid@example.com") {
      return HttpResponse.json(
        { detail: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (body.email === "2fa@example.com") {
      return HttpResponse.json(
        { requires_2fa: true, status: 200 },
        { status: 200 },
      );
    }

    return HttpResponse.json({
      ...mockUser,
      status: 200,
    });
  }),

  // Validate user
  http.get(`${BASE_URL}/pro/validate`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || authHeader === "Bearer invalid-token") {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    return HttpResponse.json(mockValidateResponse);
  }),

  // Logout
  http.post(`${BASE_URL}/pro/logout`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Get user
  http.get(`${BASE_URL}/pro/user`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    return HttpResponse.json(mockUser);
  }),

  // Google auth
  http.post(`${BASE_URL}/pro/google-auth`, async ({ request }) => {
    const body = (await request.json()) as { token: string };

    if (body.token === "invalid-google-token") {
      return HttpResponse.json(
        { detail: "Invalid Google token" },
        { status: 401 },
      );
    }

    return HttpResponse.json({ ...mockUser, status: 200 });
  }),

  // Microsoft auth
  http.post(`${BASE_URL}/pro/microsoft-auth`, async ({ request }) => {
    const body = (await request.json()) as { token: string };

    if (body.token === "invalid-microsoft-token") {
      return HttpResponse.json(
        { detail: "Invalid Microsoft token" },
        { status: 401 },
      );
    }

    return HttpResponse.json({ ...mockUser, status: 200 });
  }),

  // Register
  http.post(`${BASE_URL}/pro/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string };

    if (body.email === "existing@example.com") {
      return HttpResponse.json(
        { detail: "Email already registered" },
        { status: 400 },
      );
    }

    return HttpResponse.json({ status: 200 });
  }),

  // Forgot password
  http.post(`${BASE_URL}/forgot-password`, async ({ request }) => {
    const body = (await request.json()) as { email: string };

    if (body.email === "notfound@example.com") {
      return HttpResponse.json({ detail: "Email not found" }, { status: 404 });
    }

    return HttpResponse.json({ status: 200 });
  }),

  // Accept terms
  http.post(`${BASE_URL}/pro/accepted-pro-tos`, () => {
    return HttpResponse.json({ success: true });
  }),

  // 2FA endpoints
  http.post(`${BASE_URL}/totp`, () => {
    return HttpResponse.json({
      uri: "otpauth://totp/OpenBB:test@example.com?secret=TESTSECRET",
      secret: "TESTSECRET",
    });
  }),

  http.post(`${BASE_URL}/totp/activate`, async ({ request }) => {
    const body = (await request.json()) as { totp_token: number };

    if (body.totp_token === 999999) {
      return HttpResponse.json({ detail: "Invalid code" }, { status: 400 });
    }

    return HttpResponse.json({ status: 200 });
  }),

  http.get(`${BASE_URL}/pro/2fa`, () => {
    return HttpResponse.json({
      two_factor_auth: false,
      entity_require_authenticator: false,
    });
  }),

  http.put(`${BASE_URL}/pro/2fa`, () => {
    return HttpResponse.json({ success: true });
  }),

  // ============ Dashboard Endpoints ============

  // Get dashboards
  http.get(`${BASE_URL}/pro/dash/sync`, () => {
    return HttpResponse.json(mockDashboardData);
  }),

  // Get owned dashboards
  http.get(`${BASE_URL}/pro/dash/sync/owned`, () => {
    return HttpResponse.json({ owned: mockDashboardData.owned });
  }),

  // Get shared dashboards
  http.get(`${BASE_URL}/pro/dash/sync/shared`, () => {
    return HttpResponse.json({
      shared: mockDashboardData.shared,
      entity_shared: mockDashboardData.entity_shared,
    });
  }),

  // Post dashboards (sync)
  http.post(`${BASE_URL}/pro/dash/sync`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true, items: body });
  }),

  // Share dashboard
  http.post(`${BASE_URL}/pro/dash/:dashboardUuid/share`, async ({ params }) => {
    const { dashboardUuid } = params;

    if (dashboardUuid === "non-existent") {
      return HttpResponse.json(
        { detail: "Dashboard not found" },
        { status: 404 },
      );
    }

    return HttpResponse.json({ success: true });
  }),

  // Get dashboard shares
  http.get(`${BASE_URL}/pro/dash/:dashboardUuid/shares`, ({ params }) => {
    const { dashboardUuid } = params;

    if (dashboardUuid === "non-existent") {
      return HttpResponse.json(
        { detail: "Dashboard not found" },
        { status: 404 },
      );
    }

    return HttpResponse.json({ shares: {} });
  }),

  // Delete dashboard share
  http.delete(`${BASE_URL}/pro/dash/:dashboardUuid/share`, () => {
    return HttpResponse.json({ success: true });
  }),

  // ============ Usage & Tier Endpoints ============

  // Get usage
  http.get(`${BASE_URL}/pro/usage`, () => {
    return HttpResponse.json(mockUsage);
  }),

  // Put tier
  http.put(`${BASE_URL}/pro/tier`, async ({ request }) => {
    const body = (await request.json()) as { tier: string };

    return HttpResponse.json({
      success: true,
      entitlement: mockFeatureFlags,
      usage: mockUsage,
      is_trial_entity: body.tier === "trial",
    });
  }),

  // ============ Widget Metadata Endpoints ============

  http.get(`${BASE_URL}/pro/widget-metadata`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${BASE_URL}/pro/widget-metadata`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.patch(`${BASE_URL}/pro/widget-metadata`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete(`${BASE_URL}/pro/widget-metadata/:widgetId`, () => {
    return HttpResponse.json([]);
  }),

  // ============ Data Connector Endpoints ============

  // API Sources
  http.get(`${BASE_URL}/pro/data-connectors/api-source`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${BASE_URL}/pro/data-connectors/api-source/:sourceUuid`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  http.delete(`${BASE_URL}/pro/data-connectors/api-source/:sourceUuid`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // File widgets
  http.get(`${BASE_URL}/pro/data-connectors/file`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${BASE_URL}/pro/data-connectors/file/:sourceUuid`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  http.delete(`${BASE_URL}/pro/data-connectors/file/:sourceUuid`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // Single widgets
  http.get(`${BASE_URL}/pro/data-connectors/single-widget`, () => {
    return HttpResponse.json([]);
  }),

  http.post(
    `${BASE_URL}/pro/data-connectors/single-widget/:sourceUuid`,
    () => {
      return HttpResponse.json({ status: 200 });
    },
  ),

  http.delete(
    `${BASE_URL}/pro/data-connectors/single-widget/:widgetUuid`,
    () => {
      return HttpResponse.json({ status: 200 });
    },
  ),

  // ============ Files Endpoints ============

  http.get(`${BASE_URL}/pro/files`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE_URL}/pro/files/:fileUuid/presigned-url`, ({ params }) => {
    const { fileUuid } = params;
    return HttpResponse.json({
      pre_signed_url: `https://storage.example.com/${fileUuid}`,
      stored_file_uuid: fileUuid as string,
      original_file_name: "test-file.csv",
    });
  }),

  http.delete(`${BASE_URL}/pro/files/:fileUuid`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  http.delete(`${BASE_URL}/pro/files`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // ============ Copilot Endpoints ============

  http.get(`${BASE_URL}/pro/copilot-chats`, () => {
    return HttpResponse.json({ chats: [] });
  }),

  http.post(`${BASE_URL}/pro/copilot-chats`, () => {
    return HttpResponse.json(mockUsage);
  }),

  http.get(`${BASE_URL}/pro/custom-copilot`, () => {
    return HttpResponse.json([]);
  }),

  http.put(`${BASE_URL}/pro/custom-copilot`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete(`${BASE_URL}/pro/custom-copilot/:uuid`, () => {
    return HttpResponse.json({ success: true });
  }),

  // ============ Prompts Endpoints ============

  http.get(`${BASE_URL}/pro/prompts`, () => {
    return HttpResponse.json([]);
  }),

  http.post(`${BASE_URL}/pro/prompts`, () => {
    return HttpResponse.json({ success: true });
  }),

  // ============ Other Endpoints ============

  // Zero to hero (onboarding)
  http.post(`${BASE_URL}/pro/zero-to-hero`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // Developer onboarding
  http.get(`${BASE_URL}/pro/pro-developer-onboarding-info`, () => {
    return HttpResponse.json({});
  }),

  http.post(`${BASE_URL}/pro/pro-developer-onboarding-info`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Book demo
  http.post(`${BASE_URL}/pro/book-demo`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // Enabled bundles
  http.get(`${BASE_URL}/pro/enabled-bundles`, () => {
    return HttpResponse.json({});
  }),

  http.put(`${BASE_URL}/pro/enabled-bundles`, () => {
    return HttpResponse.json({ success: true });
  }),

  // User has entity
  http.get(`${BASE_URL}/pro/user-has-entity`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Theme settings
  http.get(`${BASE_URL}/pro/theme-settings`, () => {
    return HttpResponse.json({ light: null, dark: null });
  }),

  // MCP servers
  http.post(`${BASE_URL}/pro/mcp-servers`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // Marketing/newsletters
  http.get(`${BASE_URL}/marketing`, () => {
    return HttpResponse.json({
      email_newsletter: false,
      email_academia: false,
      email_bot: false,
      email_prowaitlist: false,
    });
  }),

  http.put(`${BASE_URL}/marketing`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // TV state
  http.post(`${BASE_URL}/pro/tv-state`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // User update
  http.put(`${BASE_URL}/user`, () => {
    return HttpResponse.json({ status: 200 });
  }),

  // ============ Passthrough Handlers ============
  // Allow test URLs used by unit tests with vi.fn() mocks to pass through
  http.all("https://test-backend.com/*", () => passthrough()),
  http.all("http://test-backend.com/*", () => passthrough()),
  http.all("https://localhost/*", () => passthrough()),
  http.all("http://localhost/*", () => passthrough()),
];

// Helper to create custom handlers for specific test scenarios
export function createMockHandler(
  method: "get" | "post" | "put" | "delete" | "patch",
  path: string,
  response: unknown,
  status = 200,
) {
  const httpMethod = http[method];
  return httpMethod(`${BASE_URL}${path}`, () => {
    return HttpResponse.json(response, { status });
  });
}

// Helper to create error handler
export function createErrorHandler(
  method: "get" | "post" | "put" | "delete" | "patch",
  path: string,
  errorMessage: string,
  status = 500,
) {
  const httpMethod = http[method];
  return httpMethod(`${BASE_URL}${path}`, () => {
    return HttpResponse.json({ detail: errorMessage }, { status });
  });
}
