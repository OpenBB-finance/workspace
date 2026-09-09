import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import {
  acceptTerms,
  activateQRCode,
  bookDemo,
  deleteApiSource,
  deleteFileWidget,
  deleteSingleWidget,
  deleteUploadedFile,
  deleteUploadedFiles,
  deleteWidgetMetadata,
  forgotPassword,
  forgotPasswordConfirmation,
  generateQRCode,
  getAgentConnectionErrorMessage,
  getApiSources,
  getCopilotChat,
  getDeveloperOnboardingQuestions,
  getEnabledBundles,
  getFileWidgets,
  getSingleWidgets,
  getStoredFiles,
  getUsage,
  getUser,
  getUserChats,
  getWidgetMetadata,
  googleLogin,
  isValidMainTicker,
  login,
  logout,
  migrateDefaultTicker,
  patchWidgetMetadata,
  postApiSource,
  postFileWidget,
  postSingleWidget,
  postUserChats,
  postWidgetMetadata,
  putEnabledBundles,
  putTier,
  registerUser,
  searchChats,
  submitDeveloperOnboardingQuestions,
  updateFullName,
  updatePassword,
  updateZeroToHero,
  userHasEntity,
  validateUser,
} from "~/api/auth.api";
import { fetchQuerySymbols } from "~/lib/api/sdkComponents";

// Mock the apiClient
vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock("~/lib/api/sdkComponents", () => ({
  fetchQuerySymbols: vi.fn(),
}));

