/**
 * MSW Integration Tests for Auth API
 *
 * This file demonstrates how to use MSW (Mock Service Worker) for API testing.
 * Unlike vi.mock-based tests, MSW intercepts actual network requests,
 * providing more realistic testing of the API layer.
 *
 * Usage:
 * 1. Import setupMSW() and call it in describe block
 * 2. Use server.use() to override handlers for specific test scenarios
 * 3. Default handlers are in tests/mocks/handlers.ts
 */

import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpResponse,
  http,
  mockDashboardData,
  mockUsage,
  mockUser,
  server,
  setupMSW,
} from "../../mocks/msw-utils";

const BASE_URL = "https://backend.openbb.dev";

// Create a test axios client (similar to apiClient but without store dependencies)
const testClient = axios.create({
  baseURL: BASE_URL,
});

describe("MSW Integration - Auth API", () => {
  setupMSW();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /pro/login", () => {
    it("should return user data on successful login", async () => {
      const { data, status } = await testClient.post("/pro/login", {
        email: "test@example.com",
        password: "password123",
        remember: false,
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty("uuid", mockUser.uuid);
      expect(data).toHaveProperty("email", mockUser.email);
      expect(data).toHaveProperty("token", mockUser.token);
    });

    it("should return 401 for invalid credentials", async () => {
      try {
        await testClient.post("/pro/login", {
          email: "invalid@example.com",
          password: "wrongpassword",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.detail).toBe("Invalid credentials");
      }
    });

    it("should return 2FA required for 2fa@example.com", async () => {
      const { data, status } = await testClient.post("/pro/login", {
        email: "2fa@example.com",
        password: "password123",
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty("requires_2fa", true);
    });
  });

  describe("GET /pro/validate", () => {
    it("should validate authenticated user", async () => {
      const { data, status } = await testClient.get("/pro/validate", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty("uuid");
      expect(data).toHaveProperty("valid", true);
    });

    it("should reject invalid token", async () => {
      try {
        await testClient.get("/pro/validate", {
          headers: { Authorization: "Bearer invalid-token" },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe("POST /pro/logout", () => {
    it("should successfully logout", async () => {
      const { data, status } = await testClient.post("/pro/logout");

      expect(status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });
  });

  describe("GET /pro/user", () => {
    it("should return user data when authenticated", async () => {
      const { data, status } = await testClient.get("/pro/user", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty("uuid", mockUser.uuid);
      expect(data).toHaveProperty("email", mockUser.email);
      expect(data).toHaveProperty("first_name", mockUser.first_name);
      expect(data).toHaveProperty("last_name", mockUser.last_name);
    });

    it("should reject unauthenticated requests", async () => {
      try {
        await testClient.get("/pro/user");
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe("POST /pro/register", () => {
    it("should successfully register new user", async () => {
      const { status } = await testClient.post("/pro/register", {
        email: "newuser@example.com",
        newsletter: true,
        hear_about_us: "Google",
      });

      expect(status).toBe(200);
    });

    it("should reject duplicate email", async () => {
      try {
        await testClient.post("/pro/register", {
          email: "existing@example.com",
          newsletter: true,
          hear_about_us: "Google",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.detail).toBe("Email already registered");
      }
    });
  });

  describe("POST /forgot-password", () => {
    it("should send forgot password email", async () => {
      const { status } = await testClient.post("/forgot-password", {
        email: "test@example.com",
        redirect: "pro",
      });

      expect(status).toBe(200);
    });

    it("should return 404 for non-existent email", async () => {
      try {
        await testClient.post("/forgot-password", {
          email: "notfound@example.com",
          redirect: "pro",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.detail).toBe("Email not found");
      }
    });
  });

  describe("GET /pro/usage", () => {
    it("should return usage data", async () => {
      const { data, status } = await testClient.get("/pro/usage");

      expect(status).toBe(200);
      expect(data).toEqual(mockUsage);
    });
  });

  describe("Custom Handler Overrides", () => {
    it("should allow overriding handlers per test", async () => {
      // Override the user endpoint for this specific test
      server.use(
        http.get(`${BASE_URL}/pro/user`, () => {
          return HttpResponse.json({
            uuid: "custom-uuid",
            email: "custom@test.com",
            custom_field: "This was added by override",
          });
        }),
      );

      const { data, status } = await testClient.get("/pro/user", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(status).toBe(200);
      expect(data.uuid).toBe("custom-uuid");
      expect(data.custom_field).toBe("This was added by override");
    });

    it("should reset to default handlers after previous test", async () => {
      // server.resetHandlers() is called in afterEach, so this uses default
      const { data } = await testClient.get("/pro/user", {
        headers: { Authorization: "Bearer valid-token" },
      });

      // Should be back to default mock user
      expect(data.uuid).toBe(mockUser.uuid);
      expect(data).not.toHaveProperty("custom_field");
    });

    it("should allow simulating server errors", async () => {
      server.use(
        http.get(`${BASE_URL}/pro/user`, () => {
          return HttpResponse.json(
            { detail: "Internal server error" },
            { status: 500 },
          );
        }),
      );

      try {
        await testClient.get("/pro/user", {
          headers: { Authorization: "Bearer valid-token" },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(500);
      }
    });

    it("should allow simulating network delays", async () => {
      server.use(
        http.get(`${BASE_URL}/pro/user`, async () => {
          // Simulate 100ms delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(mockUser);
        }),
      );

      const start = Date.now();
      await testClient.get("/pro/user", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });
});

describe("MSW Integration - Dashboard API", () => {
  setupMSW();

  describe("GET /pro/dash/sync", () => {
    it("should return dashboard data", async () => {
      const { data, status } = await testClient.get("/pro/dash/sync");

      expect(status).toBe(200);
      expect(data).toEqual(mockDashboardData);
    });
  });

  describe("POST /pro/dash/sync", () => {
    it("should save dashboard changes", async () => {
      const changes = {
        "dashboard-1": { content: { name: "Updated Dashboard" } },
      };

      const { data, status } = await testClient.post("/pro/dash/sync", {
        items: changes,
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });
  });

  describe("POST /pro/dash/:dashboardUuid/share", () => {
    it("should share dashboard", async () => {
      const { data, status } = await testClient.post(
        "/pro/dash/dashboard-1/share",
        { shares: { "user@example.com": "view" } },
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });

    it("should return 404 for non-existent dashboard", async () => {
      try {
        await testClient.post("/pro/dash/non-existent/share", {
          shares: { "user@example.com": "view" },
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });
});

describe("MSW Integration - 2FA Endpoints", () => {
  setupMSW();

  describe("POST /totp", () => {
    it("should generate TOTP QR code", async () => {
      const { data, status } = await testClient.post("/totp");

      expect(status).toBe(200);
      expect(data).toHaveProperty("uri");
      expect(data).toHaveProperty("secret");
      expect(data.uri).toContain("otpauth://totp/");
    });
  });

  describe("POST /totp/activate", () => {
    it("should activate TOTP with valid code", async () => {
      const { status } = await testClient.post("/totp/activate", {
        totp_token: 123456,
      });

      expect(status).toBe(200);
    });

    it("should reject invalid TOTP code", async () => {
      try {
        await testClient.post("/totp/activate", {
          totp_token: 999999,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe("GET /pro/2fa", () => {
    it("should return 2FA settings", async () => {
      const { data, status } = await testClient.get("/pro/2fa");

      expect(status).toBe(200);
      expect(data).toHaveProperty("two_factor_auth");
      expect(data).toHaveProperty("entity_require_authenticator");
    });
  });
});
