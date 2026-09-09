import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Create server instance with default handlers
export const server = setupServer(...handlers);

// Export handlers for extending in tests
export { handlers };

// Re-export useful MSW utilities
export { http, HttpResponse } from "msw";
export {
  createMockHandler,
  createErrorHandler,
  mockUser,
  mockValidateResponse,
  mockDashboardData,
  mockUsage,
  mockFeatureFlags,
} from "./handlers";