describe("API Client Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAgentConnectionErrorMessage", () => {
    it("maps generic fetch network errors to a more actionable message", () => {
      const message = getAgentConnectionErrorMessage(new Error("Failed to fetch"));
      expect(message).toContain("Could not reach the agent server");
      expect(message).toContain("CORS");
    });

    it("keeps non-network error messages unchanged", () => {
      const message = getAgentConnectionErrorMessage(
        new Error("Unauthorized access to the copilot URL."),
      );
      expect(message).toBe("Unauthorized access to the copilot URL.");
    });
  });

  describe("login", () => {
    it("should return data on successful login", async () => {
      const mockResponse = { status: 200, data: { token: "abc123" } };

      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await login("test@example.com", "password");
      expect(apiClient.post).toHaveBeenCalledWith("/pro/login", expect.any(Object));
      expect(response).toEqual({ status: 200, token: "abc123" });
    });

    it("should handle login errors", async () => {
      const mockError = {
        response: { status: 401, data: { detail: "Invalid credentials" } },
      };
      vi.spyOn(apiClient, "post").mockRejectedValue(mockError);

      const response = await login("test@example.com", "wrong-password");
      expect(response).toEqual({ status: 401, detail: "Invalid credentials" });
    });
  });

  describe("validateUser", () => {
    it("should return user data on successful validation", async () => {
      const mockResponse = { data: { user: "testUser" } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await validateUser();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/validate");
      expect(data).toEqual({ user: "testUser" });
    });
  });

  describe("logout", () => {
    it("should return data on successful logout", async () => {
      const mockResponse = { status: 200, data: { success: true } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await logout();
      expect(apiClient.post).toHaveBeenCalledWith("/pro/logout");
      expect(response).toEqual({ success: true });
    });
  });

  describe("googleLogin", () => {
    it("should return data on successful Google login", async () => {
      const mockResponse = { status: 200, data: { token: "googleToken" } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await googleLogin("test@example.com", true);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/google-auth",
        expect.any(Object),
      );
      expect(response).toEqual({ token: "googleToken", status: 200 });
    });
  });

  describe("submitDeveloperOnboardingQuestions", () => {
    it("should return data on successful developer onboarding submission", async () => {
      const mockResponse = { data: { success: true } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const onboardingData = {
        primaryUsage: "Development",
        organization: "DevOrg",
        organizationName: "Developer Organization",
        role: "Engineer",
        programmingExperience: "5 years",
        dataTypes: ["JSON", "XML"],
        otherDataType: "CSV",
      };

      const response = await submitDeveloperOnboardingQuestions(onboardingData);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/pro-developer-onboarding-info",
        onboardingData,
      );
      expect(response).toEqual({ success: true });
    });
  });

  describe("getDeveloperOnboardingQuestions", () => {
    it("should return developer onboarding questions", async () => {
      const mockResponse = { data: { questions: ["Q1", "Q2"] } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getDeveloperOnboardingQuestions();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/pro-developer-onboarding-info");
      expect(data).toEqual({ questions: ["Q1", "Q2"] });
    });
  });

  describe("getUserChats", () => {
    it("should return user chats", async () => {
      const mockResponse = { data: { chats: [{ id: 1, message: "Hello" }] } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getUserChats();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/copilot-chats");
      expect(data).toEqual({ chats: [{ id: 1, message: "Hello" }] });
    });
  });

  describe("postUserChats", () => {
    it("should post user chats and return usage", async () => {
      const mockResponse = {
        status: 200,
        data: {
          number_copilot_calls_day_count: 0,
          total_file_upload_size_gb_count: 0.02411199826747179,
          copilot_calls_limit: 100,
          file_upload_size_limit: 50.0,
        },
      };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);
      const uuid = uuidv4();

      const chats = {
        [uuid]: {
          uuid,
          createdAt: 1721284317112,
          label: "My Sample Chat",
          messages: {},
          titleManuallyUpdated: false,
          titleNeedsUpdate: false,
          lastOpened: 0,
        },
      };

      const response = await postUserChats(chats);
      expect(apiClient.post).toHaveBeenCalledWith("/pro/copilot-chats", { chats });
      expect(response).toEqual({ status: 200, usage: mockResponse.data });
    });
  });

  describe("searchChats", () => {
    it("should search chats and map messages to recentMessages", async () => {
      const mockResponse = {
        data: [
          {
            uuid: "chat-1",
            createdAt: 1000,
            label: "My Sample Chat",
            messages: [
              { role: "human", content: "Hello", timestamp: 1, copilotId: "cp" },
              { role: "ai", content: "Hi there", timestamp: 2, copilotId: "cp" },
              { role: "ai", content: "", timestamp: 3, copilotId: "cp" },
            ],
          },
        ],
      };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await searchChats("  hello  ");
      expect(apiClient.get).toHaveBeenCalledWith("/pro/copilot-chats/search", {
        params: { query: "hello" },
      });
      expect(data.results).toEqual([
        {
          uuid: "chat-1",
          createdAt: 1000,
          label: "My Sample Chat",
          recentMessages: ["Hello", "Hi there"],
        },
      ]);
    });

    it("should return an empty results array when the request fails", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("network error"));

      const data = await searchChats("query");
      expect(data.results).toEqual([]);
    });

    it("should default to an empty recentMessages array when there are no messages", async () => {
      const mockResponse = {
        data: [{ uuid: "chat-1", createdAt: 1000, label: "Empty Chat" }],
      };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await searchChats("query");
      expect(data.results).toEqual([
        { uuid: "chat-1", createdAt: 1000, label: "Empty Chat", recentMessages: [] },
      ]);
    });

    it("should return the original search query alongside the results", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

      const data = await searchChats("budget report");
      expect(data.searchQuery).toBe("budget report");
    });
  });

  describe("getCopilotChat", () => {
    it("should return the chat for the given uuid", async () => {
      const mockChat = { uuid: "chat-1", createdAt: 1000, label: "Chat", messages: [] };
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockChat });

      const data = await getCopilotChat("chat-1");
      expect(apiClient.get).toHaveBeenCalledWith("/pro/copilot-chats/chat-1");
      expect(data).toEqual(mockChat);
    });

    it("should return null when the request fails", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("not found"));

      const data = await getCopilotChat("chat-1");
      expect(data).toBeNull();
    });
  });

  describe("getUser", () => {
    it("should return user data", async () => {
      const mockResponse = { data: { user: "testUser" } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getUser();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/user");
      expect(data).toEqual({ user: "testUser" });
    });
  });

  describe("updateZeroToHero", () => {
    it("should return status on successful update", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const challenges = { challengeId: "123", completed: true };

      // @ts-expect-error - the challenges schema is not fully implemented for the sake of testing
      const response = await updateZeroToHero(challenges);
      expect(apiClient.post).toHaveBeenCalledWith("/pro/zero-to-hero", challenges);
      expect(response).toEqual({ status: 200 });
    });
  });

  describe("acceptTerms", () => {
    it("should return data on successful terms acceptance", async () => {
      const mockResponse = { data: { success: true } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await acceptTerms();
      expect(apiClient.post).toHaveBeenCalledWith("/pro/accepted-pro-tos");
      expect(response).toEqual({ success: true });
    });
  });

  describe("updatePassword", () => {
    it("should return status on successful password update", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "put").mockResolvedValue(mockResponse);

      const response = await updatePassword("oldPass", "newPass");
      expect(apiClient.put).toHaveBeenCalledWith("/user", {
        old_password: "oldPass",
        new_password: "newPass",
      });
      expect(response).toEqual(200);
    });
  });

  describe("registerUser", () => {
    it("should return status on successful registration", async () => {
      const mockResponse = { status: 201 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await registerUser("test@example.com", true, "github");
      expect(apiClient.post).toHaveBeenCalledWith("/pro/register", {
        email: "test@example.com",
        newsletter: true,
        hear_about_us: "github",
      });
      expect(response).toEqual({ status: 201 });
    });
  });

  describe("updateFullName", () => {
    it("should return status on successful full name update", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "put").mockResolvedValue(mockResponse);

      const response = await updateFullName("John", "Doe");
      expect(apiClient.put).toHaveBeenCalledWith("/user", {
        first_name: "John",
        last_name: "Doe",
      });
      expect(response).toEqual(200);
    });
  });

  describe("forgotPassword", () => {
    it("should return status on successful password reset request", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await forgotPassword("test@example.com");
      expect(apiClient.post).toHaveBeenCalledWith("/forgot-password", {
        email: "test@example.com",
        redirect: "pro",
      });
      expect(response).toEqual({ status: 200 });
    });
  });

  describe("forgotPasswordConfirmation", () => {
    it("should return status on successful password reset confirmation", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await forgotPasswordConfirmation("token123", "newPassword");
      expect(apiClient.post).toHaveBeenCalledWith("/forgot-password-confirmation", {
        token: "token123",
        password: "newPassword",
      });
      expect(response).toEqual(200);
    });
  });

  describe("generateQRCode", () => {
    it("should return QR code data on successful generation", async () => {
      const mockResponse = { data: { uri: "someUri", secret: "someSecret" } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await generateQRCode();
      expect(apiClient.post).toHaveBeenCalledWith("/totp");
      expect(response).toEqual(mockResponse.data);
    });
  });

  describe("activateQRCode", () => {
    it("should return status on successful QR code activation", async () => {
      const mockResponse = { status: 200 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const response = await activateQRCode(123456);
      expect(apiClient.post).toHaveBeenCalledWith("/totp/activate", {
        totp_token: 123456,
      });
      expect(response).toEqual(200);
    });
  });

  describe("getSingleWidgets", () => {
    it("should return single widgets", async () => {
      const mockResponse = { data: [{ id: "widget1" }] };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getSingleWidgets();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/data-connectors/single-widget");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("postSingleWidget", () => {
    it("should post a single widget and return status", async () => {
      const mockResponse = { status: 201 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const data = { name: "widget", endpoint: "/endpoint" };

      // @ts-expect-error - the data schema is not fully implemented for the sake of testing
      const response = await postSingleWidget("sourceUuid", data);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/data-connectors/single-widget/sourceUuid",
        data,
      );
      expect(response).toEqual({ status: 201 });
    });
  });

  describe("deleteSingleWidget", () => {
    it("should delete a single widget and return status", async () => {
      const mockResponse = { status: 204 };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const response = await deleteSingleWidget("widgetUuid");
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/pro/data-connectors/single-widget/widgetUuid",
      );
      expect(response).toEqual({ status: 204 });
    });
  });

  describe("getApiSources", () => {
    it("should return API sources", async () => {
      const mockResponse = { data: [{ id: "source1" }] };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getApiSources();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/data-connectors/api-source");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("postApiSource", () => {
    it("should post an API source and return status", async () => {
      const mockResponse = { status: 201 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const data = { name: "source", url: "http://example.com" };
      const response = await postApiSource("sourceUuid", data);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/data-connectors/api-source/sourceUuid",
        data,
      );
      expect(response).toEqual({ status: 201 });
    });
  });

  describe("deleteApiSource", () => {
    it("should delete an API source and return status", async () => {
      const mockResponse = { status: 204 };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const response = await deleteApiSource("sourceUuid");
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/pro/data-connectors/api-source/sourceUuid",
      );
      expect(response).toEqual({ status: 204 });
    });
  });

  describe("getStoredFiles", () => {
    it("should return stored files", async () => {
      const mockResponse = { data: [{ uuid: "file1" }] };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getStoredFiles();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/files");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("getFileWidgets", () => {
    it("should return file widgets", async () => {
      const mockResponse = { data: [{ uuid: "widget1" }] };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getFileWidgets();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/data-connectors/file");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("postFileWidget", () => {
    it("should post a file widget and return status", async () => {
      const mockResponse = { status: 201 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const data = { name: "fileWidget", extension: "pdf" };

      // @ts-expect-error - the data schema is not fully implemented for the sake of testing
      const response = await postFileWidget("sourceUuid", data);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/data-connectors/file/sourceUuid",
        data,
        { signal: undefined },
      );
      expect(response).toEqual({ status: 201 });
    });
  });

  describe("deleteUploadedFile", () => {
    it("should delete an uploaded file and return status", async () => {
      const mockResponse = { status: 204 };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const response = await deleteUploadedFile("fileUuid");
      expect(apiClient.delete).toHaveBeenCalledWith("/pro/files/fileUuid");
      expect(response).toEqual({ status: 204 });
    });
  });

  describe("deleteUploadedFiles", () => {
    it("should delete multiple uploaded files and return status", async () => {
      const mockResponse = { status: 204 };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const response = await deleteUploadedFiles(["fileUuid1", "fileUuid2"]);
      expect(apiClient.delete).toHaveBeenCalledWith("/pro/files", {
        data: { file_uuids: ["fileUuid1", "fileUuid2"] },
      });
      expect(response).toEqual({ status: 204 });
    });
  });

  describe("deleteFileWidget", () => {
    it("should delete a file widget and return status", async () => {
      const mockResponse = { status: 204 };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const response = await deleteFileWidget("sourceUuid");
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/pro/data-connectors/file/sourceUuid",
      );
      expect(response).toEqual({ status: 204 });
    });
  });

  describe("migrateDefaultTicker", () => {
    it("should migrate default ticker", async () => {
      const mockResponse = {
        results: [{ symbol: "AAPL", id: "AAPL", category: "equity" }],
      };
      // @ts-expect-error - axios type mock is not fully implemented for the sake of testing
      fetchQuerySymbols.mockResolvedValue(mockResponse);

      // @ts-expect-error - Ticker schema mock is not fully implemented for the sake of testing
      const ticker = await migrateDefaultTicker({ symbol: "AAPL" });
      expect(fetchQuerySymbols).toHaveBeenCalledWith({
        queryParams: { q: "AAPL" },
      });
      expect(ticker).toEqual(mockResponse.results[0]);
    });
  });

  describe("isValidMainTicker", () => {
    it("should validate main ticker", () => {
      const ticker = {
        id: "testTickerId",
        symbol: "testTickerSymbol",
        name: "testTickerName",
        exchange: "testTickerExchange",
        exchange_name: "testTickerExchangeName",
        category: "testTickerCategory",
        type: "testTickerType",
        currency: "testTickerCurrency",
        country: "testTickerCountry",
        industry: "testTickerIndustry",
        sector: "testTickerSector",
        cik: "testTickerCik",
        cusip: "testTickerCusip",
        isin: "testTickerIsin",
        has_options: true,
      };
      const isValid = isValidMainTicker(ticker);
      expect(isValid).toBe(true);
    });
  });

  describe("bookDemo", () => {
    it("should book a demo and return status", async () => {
      const mockResponse = { status: 201 };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const data = { first_name: "John", email: "john@example.com" };
      const response = await bookDemo(data);
      expect(apiClient.post).toHaveBeenCalledWith("/pro/book-demo", data);
      expect(response).toEqual(201);
    });
  });

  describe("getWidgetMetadata", () => {
    it("should return widget metadata", async () => {
      const mockResponse = { data: [{ id: "metadata1" }] };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getWidgetMetadata("iframe", "widgetName", "widgetId");
      expect(apiClient.get).toHaveBeenCalledWith("/pro/widget-metadata", {
        params: new URLSearchParams({
          widget_type: "iframe",
          name: "widgetName",
          widget_id: "widgetId",
        }),
      });
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("postWidgetMetadata", () => {
    it("should post widget metadata and return success", async () => {
      const mockResponse = { data: { success: true } };
      vi.spyOn(apiClient, "post").mockResolvedValue(mockResponse);

      const metadata = {
        widgetId: "widget-123",
        widgetType: "iframe",
        name: "Test Widget",
        description: "Test description",
        category: "Test Category",
        subCategory: "Test SubCategory",
        source: "Test Source",
      };

      // @ts-expect-error - the metadata schema is not fully implemented for the sake of testing
      const response = await postWidgetMetadata(metadata);
      expect(apiClient.post).toHaveBeenCalledWith("/pro/widget-metadata", metadata);
      expect(response).toEqual(mockResponse.data);
    });
  });

  describe("patchWidgetMetadata", () => {
    it("should patch widget metadata and return success", async () => {
      const mockResponse = { success: true };
      vi.spyOn(apiClient, "patch").mockResolvedValue({ data: mockResponse });

      const metadata = { id: "metadata1" };

      const response = await patchWidgetMetadata(
        // @ts-expect-error - the metadata schema is not fully implemented for the sake of testing
        metadata,
        "widgetId",
        "iframe",
        "name",
      );
      expect(apiClient.patch).toHaveBeenCalledWith("/pro/widget-metadata", metadata, {
        params: new URLSearchParams({
          widget_id: "widgetId",
          widget_type: "iframe",
          name: "name",
        }),
      });
      expect(response).toEqual(mockResponse);
    });
  });

  describe("deleteWidgetMetadata", () => {
    it("should delete widget metadata and return data", async () => {
      const mockResponse = { data: [{ id: "metadata1" }] };
      vi.spyOn(apiClient, "delete").mockResolvedValue(mockResponse);

      const data = await deleteWidgetMetadata("widgetId");
      expect(apiClient.delete).toHaveBeenCalledWith("/pro/widget-metadata/widgetId");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("putTier", () => {
    it("should update tier and return response", async () => {
      const mockResponse = {
        data: {
          success: true,
          entitlement: {},
          usage: {},
          is_trial_entity: false,
        },
      };
      vi.spyOn(apiClient, "put").mockResolvedValue(mockResponse);

      const response = await putTier({ tier: "premium" });
      expect(apiClient.put).toHaveBeenCalledWith("/pro/tier", { tier: "premium" });
      expect(response).toEqual(mockResponse.data);
    });
  });

  describe("userHasEntity", () => {
    it("should return if user has entity", async () => {
      const mockResponse = { data: { success: true } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await userHasEntity();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/user-has-entity");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("getEnabledBundles", () => {
    it("should return enabled bundles", async () => {
      const mockResponse = { data: { bundles: ["bundle1"] } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getEnabledBundles();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/enabled-bundles");
      expect(data).toEqual(mockResponse.data);
    });
  });

  describe("putEnabledBundles", () => {
    it("should update enabled bundles and return success", async () => {
      const mockResponse = { data: { success: true } };
      vi.spyOn(apiClient, "put").mockResolvedValue(mockResponse);

      const bundles = { bundles: ["bundle1"] };

      // @ts-expect-error - the bundles schema is not fully implemented for the sake of testing
      const response = await putEnabledBundles(bundles);
      expect(apiClient.put).toHaveBeenCalledWith("/pro/enabled-bundles", bundles);
      expect(response).toEqual(mockResponse.data);
    });
  });

  describe("getUsage", () => {
    it("should return usage data", async () => {
      const mockResponse = { data: { usage: "data" } };
      vi.spyOn(apiClient, "get").mockResolvedValue(mockResponse);

      const data = await getUsage();
      expect(apiClient.get).toHaveBeenCalledWith("/pro/usage");
      expect(data).toEqual(mockResponse.data);
    });
  });
});
