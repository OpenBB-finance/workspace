import { describe, expect, it } from "vitest";
import { buildLockedConfig, RuntimeConfigSchema } from "~/lib/runtimeConfigSchema";

describe("buildLockedConfig", () => {
  it("returns an empty overlay for empty / non-object input", () => {
    expect(buildLockedConfig(undefined)).toEqual({});
    expect(buildLockedConfig(null)).toEqual({});
    expect(buildLockedConfig("nope")).toEqual({});
    expect(buildLockedConfig({})).toEqual({});
  });

  it("keeps only the fields explicitly provided", () => {
    const locked = buildLockedConfig({
      data: { allowHtmlJsExecution: false },
      copilot: { showCustomKey: false },
    });

    expect(locked).toEqual({
      data: { allowHtmlJsExecution: false },
      copilot: { showCustomKey: false },
    });
  });

  it("coerces string values through the field schema", () => {
    const locked = buildLockedConfig({
      data: { allowHtmlJsExecution: "false" },
      authentication: { identityProviders: "microsoft, okta" },
    });

    expect(locked.data?.allowHtmlJsExecution).toBe(false);
    expect(locked.authentication?.identityProviders).toEqual(["microsoft", "okta"]);
  });

  it("throws on an unknown group", () => {
    expect(() => buildLockedConfig({ bogusGroup: { foo: true } })).toThrow(
      /Unknown group "bogusGroup"/,
    );
  });

  it("throws when a known group's value is not an object of fields", () => {
    expect(() => buildLockedConfig({ data: true })).toThrow(
      /Group "data" in locked config must be an object/,
    );
    expect(() => buildLockedConfig({ ui: "dark" })).toThrow(
      /Group "ui" in locked config must be an object/,
    );
    expect(() => buildLockedConfig({ copilot: [] })).toThrow(
      /Group "copilot" in locked config must be an object/,
    );
  });

  it("throws on an unknown field within a known group", () => {
    expect(() =>
      buildLockedConfig({ data: { allowHtmlJsExecution: false, notARealField: true } }),
    ).toThrow(/Unknown field "data.notARealField"/);
  });

  it("silently ignores a top-level `_comment` key and `_`-prefixed field keys", () => {
    const locked = buildLockedConfig({
      _comment: "documentation only",
      data: { allowHtmlJsExecution: false, _note: "why" },
    });

    expect(locked).toEqual({ data: { allowHtmlJsExecution: false } });
  });

  it("throws when a provided value is invalid for its field", () => {
    expect(() => buildLockedConfig({ ui: { defaultTheme: "neon" } })).toThrow();
  });
});

describe("buildLockedConfig — strict mode", () => {
  const allGroups = Object.keys(RuntimeConfigSchema.shape);
  const wildcardAll = allGroups.map((g) => `${g}.*`);
  const wildcardAllExcept = (excluded: string) =>
    allGroups.filter((g) => g !== excluded).map((g) => `${g}.*`);

  it("accepts a strict policy where every field is triaged", () => {
    const uiFields = Object.keys(RuntimeConfigSchema.shape.ui.shape);
    const locked = buildLockedConfig({
      _strict: true,
      _unlocked: [
        ...wildcardAllExcept("ui"),
        ...uiFields.filter((f) => f !== "isLite").map((f) => `ui.${f}`),
      ],
      ui: { isLite: true },
    });

    expect(locked).toEqual({ ui: { isLite: true } });
  });

  it("accepts a strict policy that unlocks everything and locks nothing", () => {
    expect(buildLockedConfig({ _strict: true, _unlocked: wildcardAll })).toEqual({});
  });

  it("without _strict, _unlocked is ignored and triage is not enforced", () => {
    const locked = buildLockedConfig({
      _unlocked: ["ui.*"],
      ui: { isLite: true },
    });

    expect(locked).toEqual({ ui: { isLite: true } });
  });

  it("throws on an untriaged field, naming it and both resolution paths", () => {
    const run = () =>
      buildLockedConfig({
        _strict: true,
        _unlocked: wildcardAllExcept("ui"),
      });

    expect(run).toThrow(/Field "ui\.showCompanionMode" is not triaged/);
    expect(run).toThrow(/config-profiles\/lite\.locked\.json/);
    expect(run).toThrow(/"_unlocked"/);
    expect(run).toThrow(
      /github\.com\/OpenBB-finance\/lite#changing-what-lite-locks/,
    );
  });

  it("throws when a path is both locked and listed in _unlocked", () => {
    expect(() =>
      buildLockedConfig({
        _strict: true,
        _unlocked: wildcardAll,
        ui: { isLite: true },
      }),
    ).toThrow(/"ui\.isLite".*locked.*"_unlocked"/);
  });

  it("throws on an unknown path in _unlocked", () => {
    expect(() =>
      buildLockedConfig({ _strict: true, _unlocked: [...wildcardAll, "ui.notAField"] }),
    ).toThrow(/Unknown path "ui\.notAField" in "_unlocked"/);

    expect(() =>
      buildLockedConfig({ _strict: true, _unlocked: [...wildcardAll, "bogus.*"] }),
    ).toThrow(/Unknown path "bogus\.\*" in "_unlocked"/);
  });

  it("throws when _strict is present but not a boolean", () => {
    expect(() =>
      buildLockedConfig({ _strict: "true", _unlocked: wildcardAll }),
    ).toThrow(/_strict/);
  });

  it("throws when _unlocked is not an array of strings", () => {
    expect(() => buildLockedConfig({ _strict: true, _unlocked: "ui.*" })).toThrow(
      /_unlocked/,
    );
    expect(() => buildLockedConfig({ _strict: true, _unlocked: [42] })).toThrow(
      /_unlocked/,
    );
  });
});
