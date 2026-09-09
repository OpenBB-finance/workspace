import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  adjustBrightness,
  createColorVariants,
  applyBrandColors,
  applyFontFamily,
  applyWhiteLabelMeta,
  getRelativeLuminance,
  getContrastTextColor,
} from "~/utils/colorUtils";

describe("hexToRgb", () => {
  describe("valid 6-digit hex colors", () => {
    it("should convert hex with # prefix", () => {
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("should convert hex without # prefix", () => {
      expect(hexToRgb("000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("should handle uppercase hex values", () => {
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("ABCDEF")).toEqual({ r: 171, g: 205, b: 239 });
    });

    it("should handle mixed case hex values", () => {
      expect(hexToRgb("#FfFfFf")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("aAbBcC")).toEqual({ r: 170, g: 187, b: 204 });
    });

    it("should convert common brand colors correctly", () => {
      expect(hexToRgb("#1a73e8")).toEqual({ r: 26, g: 115, b: 232 });
      expect(hexToRgb("#34a853")).toEqual({ r: 52, g: 168, b: 83 });
      expect(hexToRgb("#fbbc05")).toEqual({ r: 251, g: 188, b: 5 });
    });
  });

  describe("3-digit hex colors (shorthand)", () => {
    it("should return null for 3-digit hex (not supported by current implementation)", () => {
      // The current regex only matches 6-digit hex
      expect(hexToRgb("#fff")).toBe(null);
      expect(hexToRgb("#f00")).toBe(null);
      expect(hexToRgb("abc")).toBe(null);
    });
  });

  describe("invalid inputs", () => {
    it("should return null for invalid hex strings", () => {
      expect(hexToRgb("")).toBe(null);
      expect(hexToRgb("#")).toBe(null);
      expect(hexToRgb("##ffffff")).toBe(null);
      expect(hexToRgb("#gggggg")).toBe(null);
      expect(hexToRgb("#12345")).toBe(null);
      expect(hexToRgb("#1234567")).toBe(null);
    });

    it("should return null for non-hex characters", () => {
      expect(hexToRgb("#ghijkl")).toBe(null);
      expect(hexToRgb("zzzzzz")).toBe(null);
      expect(hexToRgb("#12345g")).toBe(null);
    });

    it("should return null for rgb/rgba format strings", () => {
      expect(hexToRgb("rgb(255, 0, 0)")).toBe(null);
      expect(hexToRgb("rgba(255, 0, 0, 1)")).toBe(null);
    });

    it("should return null for color names", () => {
      expect(hexToRgb("red")).toBe(null);
      expect(hexToRgb("blue")).toBe(null);
      expect(hexToRgb("transparent")).toBe(null);
    });

    it("should return null for special values", () => {
      expect(hexToRgb("inherit")).toBe(null);
      expect(hexToRgb("initial")).toBe(null);
      expect(hexToRgb("currentColor")).toBe(null);
    });
  });

  describe("edge cases", () => {
    it("should handle boundary RGB values", () => {
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("should correctly parse mid-range values", () => {
      expect(hexToRgb("#808080")).toEqual({ r: 128, g: 128, b: 128 });
      expect(hexToRgb("#7f7f7f")).toEqual({ r: 127, g: 127, b: 127 });
    });
  });
});

describe("rgbToHex", () => {
  describe("valid RGB values", () => {
    it("should convert primary colors", () => {
      expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
      expect(rgbToHex(0, 255, 0)).toBe("#00ff00");
      expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
    });

    it("should convert black and white", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("should convert gray values", () => {
      expect(rgbToHex(128, 128, 128)).toBe("#808080");
      expect(rgbToHex(64, 64, 64)).toBe("#404040");
      expect(rgbToHex(192, 192, 192)).toBe("#c0c0c0");
    });

    it("should convert mixed colors", () => {
      expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
      expect(rgbToHex(100, 149, 237)).toBe("#6495ed");
      expect(rgbToHex(255, 165, 0)).toBe("#ffa500");
    });
  });

  describe("boundary values", () => {
    it("should handle minimum values (0)", () => {
      expect(rgbToHex(0, 0, 0)).toBe("#000000");
      expect(rgbToHex(0, 255, 255)).toBe("#00ffff");
      expect(rgbToHex(255, 0, 255)).toBe("#ff00ff");
    });

    it("should handle maximum values (255)", () => {
      expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
      expect(rgbToHex(255, 255, 0)).toBe("#ffff00");
    });

    it("should pad single digit hex values with leading zeros", () => {
      expect(rgbToHex(1, 2, 3)).toBe("#010203");
      expect(rgbToHex(15, 15, 15)).toBe("#0f0f0f");
    });
  });

  describe("edge cases with out-of-range values", () => {
    it("should produce unexpected results for negative values (no clamping)", () => {
      // Note: the function doesn't validate/clamp inputs
      const result = rgbToHex(-1, 0, 0);
      expect(typeof result).toBe("string");
    });

    it("should produce unexpected results for values > 255 (no clamping)", () => {
      // Note: the function doesn't validate/clamp inputs
      const result = rgbToHex(256, 0, 0);
      expect(typeof result).toBe("string");
    });
  });

  describe("roundtrip conversion", () => {
    it("should roundtrip correctly with hexToRgb", () => {
      const testColors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 128, g: 128, b: 128 },
        { r: 26, g: 115, b: 232 },
      ];

      for (const color of testColors) {
        const hex = rgbToHex(color.r, color.g, color.b);
        const rgb = hexToRgb(hex);
        expect(rgb).toEqual(color);
      }
    });
  });
});

describe("adjustBrightness", () => {
  describe("lightening colors (positive percentage)", () => {
    it("should lighten black towards white", () => {
      expect(adjustBrightness("#000000", 50)).toBe("#808080");
      expect(adjustBrightness("#000000", 100)).toBe("#ffffff");
    });

    it("should lighten colors proportionally", () => {
      const result = adjustBrightness("#808080", 50);
      // 128 + (255 - 128) * 0.5 = 128 + 63.5 = 191.5 -> 192
      expect(hexToRgb(result)).toEqual({ r: 192, g: 192, b: 192 });
    });

    it("should not exceed white (255) when lightening", () => {
      const result = adjustBrightness("#ffffff", 50);
      expect(hexToRgb(result)).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("should lighten primary colors correctly", () => {
      const lighterRed = adjustBrightness("#ff0000", 30);
      const rgb = hexToRgb(lighterRed);
      expect(rgb?.r).toBe(255);
      expect(rgb?.g).toBeGreaterThan(0);
      expect(rgb?.b).toBeGreaterThan(0);
    });
  });

  describe("darkening colors (negative percentage)", () => {
    it("should darken white towards black", () => {
      expect(adjustBrightness("#ffffff", -50)).toBe("#808080");
      expect(adjustBrightness("#ffffff", -100)).toBe("#000000");
    });

    it("should darken colors proportionally", () => {
      const result = adjustBrightness("#808080", -50);
      // 128 * (1 - 0.5) = 64
      expect(hexToRgb(result)).toEqual({ r: 64, g: 64, b: 64 });
    });

    it("should not go below black (0) when darkening", () => {
      const result = adjustBrightness("#000000", -50);
      expect(hexToRgb(result)).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("should darken primary colors correctly", () => {
      const darkerRed = adjustBrightness("#ff0000", -30);
      const rgb = hexToRgb(darkerRed);
      expect(rgb?.r).toBe(179);
      expect(rgb?.g).toBe(0);
      expect(rgb?.b).toBe(0);
    });
  });

  describe("zero percentage", () => {
    it("should return the same color with 0% adjustment", () => {
      expect(adjustBrightness("#ff0000", 0)).toBe("#ff0000");
      expect(adjustBrightness("#00ff00", 0)).toBe("#00ff00");
      expect(adjustBrightness("#808080", 0)).toBe("#808080");
    });
  });

  describe("invalid inputs", () => {
    it("should return original hex for invalid hex input", () => {
      expect(adjustBrightness("invalid", 50)).toBe("invalid");
      expect(adjustBrightness("", 50)).toBe("");
      expect(adjustBrightness("#xyz", 50)).toBe("#xyz");
    });

    it("should handle hex without # prefix", () => {
      const result = adjustBrightness("ff0000", 30);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe("extreme percentages", () => {
    it("should handle 100% lightening", () => {
      expect(adjustBrightness("#000000", 100)).toBe("#ffffff");
      expect(adjustBrightness("#808080", 100)).toBe("#ffffff");
    });

    it("should handle -100% darkening", () => {
      expect(adjustBrightness("#ffffff", -100)).toBe("#000000");
      expect(adjustBrightness("#808080", -100)).toBe("#000000");
    });
  });

  describe("color clamping", () => {
    it("should clamp values between 0 and 255", () => {
      // Even with extreme values, result should be valid
      const lightened = adjustBrightness("#ffffff", 200);
      const rgb = hexToRgb(lightened);
      expect(rgb?.r).toBeLessThanOrEqual(255);
      expect(rgb?.g).toBeLessThanOrEqual(255);
      expect(rgb?.b).toBeLessThanOrEqual(255);

      const darkened = adjustBrightness("#000000", -200);
      const rgb2 = hexToRgb(darkened);
      expect(rgb2?.r).toBeGreaterThanOrEqual(0);
      expect(rgb2?.g).toBeGreaterThanOrEqual(0);
      expect(rgb2?.b).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("createColorVariants", () => {
  describe("variant generation", () => {
    it("should return an object with main, lighter, and darker variants", () => {
      const variants = createColorVariants("#ff0000");
      expect(variants).toHaveProperty("main");
      expect(variants).toHaveProperty("lighter");
      expect(variants).toHaveProperty("darker");
    });

    it("should keep main color unchanged", () => {
      const variants = createColorVariants("#ff0000");
      expect(variants.main).toBe("#ff0000");
    });

    it("should create lighter variant with 30% brightness increase", () => {
      const variants = createColorVariants("#808080");
      const lighterRgb = hexToRgb(variants.lighter);
      // 128 + (255 - 128) * 0.3 = 128 + 38.1 = 166
      expect(lighterRgb?.r).toBe(166);
      expect(lighterRgb?.g).toBe(166);
      expect(lighterRgb?.b).toBe(166);
    });

    it("should create darker variant with 30% brightness decrease", () => {
      const variants = createColorVariants("#808080");
      const darkerRgb = hexToRgb(variants.darker);
      // 128 * 0.7 = 89.6 -> 90
      expect(darkerRgb?.r).toBe(90);
      expect(darkerRgb?.g).toBe(90);
      expect(darkerRgb?.b).toBe(90);
    });
  });

  describe("common use cases", () => {
    it("should generate variants for brand colors", () => {
      const variants = createColorVariants("#1a73e8");
      expect(variants.main).toBe("#1a73e8");
      expect(variants.lighter).not.toBe(variants.main);
      expect(variants.darker).not.toBe(variants.main);

      const lighterRgb = hexToRgb(variants.lighter);
      const mainRgb = hexToRgb(variants.main);
      const darkerRgb = hexToRgb(variants.darker);

      expect(lighterRgb!.r).toBeGreaterThan(mainRgb!.r);
      expect(darkerRgb!.r).toBeLessThan(mainRgb!.r);
    });

    it("should handle black color", () => {
      const variants = createColorVariants("#000000");
      expect(variants.main).toBe("#000000");
      expect(hexToRgb(variants.lighter)).toEqual({ r: 77, g: 77, b: 77 });
      expect(hexToRgb(variants.darker)).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("should handle white color", () => {
      const variants = createColorVariants("#ffffff");
      expect(variants.main).toBe("#ffffff");
      expect(hexToRgb(variants.lighter)).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb(variants.darker)).toEqual({ r: 179, g: 179, b: 179 });
    });
  });

  describe("invalid inputs", () => {
    it("should handle invalid hex gracefully", () => {
      const variants = createColorVariants("invalid");
      expect(variants.main).toBe("invalid");
      expect(variants.lighter).toBe("invalid");
      expect(variants.darker).toBe("invalid");
    });
  });
});

describe("applyBrandColors", () => {
  let mockSetProperty: ReturnType<typeof vi.fn>;
  let originalDocumentElement: HTMLElement;

  beforeEach(() => {
    mockSetProperty = vi.fn();
    originalDocumentElement = document.documentElement;

    Object.defineProperty(document, "documentElement", {
      value: {
        style: {
          setProperty: mockSetProperty,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "documentElement", {
      value: originalDocumentElement,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("should set CSS custom properties for brand colors", () => {
    applyBrandColors("#1a73e8");

    expect(mockSetProperty).toHaveBeenCalledTimes(7);
    expect(mockSetProperty).toHaveBeenCalledWith("--color-main-100", "#1a73e8");
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--color-main-50",
      expect.stringMatching(/^#[0-9a-f]{6}$/i)
    );
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--color-main-200",
      expect.stringMatching(/^#[0-9a-f]{6}$/i)
    );
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--color-main-contrast",
      "var(--color-light-100)"
    );
    expect(mockSetProperty).toHaveBeenCalledWith("--brand-main", "#1a73e8");
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--brand-lighter",
      expect.stringMatching(/^#[0-9a-f]{6}$/i)
    );
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--brand-darker",
      expect.stringMatching(/^#[0-9a-f]{6}$/i)
    );
  });

  it("should apply correct variant colors", () => {
    applyBrandColors("#808080");

    expect(mockSetProperty).toHaveBeenCalledTimes(7);
    expect(mockSetProperty).toHaveBeenCalledWith("--color-main-100", "#808080");
    expect(mockSetProperty).toHaveBeenCalledWith("--color-main-50", "#a6a6a6");
    expect(mockSetProperty).toHaveBeenCalledWith("--color-main-200", "#5a5a5a");
    expect(mockSetProperty).toHaveBeenCalledWith("--color-main-contrast", "var(--color-light-100)");
    expect(mockSetProperty).toHaveBeenCalledWith("--brand-main", "#808080");
    expect(mockSetProperty).toHaveBeenCalledWith("--brand-lighter", "#a6a6a6");
    expect(mockSetProperty).toHaveBeenCalledWith("--brand-darker", "#5a5a5a");
  });
});

describe("getRelativeLuminance", () => {
  it("should calculate luminance correctly for various colors", () => {
    // Black
    expect(getRelativeLuminance("#000000")).toBeCloseTo(0, 4);
    // White
    expect(getRelativeLuminance("#ffffff")).toBeCloseTo(1, 4);
    // Pure Red
    expect(getRelativeLuminance("#ff0000")).toBeCloseTo(0.2126, 4);
    // Pure Green
    expect(getRelativeLuminance("#00ff00")).toBeCloseTo(0.7152, 4);
    // Pure Blue
    expect(getRelativeLuminance("#0000ff")).toBeCloseTo(0.0722, 4);
  });

  it("should handle invalid hex by returning 0", () => {
    expect(getRelativeLuminance("invalid")).toBe(0);
  });
});

describe("getContrastTextColor", () => {
  it("should return var(--color-light-700) for light backgrounds", () => {
    // Pure white
    expect(getContrastTextColor("#ffffff")).toBe("var(--color-light-700)");
    // Light yellow
    expect(getContrastTextColor("#ffeb3b")).toBe("var(--color-light-700)");
    // Very light grey
    expect(getContrastTextColor("#f5f5f5")).toBe("var(--color-light-700)");
  });

  it("should return var(--color-light-100) for dark backgrounds", () => {
    // Pure black
    expect(getContrastTextColor("#000000")).toBe("var(--color-light-100)");
    // Dark blue
    expect(getContrastTextColor("#1a73e8")).toBe("var(--color-light-100)");
    // Dark grey
    expect(getContrastTextColor("#333333")).toBe("var(--color-light-100)");
  });
});

describe("applyFontFamily", () => {
  let mockSetProperty: ReturnType<typeof vi.fn>;
  let originalDocumentElement: HTMLElement;

  beforeEach(() => {
    mockSetProperty = vi.fn();
    originalDocumentElement = document.documentElement;

    Object.defineProperty(document, "documentElement", {
      value: {
        style: {
          setProperty: mockSetProperty,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "documentElement", {
      value: originalDocumentElement,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("should set --font-family CSS custom property", () => {
    applyFontFamily("Inter, sans-serif");

    expect(mockSetProperty).toHaveBeenCalledTimes(1);
    expect(mockSetProperty).toHaveBeenCalledWith(
      "--font-family",
      "Inter, sans-serif"
    );
  });

  it("should handle complex font stacks", () => {
    const fontStack =
      "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    applyFontFamily(fontStack);

    expect(mockSetProperty).toHaveBeenCalledWith("--font-family", fontStack);
  });

  it("should handle empty string", () => {
    applyFontFamily("");

    expect(mockSetProperty).toHaveBeenCalledWith("--font-family", "");
  });
});

describe("applyWhiteLabelMeta", () => {
  let ogTitle: HTMLMetaElement;
  let twitterTitle: HTMLMetaElement;
  let ogDescription: HTMLMetaElement;
  let twitterDescription: HTMLMetaElement;
  let keywordsMeta: HTMLMetaElement;
  let iconLink: HTMLLinkElement;
  let appleTouchLink: HTMLLinkElement;

  beforeEach(() => {
    // Set up DOM elements that applyWhiteLabelMeta queries
    ogTitle = document.createElement("meta");
    ogTitle.setAttribute("property", "og:title");
    ogTitle.setAttribute("content", "");
    document.head.appendChild(ogTitle);

    twitterTitle = document.createElement("meta");
    twitterTitle.setAttribute("property", "twitter:title");
    twitterTitle.setAttribute("content", "");
    document.head.appendChild(twitterTitle);

    ogDescription = document.createElement("meta");
    ogDescription.setAttribute("property", "og:description");
    ogDescription.setAttribute("content", "");
    document.head.appendChild(ogDescription);

    twitterDescription = document.createElement("meta");
    twitterDescription.setAttribute("property", "twitter:description");
    twitterDescription.setAttribute("content", "");
    document.head.appendChild(twitterDescription);

    keywordsMeta = document.createElement("meta");
    keywordsMeta.setAttribute("name", "keywords");
    keywordsMeta.setAttribute("content", "");
    document.head.appendChild(keywordsMeta);

    iconLink = document.createElement("link");
    iconLink.setAttribute("rel", "icon");
    iconLink.setAttribute("href", "/default-favicon.ico");
    document.head.appendChild(iconLink);

    appleTouchLink = document.createElement("link");
    appleTouchLink.setAttribute("rel", "apple-touch-icon");
    appleTouchLink.setAttribute("href", "/default-apple.png");
    document.head.appendChild(appleTouchLink);
  });

  afterEach(() => {
    ogTitle.remove();
    twitterTitle.remove();
    ogDescription.remove();
    twitterDescription.remove();
    keywordsMeta.remove();
    iconLink.remove();
    appleTouchLink.remove();
    document.title = "";
  });

  it("should set document title and og/twitter title when name is provided", () => {
    applyWhiteLabelMeta({ name: "Acme Corp" });

    expect(document.title).toBe("Acme Corp");
    expect(ogTitle.getAttribute("content")).toBe("Acme Corp");
    expect(twitterTitle.getAttribute("content")).toBe("Acme Corp");
  });

  it("should set og and twitter description when description is provided", () => {
    applyWhiteLabelMeta({ description: "Best platform ever" });

    expect(ogDescription.getAttribute("content")).toBe("Best platform ever");
    expect(twitterDescription.getAttribute("content")).toBe("Best platform ever");
  });

  it("should set keywords meta when keywords is provided", () => {
    applyWhiteLabelMeta({ keywords: "finance, data, analytics" });

    expect(keywordsMeta.getAttribute("content")).toBe("finance, data, analytics");
  });

  it("should set favicon and apple-touch-icon when favicon is provided", () => {
    applyWhiteLabelMeta({ favicon: "/custom-favicon.png" });

    expect(iconLink.getAttribute("href")).toBe("/custom-favicon.png");
    expect(appleTouchLink.getAttribute("href")).toBe("/custom-favicon.png");
  });

  it("should apply all fields when all are provided", () => {
    applyWhiteLabelMeta({
      name: "Acme Corp",
      description: "Financial analytics",
      keywords: "finance, data",
      favicon: "/acme.ico",
    });

    expect(document.title).toBe("Acme Corp");
    expect(ogTitle.getAttribute("content")).toBe("Acme Corp");
    expect(ogDescription.getAttribute("content")).toBe("Financial analytics");
    expect(keywordsMeta.getAttribute("content")).toBe("finance, data");
    expect(iconLink.getAttribute("href")).toBe("/acme.ico");
  });

  it("should not modify anything when all fields are empty", () => {
    document.title = "Original";

    applyWhiteLabelMeta({});

    expect(document.title).toBe("Original");
    expect(ogTitle.getAttribute("content")).toBe("");
    expect(iconLink.getAttribute("href")).toBe("/default-favicon.ico");
  });

  it("should not modify title when name is an empty string", () => {
    document.title = "Original";

    applyWhiteLabelMeta({ name: "" });

    expect(document.title).toBe("Original");
  });
});

