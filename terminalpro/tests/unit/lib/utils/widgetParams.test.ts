import { describe, expect, it } from "vitest";
import type { Ticker, WidgetT } from "~/components/types";

import {
  cleanURL,
  createParamDefs,
  createURLString,
  createWidgetEndpoint,
  createWidgetInitParams,
  currentDateModifier,
} from "~/lib/utils/widgetParams";

describe("Widget Params Utility Functions", () => {
  describe("createParamDefs", () => {
    it("should create param definitions from widget params", () => {
      const widget = {
        params: [
          { paramName: "symbol", type: "text", value: "AAPL" },
          { paramName: "period", type: "text", value: "annual" },
        ],
      };
      // @ts-expect-error - ignored for now
      const result = createParamDefs(widget);
      expect(result).toHaveLength(2);
      expect(result[0].paramName).toBe("symbol");
      expect(result[1].paramName).toBe("period");
    });

    it("should handle endpoint type params with backendURL", () => {
      const widget = {
        params: [
          {
            paramName: "endpoint_param",
            type: "endpoint",
            optionsEndpoint: "/api/options",
          },
        ],
      };
      // @ts-expect-error - ignored for now
      const result = createParamDefs(widget, "https://example.com");
      // @ts-expect-error - ignored for now
      expect(result[0].optionsEndpoint).toBe("https://example.com/api/options");
      // @ts-expect-error - ignored for now
      expect(result[0].groupById).toBe("options");
    });

    it("should handle form type params", () => {
      const widget = {
        params: [
          {
            type: "form",
            endpoint: "/submit",
            inputParams: [{ paramName: "field1", type: "text" }],
          },
        ],
      };
      // @ts-expect-error - ignored for now
      const result = createParamDefs(widget, "https://example.com");
      // @ts-expect-error - ignored for now
      expect(result[0].endpoint).toBe("https://example.com/submit");
    });

    it("should return empty array for non-array params (preprocess coerces to [])", () => {
      const widget = {
        params: "invalid_params",
      };
      const result = createParamDefs(widget as any);
      // ParamsSchema preprocess converts non-arrays to []
      expect(result).toEqual([]);
    });

    it("should handle empty params array", () => {
      const widget = { params: [] };
      const result = createParamDefs(widget);
      expect(result).toEqual([]);
    });

    it("should handle widget without params", () => {
      const widget = {};
      const result = createParamDefs(widget as any);
      expect(result).toEqual([]);
    });
  });

  describe("createWidgetEndpoint", () => {
    it("should create endpoint from string URL", () => {
      const result = createWidgetEndpoint("https://api.example.com/data");
      expect(result.url).toBe("https://api.example.com/data");
      expect(result.method).toBe("GET");
      expect(result.headers).toEqual({});
      expect(result.query).toEqual({});
    });

    it("should create endpoint from URL object", () => {
      const urlObj = { url: "https://api.example.com/data", method: "POST" };
      const result = createWidgetEndpoint(urlObj as any);
      expect(result.url).toBe("https://api.example.com/data");
      expect(result.method).toBe("GET");
    });

    it("should add headers from endpointHeaders", () => {
      const result = createWidgetEndpoint("https://api.example.com/data", [
        { key: "Authorization", value: "Bearer token", location: "headers" },
        { key: "Content-Type", value: "application/json", location: "headers" },
      ]);
      expect(result.headers).toEqual({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      });
    });

    it("should add query params from endpointHeaders", () => {
      const result = createWidgetEndpoint("https://api.example.com/data", [
        { key: "page", value: "1", location: "query" },
        { key: "limit", value: "10", location: "query" },
      ]);
      expect(result.query).toEqual({
        page: "1",
        limit: "10",
      });
    });

    it("should default location to headers", () => {
      const result = createWidgetEndpoint("https://api.example.com/data", [
        { key: "X-Custom", value: "value" } as any,
      ]);
      expect(result.headers?.["X-Custom"]).toBe("value");
    });

    it("should clean duplicate slashes in URL", () => {
      const result = createWidgetEndpoint("https://api.example.com//data//path");
      expect(result.url).toBe("https://api.example.com/data/path");
    });
  });

  describe("createWidgetInitParams", () => {
    it("should create initial params from widget definition", () => {
      const widget = {
        params: [
          { paramName: "symbol", type: "text", value: "AAPL" },
          { paramName: "period", type: "text", value: "annual" },
        ],
      } as unknown as WidgetT;
      const result = createWidgetInitParams(widget);
      expect(result.symbol).toBe("AAPL");
      expect(result.period).toBe("annual");
    });

    it("should use storage params over default values", () => {
      const widget = {
        params: [{ paramName: "symbol", type: "text", value: "AAPL" }],
        storage: {
          params: { symbol: "MSFT" },
        },
      } as unknown as WidgetT;
      const result = createWidgetInitParams(widget);
      expect(result.symbol).toBe("MSFT");
    });

    it("should use mainTicker symbol for ticker type params", () => {
      const widget = {
        params: [{ paramName: "ticker", type: "ticker", value: null }],
      } as unknown as WidgetT;
      const mainTicker = { symbol: "GOOGL" } as Ticker;
      const result = createWidgetInitParams(widget, mainTicker);
      expect(result.ticker).toBe("GOOGL");
    });

    it("should handle params without values (newParamDef defaults to null)", () => {
      const widget = {
        params: [{ paramName: "empty", type: "text" }],
      } as unknown as WidgetT;
      const result = createWidgetInitParams(widget);
      // newParamDef sets value to null when undefined, so null is included in result
      expect(result).toEqual({ empty: null });
    });
  });

  describe("createWidgetEndpoint edge cases", () => {
    it("should handle empty endpointHeaders array", () => {
      const result = createWidgetEndpoint("https://api.example.com", []);
      expect(result.headers).toEqual({});
      expect(result.query).toEqual({});
    });

    it("should handle URL with existing query string", () => {
      const result = createWidgetEndpoint("https://api.example.com?existing=param");
      expect(result.url).toBe("https://api.example.com?existing=param");
    });
  });

  describe("cleanURL", () => {
    it("should remove duplicate slashes", () => {
      expect(cleanURL("https://example.com//api//users")).toBe(
        "https://example.com/api/users",
      );
    });

    it("should preserve protocol slashes", () => {
      expect(cleanURL("https://example.com/path")).toBe("https://example.com/path");
    });

    it("should handle undefined/null", () => {
      expect(cleanURL(undefined as any)).toBe(undefined);
      expect(cleanURL(null as any)).toBe(undefined);
    });
  });

  describe("createURLString", () => {
    it("should combine base URL and endpoint", () => {
      expect(createURLString("widget.json", "https://example.com/openbb")).toBe(
        "https://example.com/openbb/widget.json",
      );
    });

    it("should return data URIs unchanged", () => {
      const dataUri = "data:application/json;base64,eyJ0ZXN0IjogdHJ1ZX0=";
      expect(createURLString(dataUri)).toBe(dataUri);
    });

    it("should return full URLs unchanged", () => {
      expect(createURLString("https://other.com/api")).toBe("https://other.com/api");
    });

    it("should handle URL objects as base", () => {
      expect(createURLString("api", new URL("https://example.com"))).toBe(
        "https://example.com/api",
      );
    });
  });

  describe("currentDateModifier", () => {
    it("should return regular dates unchanged", () => {
      expect(currentDateModifier("2024-01-15")).toBe("2024-01-15");
    });

    it("should handle date modifiers", () => {
      const result = currentDateModifier("$currentDate-1d");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
