import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source } from "~/lib/state/backendConnector";
import {
  validateBackend,
  validateBackendEndpoints,
  validateObject,
} from "~/lib/utils/validateBackend";
import type { WidgetsType } from "~/utils/zodForms";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("validateBackend - widgets.json endpoint behavior", () => {
  const mockSource: Source = {
    url: "https://test-backend.com",
    name: "Test Backend",
    endpointHeaders: [
      { key: "Authorization", value: "Bearer test-token", location: "headers" },
    ],
    id: "test-uuid",
  };

  const mockBackendUrl = new URL(mockSource.url);
  const mockHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("widgets.json response handling", () => {
    it("should handle jsonify({}) for widgets.json - returns empty widgets, no error message", async () => {
      // Mock widgets.json response with empty object
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Headers(),
        })
        // Mock apps.json response (empty for this test)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      // Empty object {} is a valid widgets.json format (just means no widgets)
      expect(result.widgets).toEqual({});
      expect(result.errorMessage).toBeNull();
    });

    it("should handle jsonify([]) for widgets.json - shows appropriate error message", async () => {
      // Mock widgets.json response with empty array
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock apps.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.widgets).toEqual({});
      expect(result.errorMessage).not.toBeNull();
      expect(result.errorMessage).toContain("Invalid format");
      expect(result.errorMessage).toContain("Expected:");
      expect(result.errorMessage).toContain("Received:");
    });

    it("should handle valid widgets.json format correctly", async () => {
      const validWidgets = {
        stock_price: {
          name: "Stock Price",
          description: "Get current stock price",
          category: "Stocks",
          endpoint: "/stock/price",
          type: "table",
          gridData: {
            w: 20,
            h: 9,
          },
          data: {
            table: {
              columnsDefs: [
                {
                  field: "symbol",
                  headerName: "Symbol",
                  cellDataType: "text",
                },
              ],
            },
          },
          params: [
            {
              type: "text",
              paramName: "symbol",
              value: "AAPL",
              label: "Symbol",
              show: true,
            },
          ],
        },
      };

      // Mock widgets.json response with valid widgets
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validWidgets),
          headers: new Headers(),
        })
        // Mock apps.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.widgets).toEqual(
        expect.objectContaining({
          stock_price: expect.objectContaining({
            name: "Stock Price",
            description: "Get current stock price",
          }),
        }),
      );
      expect(result.errorMessage).toBeNull();
    });

    it("should report unrecognized widget keys when widget schema is otherwise valid", async () => {
      const widgetWithExtraKey = {
        stock_price: {
          name: "Stock Price",
          description: "Get current stock price",
          endpoint: "/stock/price",
          params: [],
          unsupported_widget_option: true,
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(widgetWithExtraKey),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.errorMessage).toBeNull();
      expect(result.unrecognizedKeysMessage).toEqual([
        {
          label: "[widgets.json]",
          entries: [
            {
              name: "Stock Price",
              keys: ["unsupported_widget_option"],
            },
          ],
        },
      ]);
    });

    it("should handle widgets.json with invalid widget schemas", async () => {
      const invalidWidgets = {
        invalid_widget: {
          name: "Invalid Widget",
          // Missing required fields like endpoint
          description: "This widget is missing required fields",
        },
        another_invalid: {
          // Missing name field
          endpoint: "/test",
          params: "invalid_params_format", // Should be object not string
        },
      };

      // Mock widgets.json response with invalid widgets
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidWidgets),
          headers: new Headers(),
        })
        // Mock apps.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.widgets).toEqual({});
      expect(result.errorMessage).not.toBeNull();
      expect(result.errorMessage).toContain("Invalid Widget");
    });

    it("should handle widgets.json fetch failure with appropriate error", async () => {
      // Mock widgets.json fetch failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({}),
        headers: new Headers(),
      });

      await expect(validateBackend(mockSource)).rejects.toThrow(
        "The widgets.json file was not found on the server.",
      );
    });

    it("should handle widgets.json with authentication errors", async () => {
      // Mock widgets.json fetch with 401 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({}),
        headers: new Headers(),
      });

      await expect(validateBackend(mockSource)).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should handle widgets.json network timeout", async () => {
      // Mock widgets.json fetch with timeout error
      mockFetch.mockRejectedValueOnce({
        code: 23,
        message: "Request timed out",
      });

      await expect(validateBackend(mockSource)).rejects.toThrow("Request timed out");
    });

    it("should detect OpenBB Platform from headers", async () => {
      const validWidgets = {
        test_widget: {
          name: "Test Widget",
          endpoint: "/test",
          params: {},
        },
      };

      // Mock widgets.json response with OpenBB Platform header
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validWidgets),
          headers: new Headers({ "X-Backend-Type": "OpenBB Platform" }),
        })
        // Mock apps.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.isOpenBBPlatform).toBe(true);
    });
  });

  describe("validateObject function", () => {
    it("should return error for array input", () => {
      const arrayInput = [{ name: "widget1" }];
      const result = validateObject(arrayInput);

      expect(result).not.toBeNull();
      expect(result).toContain("Invalid format");
      expect(result).toContain("Expected:");
      expect(result).toContain("Received:");
    });

    it("should return error for single widget object", () => {
      const singleWidget = { name: "widget1", description: "test", endpoint: "/test" };
      const result = validateObject(singleWidget);

      expect(result).not.toBeNull();
      expect(result).toContain("Invalid format");
    });

    it("should return null for valid widgets object", () => {
      const validWidgets = {
        widget1: {
          name: "Widget 1",
          description: "Test widget 1",
          endpoint: "/test1",
          params: [],
        },
        widget2: {
          name: "Widget 2",
          description: "Test widget 2",
          endpoint: "/test2",
          params: [],
        },
      };

      const result = validateObject(validWidgets);
      expect(result).toBeNull();
    });

    it("should return detailed validation errors for invalid widgets", () => {
      const invalidWidgets = {
        invalid_widget: {
          name: "", // Invalid: empty name
          description: "Invalid widget",
          endpoint: "/test2",
          params: "invalid", // Invalid: should be array
        },
        missing_fields: {
          // Missing required name and endpoint
          description: "Missing required fields",
        },
      };

      const result = validateObject(invalidWidgets);

      expect(result).not.toBeNull();
      // Should contain validation details for required fields
      expect(result).toContain("received undefined");
    });
  });

  describe("validateBackendEndpoints function", () => {
    it("should validate widget endpoints successfully", async () => {
      const widgets: WidgetsType = {
        test_widget: {
          name: "Test Widget",
          description: "A test widget",
          endpoint: "/test",
          sub_category: "test",
          subCategory: "test",
          type: "table",
          defaultViz: "table",
          sdkFunc: "test_widget",
          params: [
            {
              paramName: "symbol",
              type: "text",
              value: "AAPL",
              show: true,
            },
          ],
        },
      };

      // Mock successful endpoint response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
        headers: new Headers(),
      });
      const failedEndpoints = await validateBackendEndpoints(
        widgets,
        mockBackendUrl,
        mockHeaders,
      );

      expect(failedEndpoints).toEqual([]);
    });

    it("should detect failed widget endpoints", async () => {
      const widgets = {
        failing_widget: {
          name: "Failing Widget",
          description: "A failing widget",
          endpoint: "/failing",
          sub_category: "test",
          subCategory: "test",
          type: "table" as const,
          defaultViz: "table" as const,
          sdkFunc: "failing_widget",
          params: [],
        },
      };

      // Mock failing endpoint response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
        headers: new Headers(),
      });

      const failedEndpoints = await validateBackendEndpoints(
        widgets,
        mockBackendUrl,
        mockHeaders,
      );

      expect(failedEndpoints).toHaveLength(1);
      expect(failedEndpoints[0]).toContain("failing_widget");
      expect(failedEndpoints[0]).toContain("Internal server error");
    });

    it("should handle network errors for widget endpoints", async () => {
      const widgets = {
        network_error_widget: {
          name: "Network Error Widget",
          description: "A widget that causes network errors",
          endpoint: "/network-error",
          sub_category: "test",
          subCategory: "test",
          type: "table" as const,
          defaultViz: "table" as const,
          sdkFunc: "network_error_widget",
          params: [],
        },
      };

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const failedEndpoints = await validateBackendEndpoints(
        widgets,
        mockBackendUrl,
        mockHeaders,
      );

      expect(failedEndpoints).toHaveLength(1);
      expect(failedEndpoints[0]).toContain("network_error_widget");
      expect(failedEndpoints[0]).toContain("Network timeout");
    });

    it("passes the abort signal through to endpoint fetches", async () => {
      const widgets = {
        signal_widget: {
          name: "Signal Widget",
          description: "A widget for signal threading",
          endpoint: "/signal",
          sub_category: "test",
          subCategory: "test",
          type: "table" as const,
          defaultViz: "table" as const,
          sdkFunc: "signal_widget",
          params: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
        headers: new Headers(),
      });

      const signal = new AbortController().signal;
      await validateBackendEndpoints(widgets, mockBackendUrl, mockHeaders, false, signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal }),
      );
    });

    it("should skip 422 validation errors (expected for missing params)", async () => {
      const widgets = {
        param_required_widget: {
          name: "Param Required Widget",
          description: "Widget requiring parameters",
          endpoint: "/requires-params",
          sub_category: "test",
          subCategory: "test",
          type: "table" as const,
          defaultViz: "table" as const,
          sdkFunc: "param_required_widget",
          params: [
            {
              paramName: "required_param",
              type: "text" as const,
              value: "test",
              label: "Required Param",
              show: true,
            },
          ],
        },
      };

      // Mock 422 response (validation error for missing params)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ detail: "field required" }),
        headers: new Headers(),
      });

      const failedEndpoints = await validateBackendEndpoints(
        widgets,
        mockBackendUrl,
        mockHeaders,
      );

      // Should skip 422 errors as they're expected for widgets with required params
      expect(failedEndpoints).toEqual([]);
    });

    describe("POST endpoint validation", () => {
      it("should validate omni widgets with POST request", async () => {
        const omniWidget = {
          omni_test: {
            name: "Omni Test Widget",
            description: "Test omni widget",
            type: "omni" as const,
            endpoint: "/omni-test",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "omni" as const,
            sdkFunc: "omni_test",
            params: [
              {
                paramName: "test_param",
                type: "text" as const,
                value: "test",
                label: "Test Param",
                show: true,
              },
            ],
          },
        };

        // Mock successful POST response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              content: "test response",
              data_format: "text",
            }),
          headers: new Headers(),
        });

        const failedEndpoints = await validateBackendEndpoints(
          omniWidget,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toEqual([]);

        // Verify POST request was made with correct payload
        expect(mockFetch).toHaveBeenCalledWith(
          new URL("/omni-test", mockBackendUrl).toString(),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-token",
            }),
            body: expect.stringContaining("test validation query"),
          }),
        );

        // Verify the body contains the prompt
        const fetchCall = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);
        expect(requestBody.prompt).toBe("test validation query");
      });

      it("should validate ssrm_table widgets with POST request", async () => {
        const ssrmWidget = {
          ssrm_test: {
            name: "SSRM Test Widget",
            description: "Test SSRM widget",
            type: "ssrm_table" as const,
            endpoint: "/ssrm-test",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "ssrm_table" as const,
            sdkFunc: "ssrm_test",
            params: [
              {
                paramName: "database_param",
                type: "text" as const,
                value: "test",
                label: "Database Param",
                show: true,
              },
            ],
          },
        };

        // Mock successful POST response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rowData: [],
              rowCount: 0,
            }),
          headers: new Headers(),
        });

        const failedEndpoints = await validateBackendEndpoints(
          ssrmWidget,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toEqual([]);

        // Verify POST request was made with correct payload
        expect(mockFetch).toHaveBeenCalledWith(
          new URL("/ssrm-test", mockBackendUrl).toString(),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-token",
            }),
            body: expect.stringContaining("startRow"),
          }),
        );

        // Verify the body contains SSRM pagination params
        const fetchCall = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);
        expect(requestBody.startRow).toBe(0);
        expect(requestBody.endRow).toBe(10);
      });

      it("should handle failed omni widget endpoints", async () => {
        const omniWidget = {
          failing_omni: {
            name: "Failing Omni Widget",
            description: "Omni widget that fails",
            type: "omni" as const,
            endpoint: "/failing-omni",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "omni" as const,
            sdkFunc: "failing_omni",
            params: [],
          },
        };

        // Mock failed POST response
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Omni processing failed" }),
          headers: new Headers(),
        });

        const failedEndpoints = await validateBackendEndpoints(
          omniWidget,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toHaveLength(1);
        expect(failedEndpoints[0]).toContain("failing_omni");
        expect(failedEndpoints[0]).toContain("Omni processing failed");
      });

      it("should handle failed ssrm_table widget endpoints", async () => {
        const ssrmWidget = {
          failing_ssrm: {
            name: "Failing SSRM Widget",
            description: "SSRM widget that fails",
            type: "ssrm_table" as const,
            endpoint: "/failing-ssrm",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "ssrm_table" as const,
            sdkFunc: "failing_ssrm",
            params: [],
          },
        };

        // Mock failed POST response
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Database connection failed" }),
          headers: new Headers(),
        });

        const failedEndpoints = await validateBackendEndpoints(
          ssrmWidget,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toHaveLength(1);
        expect(failedEndpoints[0]).toContain("failing_ssrm");
        expect(failedEndpoints[0]).toContain("Database connection failed");
      });

      it("should handle mixed GET and POST widgets correctly", async () => {
        const mixedWidgets = {
          get_widget: {
            name: "GET Widget",
            description: "Regular GET widget",
            type: "table" as const,
            endpoint: "/get-endpoint",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "table" as const,
            sdkFunc: "get_widget",
            params: [],
          },
          omni_widget: {
            name: "Omni Widget",
            description: "POST omni widget",
            type: "omni" as const,
            endpoint: "/omni-endpoint",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "omni" as const,
            sdkFunc: "omni_widget",
            params: [],
          },
          ssrm_widget: {
            name: "SSRM Widget",
            description: "POST SSRM widget",
            type: "ssrm_table" as const,
            endpoint: "/ssrm-endpoint",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "ssrm_table" as const,
            sdkFunc: "ssrm_widget",
            params: [],
          },
        };

        // Mock responses for all three widgets
        mockFetch
          // GET widget response
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
            headers: new Headers(),
          })
          // Omni widget response
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ content: "test", data_format: "text" }),
            headers: new Headers(),
          })
          // SSRM widget response
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ rowData: [], rowCount: 0 }),
            headers: new Headers(),
          });

        const failedEndpoints = await validateBackendEndpoints(
          mixedWidgets,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toEqual([]);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // Verify GET request
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("/get-endpoint"),
          expect.objectContaining({ method: "GET" }),
        );

        // Verify POST requests
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("/omni-endpoint"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("test validation query"),
          }),
        );

        expect(mockFetch).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining("/ssrm-endpoint"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("startRow"),
          }),
        );
      });

      it("should include initial params in POST request bodies", async () => {
        const widgetWithParams = {
          parameterized_omni: {
            name: "Parameterized Omni",
            description: "Omni widget with parameters",
            type: "omni" as const,
            endpoint: "/parameterized-omni",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "omni" as const,
            sdkFunc: "parameterized_omni",
            params: [
              {
                paramName: "ticker",
                type: "text" as const,
                value: "AAPL",
                label: "Ticker",
                show: true,
              },
              {
                paramName: "period",
                type: "text" as const,
                value: "1d",
                label: "Period",
                show: true,
              },
            ],
          },
        };

        // Mock successful response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ content: "success", data_format: "text" }),
          headers: new Headers(),
        });

        const failedEndpoints = await validateBackendEndpoints(
          widgetWithParams,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toEqual([]);

        // Verify the request body includes both prompt and initial params
        const fetchCall = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.prompt).toBe("test validation query");
        expect(requestBody.ticker).toBe("AAPL");
        expect(requestBody.period).toBe("1d");
      });

      it("should handle network errors for POST widgets", async () => {
        const omniWidget = {
          network_error_omni: {
            name: "Network Error Omni",
            description: "Omni widget with network error",
            type: "omni" as const,
            endpoint: "/network-error",
            sub_category: "test",
            subCategory: "test",
            defaultViz: "omni" as const,
            sdkFunc: "network_error_omni",
            params: [],
          },
        };

        // Mock network error
        mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

        const failedEndpoints = await validateBackendEndpoints(
          omniWidget,
          mockBackendUrl,
          mockHeaders,
        );

        expect(failedEndpoints).toHaveLength(1);
        expect(failedEndpoints[0]).toContain("network_error_omni");
        expect(failedEndpoints[0]).toContain("Network timeout");
      });
    });
  });

  describe("integrated widgets.json and apps.json validation", () => {
    it("should handle both widgets and apps validation together", async () => {
      const validWidgets = {
        stock_widget: {
          name: "Stock Widget",
          description: "Stock analysis widget",
          endpoint: "/stock",
          params: [],
        },
      };

      const validApps = [
        {
          name: "Stock App",
          description: "Stock analysis application",
          tabs: {
            main: {
              id: "main",
              name: "Main",
              layout: [],
            },
          },
        },
      ];

      // Mock both responses as successful
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validWidgets),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validApps),
          url: `${mockSource.url}/apps.json`,
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.widgets).toEqual(
        expect.objectContaining({
          stock_widget: expect.objectContaining({
            name: "Stock Widget",
          }),
        }),
      );
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe("Stock App");
      expect(result.errorMessage).toBeNull();
      expect(result.templateErrorMessage).toBeNull();
      expect(result.totalFailed).toBe(0);
    });

    it("should handle widgets validation errors alongside template errors", async () => {
      const invalidWidgets = {
        invalid_widget: {
          name: "", // Invalid empty name
          endpoint: "/test",
        },
      };

      const invalidApps = [
        {
          name: "Invalid App",
          // Missing required tabs field
        },
      ];

      // Mock both responses with invalid data
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidWidgets),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(invalidApps),
          url: `${mockSource.url}/apps.json`,
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      const result = await validateBackend(mockSource, false);

      expect(result.widgets).toEqual({});
      expect(result.templates).toEqual([]);
      expect(result.errorMessage).not.toBeNull();
      expect(result.templateErrorMessage).not.toBeNull();
      expect(result.totalFailed).toBeGreaterThan(0);
    });

    it("should validate POST widgets with endpoint validation enabled", async () => {
      const mixedWidgets = {
        get_widget: {
          name: "GET Widget",
          description: "Standard GET widget",
          type: "table",
          endpoint: "/get-data",
          gridData: { w: 20, h: 9 },
          data: {
            table: {
              columnsDefs: [
                { field: "test", headerName: "Test", cellDataType: "text" },
              ],
            },
          },
          params: [],
        },
        omni_widget: {
          name: "AI Omni Widget",
          description: "AI-powered omni widget",
          type: "omni",
          endpoint: "/ai-query",
          gridData: { w: 20, h: 9 },
          data: {
            table: {
              columnsDefs: [
                { field: "response", headerName: "Response", cellDataType: "text" },
              ],
            },
          },
          params: [
            {
              type: "text",
              paramName: "query_type",
              value: "general",
              label: "Query Type",
              show: true,
            },
          ],
        },
      };

      const validApps = [
        {
          name: "Mixed Widget App",
          description: "App with GET and POST widgets",
          tabs: {
            main: {
              id: "main",
              name: "Main",
              layout: [],
            },
          },
        },
      ];

      // Mock responses: widgets.json, GET endpoint, POST endpoint, apps.json, agents.json
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mixedWidgets),
          headers: new Headers(),
        })
        // GET widget endpoint validation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
          headers: new Headers(),
        })
        // Omni widget POST endpoint validation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ content: "AI response", data_format: "text" }),
          headers: new Headers(),
        })
        // apps.json
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(validApps),
          url: `${mockSource.url}/apps.json`,
          headers: new Headers(),
        })
        // Mock agents.json response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });

      // Enable endpoint validation
      const result = await validateBackend(mockSource, true);

      expect(result.widgets).toEqual(
        expect.objectContaining({
          get_widget: expect.objectContaining({
            name: "GET Widget",
          }),
          omni_widget: expect.objectContaining({
            name: "AI Omni Widget",
          }),
        }),
      );
      expect(result.templates).toHaveLength(1);
      expect(result.errorMessage).toBeNull();
      expect(result.templateErrorMessage).toBeNull();
      expect(result.totalFailed).toBe(0);

      // Verify correct HTTP methods were used
      expect(mockFetch).toHaveBeenCalledTimes(5);

      // Check GET request
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/get-data"),
        expect.objectContaining({ method: "GET" }),
      );

      // Check POST request for omni widget
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("/ai-query"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test validation query"),
        }),
      );

      // Endpoint validation fetches share validateBackend's timeout signal
      expect(mockFetch.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
      expect(mockFetch.mock.calls[2][1].signal).toBeInstanceOf(AbortSignal);
    });
  });
});
