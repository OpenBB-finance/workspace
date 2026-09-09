export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function adjustBrightness(hex: string, percentage: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = percentage / 100;
  let { r, g, b } = rgb;

  if (factor > 0) {
    r = Math.round(r + (255 - r) * factor);
    g = Math.round(g + (255 - g) * factor);
    b = Math.round(b + (255 - b) * factor);
  } else {
    r = Math.round(r * (1 + factor));
    g = Math.round(g * (1 + factor));
    b = Math.round(b * (1 + factor));
  }

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return rgbToHex(r, g, b);
}

export function createColorVariants(baseColor: string) {
  const lighterColor = adjustBrightness(baseColor, 30);
  const darkerColor = adjustBrightness(baseColor, -30);

  return {
    main: baseColor,
    lighter: lighterColor,
    darker: darkerColor,
  };
}

/**
 * WCAG 2.1 relative luminance calculation.
 * Returns a value between 0 (darkest) and 1 (lightest).
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Returns the CSS variable for the best-contrast text color against the given
 * background. Uses design-system primitives (light-700 for dark text on light
 * backgrounds, light-100 for light text on dark backgrounds) instead of raw
 * black/white so the result stays consistent with the neutral palette.
 */
export function getContrastTextColor(bgHex: string): string {
  const luminance = getRelativeLuminance(bgHex);
  return luminance > 0.22 ? "var(--color-light-700)" : "var(--color-light-100)";
}

export function applyBrandColors(mainColor: string) {
  const colors = createColorVariants(mainColor);
  const root = document.documentElement;

  root.style.setProperty("--color-main-100", colors.main);
  root.style.setProperty("--color-main-50", colors.lighter);
  root.style.setProperty("--color-main-200", colors.darker);

  const contrastColor = getContrastTextColor(mainColor);
  root.style.setProperty("--color-main-contrast", contrastColor);

  // TODO(token-migration): remove --brand-* aliases once all consumers use --color-main-*
  root.style.setProperty("--brand-main", colors.main);
  root.style.setProperty("--brand-lighter", colors.lighter);
  root.style.setProperty("--brand-darker", colors.darker);
}

export function applyFontFamily(fontFamily: string) {
  const root = document.documentElement;
  root.style.setProperty("--font-family", fontFamily);
}

export function applyWhiteLabelMeta(whiteLabel: {
  name?: string;
  description?: string;
  keywords?: string;
  favicon?: string;
}) {
  if (whiteLabel.name) {
    document.title = whiteLabel.name;
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", whiteLabel.name);
    document
      .querySelector('meta[property="twitter:title"]')
      ?.setAttribute("content", whiteLabel.name);
  }
  if (whiteLabel.description) {
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", whiteLabel.description);
    document
      .querySelector('meta[property="twitter:description"]')
      ?.setAttribute("content", whiteLabel.description);
  }
  if (whiteLabel.keywords) {
    document
      .querySelector('meta[name="keywords"]')
      ?.setAttribute("content", whiteLabel.keywords);
  }
  if (whiteLabel.favicon) {
    document
      .querySelector('link[rel="icon"]')
      ?.setAttribute("href", whiteLabel.favicon);
    document
      .querySelector('link[rel="apple-touch-icon"]')
      ?.setAttribute("href", whiteLabel.favicon);
  }
}
