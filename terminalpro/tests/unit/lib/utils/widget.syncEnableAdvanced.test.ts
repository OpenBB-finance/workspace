import { describe, expect, it } from "vitest";
import { syncEnableAdvancedFromDefinition } from "~/lib/utils/widget";

const placedWidget = (snapshot: boolean | undefined, storage: boolean | undefined) =>
  ({
    id: "w1",
    widgetId: "custom_backend_table",
    external: true,
    data: { table: { enableAdvanced: snapshot } },
    storage: { enableAdvanced: storage },
  }) as any;

describe("syncEnableAdvancedFromDefinition", () => {
  it("does nothing when the definition is silent", () => {
    expect(syncEnableAdvancedFromDefinition(placedWidget(true, true), undefined)).toBe(
      null,
    );
  });

  it("does nothing when the definition matches the placed snapshot", () => {
    expect(syncEnableAdvancedFromDefinition(placedWidget(true, true), true)).toBe(null);
  });

  it("preserves a user's manual override when the definition is unchanged", () => {
    // definition still true, user unchecked Advanced in table settings
    expect(syncEnableAdvancedFromDefinition(placedWidget(true, false), true)).toBe(
      null,
    );
  });

  it("propagates a definition change to false onto snapshot and storage", () => {
    const updated = syncEnableAdvancedFromDefinition(placedWidget(true, true), false);
    expect(updated?.data?.table?.enableAdvanced).toBe(false);
    expect(updated?.storage?.enableAdvanced).toBe(false);
  });

  it("propagates a definition change to true onto snapshot and storage", () => {
    const updated = syncEnableAdvancedFromDefinition(
      placedWidget(undefined, undefined),
      true,
    );
    expect(updated?.data?.table?.enableAdvanced).toBe(true);
    expect(updated?.storage?.enableAdvanced).toBe(true);
  });
});
