import { describe, expect, it } from "vitest";
import { needsAutoFitOnRestore } from "~/components/General/Table/hooks/useUpdateColumnState";

describe("needsAutoFitOnRestore", () => {
  it("auto-fits when there is no saved column sizing", () => {
    expect(needsAutoFitOnRestore(undefined, "custom_widget")).toBe(true);
    expect(needsAutoFitOnRestore([], "custom_widget")).toBe(true);
  });

  it("keeps saved column widths even for tables with few columns", () => {
    // Regression: restoring used to force sizeColumnsToFit whenever the saved
    // sizing model had fewer columns than the auto-fit threshold (6/10),
    // wiping user-autosized widths on every chart-view toggle
    const sevenColumns = Array.from({ length: 7 }, (_, i) => ({
      colId: `col${i}`,
      width: 120,
    }));
    expect(needsAutoFitOnRestore(sevenColumns, "custom_widget")).toBe(false);

    const twoColumns = sevenColumns.slice(0, 2);
    expect(needsAutoFitOnRestore(twoColumns, "custom_widget")).toBe(false);
  });

  it("always auto-fits allow-listed widgets", () => {
    const saved = [{ colId: "a", width: 100 }];
    expect(needsAutoFitOnRestore(saved, "analyst_consensus")).toBe(true);
  });
});
