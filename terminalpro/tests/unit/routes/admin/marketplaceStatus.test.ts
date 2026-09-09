import { describe, expect, it } from "vitest";
import {
  type AppStatus,
  canDisable,
  canEnable,
  canPublish,
  canReject,
  canRemove,
  canVerify,
  matchesTab,
  statusTagColor,
} from "~/routes/admin/marketplaceStatus";

const ALL_STATUSES: AppStatus[] = [
  "submitted",
  "verified",
  "development",
  "published",
  "disabled",
  "removed",
];

describe("marketplaceStatus predicates", () => {
  it("canPublish only for verified and development", () => {
    const allowed = ALL_STATUSES.filter(canPublish);
    expect(allowed).toEqual(["verified", "development"]);
  });

  it("canDisable only for published", () => {
    const allowed = ALL_STATUSES.filter(canDisable);
    expect(allowed).toEqual(["published"]);
  });

  it("canEnable only for disabled", () => {
    const allowed = ALL_STATUSES.filter(canEnable);
    expect(allowed).toEqual(["disabled"]);
  });

  it("canRemove for every status except removed", () => {
    const allowed = ALL_STATUSES.filter(canRemove);
    expect(allowed).toEqual([
      "submitted",
      "verified",
      "development",
      "published",
      "disabled",
    ]);
  });

  it("canReject only for development (not submitted)", () => {
    const allowed = ALL_STATUSES.filter(canReject);
    expect(allowed).toEqual(["development"]);
  });

  it("canVerify for every status", () => {
    expect(ALL_STATUSES.every(canVerify)).toBe(true);
  });
});

describe("matchesTab", () => {
  it("in-review merges submitted and development", () => {
    expect(ALL_STATUSES.filter((s) => matchesTab(s, "in-review"))).toEqual([
      "submitted",
      "development",
    ]);
  });

  it("published tab is published only", () => {
    expect(ALL_STATUSES.filter((s) => matchesTab(s, "published"))).toEqual([
      "published",
    ]);
  });

  it("disabled tab is disabled only", () => {
    expect(ALL_STATUSES.filter((s) => matchesTab(s, "disabled"))).toEqual(["disabled"]);
  });

  it("all tab includes every status", () => {
    expect(ALL_STATUSES.every((s) => matchesTab(s, "all"))).toBe(true);
  });
});

describe("statusTagColor", () => {
  it("maps each status to the expected Tag color", () => {
    expect(statusTagColor("published")).toBe("success");
    expect(statusTagColor("submitted")).toBe("warning");
    expect(statusTagColor("development")).toBe("warning");
    expect(statusTagColor("verified")).toBe("brand");
    expect(statusTagColor("disabled")).toBe("grey");
    expect(statusTagColor("removed")).toBe("danger");
  });
});
