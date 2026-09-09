import { describe, expect, it } from "vitest";
import {
  findUnresolvedMentions,
  getUnresolvedMentionLabel,
  UNRESOLVED_MENTION_FALLBACK_LABEL,
} from "~/components/AI/utils/unresolvedMentions";

describe("getUnresolvedMentionLabel", () => {
  it("uses the inner tab slug, which round-trips from the tab's name", () => {
    expect(
      getUnresolvedMentionLabel(
        "@[id:tab_id=bab7d6bf-5b46-4685-9176-19c2d758c15e&inner_tab=short-term-energy-outlook]",
      ),
    ).toBe("@Short Term Energy Outlook");
  });

  it("does not invent a name out of a widget id", () => {
    // `portfolio_industries_custom_obb` is an API id, not the widget's title
    // ("Portfolio Exposure by Industry"), so beautifying it would mislead.
    for (const id of [
      "widget_id=portfolio_industries_custom_obb&uuid=abc-123",
      "eia_steo_table",
      "uuid=abc-123",
    ]) {
      expect(getUnresolvedMentionLabel(`@[id:${id}]`)).toBe(
        UNRESOLVED_MENTION_FALLBACK_LABEL,
      );
    }
  });

  it("falls back when the tab slug carries no human-readable name", () => {
    for (const innerTab of ["bab7d6bf-5b46-4685-9176-19c2d758c15e", "1234", ""]) {
      expect(getUnresolvedMentionLabel(`@[id:tab_id=x&inner_tab=${innerTab}]`)).toBe(
        UNRESOLVED_MENTION_FALLBACK_LABEL,
      );
    }
  });

  it("does not treat a key ending in inner_tab as the tab slug", () => {
    expect(getUnresolvedMentionLabel("@[id:widget_id=x&not_inner_tab=oil-prices]")).toBe(
      UNRESOLVED_MENTION_FALLBACK_LABEL,
    );
  });
});

describe("findUnresolvedMentions", () => {
  it("maps every leftover token in the content to its label", () => {
    const result = findUnresolvedMentions(
      "USE @[id:tab_id=x&inner_tab=steo-chart] and @[id:widget_id=oil_prices&uuid=y] to extract",
    );

    expect(Array.from(result.entries())).toEqual([
      ["@[id:tab_id=x&inner_tab=steo-chart]", "@Steo Chart"],
      ["@[id:widget_id=oil_prices&uuid=y]", UNRESOLVED_MENTION_FALLBACK_LABEL],
    ]);
  });

  it("ignores resolved mentions and unrelated bracket text", () => {
    expect(findUnresolvedMentions("hi @Foo see [a link](x) and @[notanid]").size).toBe(0);
  });
});
