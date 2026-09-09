import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLockedConfig } from "~/lib/runtimeConfigSchema";

/**
 * Tripwire for config drift between terminalpro and the Lite image.
 *
 * Every profile in config-profiles/ is strict: each field in
 * RuntimeConfigSchema must be locked (given a value) or listed in
 * "_unlocked". If you just added a schema field and this test failed naming
 * it, make the Lite call: lock it in config-profiles/lite.locked.json, or add
 * its path to that file's "_unlocked" list.
 */

const PROFILES_DIR = path.resolve(process.cwd(), "config-profiles");

const profileFiles = readdirSync(PROFILES_DIR).filter((f) =>
  f.endsWith(".locked.json"),
);

describe("config-profiles", () => {
  it("includes the lite profile", () => {
    expect(profileFiles).toContain("lite.locked.json");
  });

  it.each(
    profileFiles,
  )("%s is strict and fully triages RuntimeConfigSchema", (file) => {
    const raw = JSON.parse(readFileSync(path.join(PROFILES_DIR, file), "utf-8")) as {
      _strict?: unknown;
    };

    // A non-strict profile would silently fail open on new schema fields,
    // which defeats the whole point of keeping it in-repo.
    expect(raw._strict).toBe(true);
    expect(() => buildLockedConfig(raw)).not.toThrow();
  });

  it("lite profile locks the Lite identity and keeps registration off", () => {
    const raw = JSON.parse(
      readFileSync(path.join(PROFILES_DIR, "lite.locked.json"), "utf-8"),
    );
    const locked = buildLockedConfig(raw);

    expect(locked.ui?.isLite).toBe(true);
    expect(locked.authentication?.allowRegistration).toBe(false);
  });
});
