import { describe, expect, it } from "vitest";
import {
  PREVIEW_MODES,
  PREVIEW_OPTIONS,
  previewPrompts,
  previewWidgets,
} from "~/components/Apps/appPreview";

describe("preview modes", () => {
  it("offers one labelled option per preview mode", () => {
    expect(PREVIEW_OPTIONS.map((o) => o.value)).toEqual([...PREVIEW_MODES]);
    expect(PREVIEW_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});

describe("previewWidgets", () => {
  it("builds one placeholder entry per counted widget", () => {
    expect(previewWidgets(3)).toHaveLength(3);
  });

  it("labels entries as unavailable so they aren't read as real widget names", () => {
    expect(previewWidgets(1)[0].name).toMatch(/not available in preview/);
  });

  it("returns nothing for a backend with no widgets", () => {
    expect(previewWidgets(0)).toEqual([]);
  });
});

describe("previewPrompts", () => {
  it("builds one placeholder name per counted prompt", () => {
    expect(previewPrompts(2)).toEqual([
      expect.stringMatching(/not available in preview/),
      expect.stringMatching(/not available in preview/),
    ]);
  });

  it("returns nothing for an app with no prompts", () => {
    expect(previewPrompts(0)).toEqual([]);
  });
});
