/**
 * Runtime Config Schema — single source of truth for config shape and defaults.
 *
 * Imported by both the app (`runtimeConfig.ts`) and the build (`vite.config.ts`).
 * Boolean and string-array fields use z.preprocess so raw env-var strings
 * ("true"/"false", comma-separated) are coerced automatically.
 */
import { z } from "zod";

// ── Coercion helpers (private) ─────────────────────────────────────────

function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function coerceStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) {
    return v
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return undefined;
}

// ── Public coercion helpers (re-exported by runtimeConfig.ts) ──────────

export function parseBool(value: unknown, fallback: boolean): boolean {
  return coerceBool(value) ?? fallback;
}

export function parseStringArray(value: unknown): string[] {
  return coerceStringArray(value) ?? [];
}

// ── Schema field builders ──────────────────────────────────────────────

const boolField = (defaultVal: boolean) =>
  z.preprocess(coerceBool, z.boolean().default(defaultVal));

const strArrayField = (defaultVal: string[] = []) =>
  z.preprocess(coerceStringArray, z.array(z.string()).default(defaultVal));

// ── Schema ─────────────────────────────────────────────────────────────

export const RuntimeConfigSchema = z.object({
  urls: z.object({
    backend: z.string().default(""),
    ai: z.string().default(""),
    platform: z.string().default(""),
    database: z.string().default(""),
  }),
  authentication: z.object({
    allowEmailLogin: boolField(true),
    allowRegistration: boolField(true),
    allowForgotPassword: boolField(true),
    identityProviders: strArrayField([]),
    sendMicrosoftIdToken: boolField(false),
    sendOktaIdToken: boolField(false),
    sendUserEmailAsHeader: boolField(false),
  }),
  authProviders: z.object({
    googleClientId: z.string().default(""),
    azureClientId: z.string().default(""),
    azureTenantId: z.string().default(""),
    oktaClientId: z.string().default(""),
    oktaDomain: z.string().default(""),
  }),
  copilot: z.object({
    enabled: boolField(false),
    openbbCopilot: boolField(true),
    documentationLinks: boolField(true),
    webSearch: boolField(true),
    secFilings: boolField(false),
    jinaAi: boolField(true),
    aiEnhancements: boolField(true),
    saveSkillFromChat: boolField(false),
    showCustomKey: boolField(true),
  }),
  ui: z.object({
    showCompanionMode: boolField(false),
    showMinimizeWidget: boolField(true),
    showChartGeneration: boolField(true),
    showFeedbackButton: boolField(false),
    showInviteButton: boolField(false),
    showDemoRequestButton: boolField(false),
    showEnterpriseTags: boolField(true),
    showExternalDocLinks: boolField(true),
    showHelpDocumentation: boolField(true),
    showChangelog: boolField(true),
    showOnboardingQuestions: boolField(true),
    showTos: boolField(true),
    showCopilotSwitcher: boolField(true),
    showRemoveFromOrg: boolField(true),
    defaultTheme: z.enum(["light", "dark"]).default("dark"),
    odpDownloadInstaller: boolField(true),
    showSalesEmail: boolField(false),
    isLite: boolField(false),
    showMarketplace: boolField(true),
  }),
  services: z.object({
    posthog: boolField(false),
    hubspotForms: boolField(false),
    email: boolField(false),
    nixtla: boolField(true),
    cloudflareWorker: boolField(true),
  }),
  data: z.object({
    packageDataEnabled: boolField(true),
    allowedDataVendors: strArrayField([]),
    allowedDbTypes: strArrayField([]),
    openDataPlatformInstallerEnabled: boolField(true),
    allowHtmlJsExecution: boolField(false),
  }),
  mcp: z.object({
    defaultServerEnabled: boolField(true),
  }),
  analytics: z.object({
    posthogKey: z.string().default(""),
    posthogUrl: z.string().default(""),
  }),
  whiteLabel: z.object({
    name: z.string().default("OpenBB Workspace"),
    shortName: z.string().default("OpenBB"),
    loginImage: z.string().default("/assets/images/openbb_lettering.svg"),
    loginImageDark: z.string().default("/assets/images/openbb_lettering_light.svg"),
    leftSidebarLogo: z.string().default(""),
    leftSidebarLogoDark: z.string().default(""),
    favicon: z.string().default("/favicon/favicon.ico"),
    description: z.string().default(""),
    keywords: z.string().default(""),
    mainColor: z.string().default("#0088CC"),
    fontFamily: z.string().default("Inter"),
    showFloatingThemePreview: boolField(false),
  }),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

// ── Locked config ─────────────────────────────────────────────────────
// A "locked" field is baked into the JS bundle at build time via Vite
// `define` and forcibly overlaid in `initConfig()`, so a deployment cannot
// override it by editing `config.js` / `window.__APP_CONFIG__`.
//
// The *policy* (which fields are locked, to what values) is NOT defined in
// this repo. It is supplied at build time as a JSON object — see
// `vite.config.ts`, which reads `VITE_LOCKED_CONFIG_FILE`. The OpenBB Lite
// image owns that file (`locked.config.json`); the standard build, on-prem,
// and free-tier builds pass nothing, so nothing is locked.
//
// This module only defines the shape and the validation. `RuntimeConfigSchema`
// itself is the allowlist: `buildLockedConfig` throws on unknown groups/fields
// and coerces values through the same schema the app uses, so a typo in a
// policy file fails the build loudly instead of silently leaving a field
// unlockable.

export type LockedConfig = Partial<{
  [G in keyof RuntimeConfig]: Partial<RuntimeConfig[G]>;
}>;

/**
 * Turn a raw locked-config object (typically parsed from JSON) into a typed,
 * schema-validated `LockedConfig`. Only keys explicitly present in `raw` are
 * kept, and each value is coerced by the same Zod field schema the app uses
 * (`"false"` → `false`, comma lists → arrays, …).
 *
 * Fails loud: a group or field not present in `RuntimeConfigSchema` throws,
 * naming the offending path — a typo in a policy file is a build error, not a
 * silent no-op that leaves a security-relevant field unlockable. Keys starting
 * with `_` (at group or field level) are skipped, so a `"_comment"` doc key in
 * the policy file keeps working. Also throws if a provided value is invalid for
 * its field.
 *
 * Strict mode: two reserved keys (`_`-prefixed, so non-strict parsers already
 * ignore them) turn a policy file into a fail-closed profile:
 *
 *   { "_strict": true, "_unlocked": ["urls.*", "ui.showChangelog"], ... }
 *
 * When `_strict` is true, EVERY leaf field in `RuntimeConfigSchema` must be
 * either locked (given a value) or explicitly listed in `_unlocked`
 * (`group.*` wildcards mark a fully overridable group). An untriaged field, a
 * path in both lists, or an unknown path in `_unlocked` throws. This is the
 * tripwire that keeps in-repo profiles (`config-profiles/`) from silently
 * drifting when a new schema field is added — fail-closed instead of
 * fail-open.
 */
export function buildLockedConfig(raw: unknown): LockedConfig {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const { shape } = RuntimeConfigSchema;
  const locked: Record<string, Record<string, unknown>> = {};

  if ("_strict" in input && typeof input._strict !== "boolean") {
    throw new Error(`"_strict" in locked config must be a boolean`);
  }
  const strict = input._strict === true;

  for (const group of Object.keys(input)) {
    if (group.startsWith("_")) continue;
    if (!(group in shape)) {
      throw new Error(
        `Unknown group "${group}" in locked config — not present in RuntimeConfigSchema`,
      );
    }

    const groupRaw = input[group];
    if (!groupRaw || typeof groupRaw !== "object" || Array.isArray(groupRaw)) {
      throw new Error(`Group "${group}" in locked config must be an object of fields`);
    }

    const groupSchema = shape[group as keyof typeof shape] as unknown as z.AnyZodObject;
    const groupShape = groupSchema.shape as Record<string, unknown>;

    const toValidate: Record<string, unknown> = {};
    for (const field of Object.keys(groupRaw as Record<string, unknown>)) {
      if (field.startsWith("_")) continue;
      if (!(field in groupShape)) {
        throw new Error(
          `Unknown field "${group}.${field}" in locked config — not present in RuntimeConfigSchema`,
        );
      }
      toValidate[field] = (groupRaw as Record<string, unknown>)[field];
    }

    const parsed = groupSchema.partial().parse(toValidate) as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const field of Object.keys(toValidate)) {
      if (field in parsed) picked[field] = parsed[field];
    }
    if (Object.keys(picked).length > 0) locked[group] = picked;
  }

  if (strict) enforceStrictTriage(input._unlocked, locked);

  return locked as LockedConfig;
}

/**
 * Strict-mode triage check: every leaf path in `RuntimeConfigSchema` must be
 * locked or listed in `_unlocked` — never both, never neither. Throws with an
 * error a dev can act on without tribal knowledge.
 */
function enforceStrictTriage(
  rawUnlocked: unknown,
  locked: Record<string, Record<string, unknown>>,
): void {
  const entries = rawUnlocked === undefined ? [] : rawUnlocked;
  if (!Array.isArray(entries) || entries.some((e) => typeof e !== "string")) {
    throw new Error(
      `"_unlocked" in a strict locked config must be an array of strings`,
    );
  }

  const { shape } = RuntimeConfigSchema;
  const unlockedGroups = new Set<string>();
  const unlockedPaths = new Set<string>();

  for (const entry of entries as string[]) {
    const [group, field] = entry.split(".");
    const groupSchema =
      group in shape
        ? (shape[group as keyof typeof shape] as unknown as z.AnyZodObject)
        : undefined;
    if (groupSchema && field === "*") {
      unlockedGroups.add(group);
    } else if (groupSchema && field in groupSchema.shape) {
      unlockedPaths.add(entry);
    } else {
      throw new Error(
        `Unknown path "${entry}" in "_unlocked" — not present in RuntimeConfigSchema`,
      );
    }
  }

  for (const group of Object.keys(shape)) {
    const groupSchema = shape[group as keyof typeof shape] as unknown as z.AnyZodObject;
    for (const field of Object.keys(groupSchema.shape)) {
      const path = `${group}.${field}`;
      const isLocked = locked[group] !== undefined && field in locked[group];
      const isUnlocked = unlockedGroups.has(group) || unlockedPaths.has(path);

      if (isLocked && isUnlocked) {
        throw new Error(
          `Field "${path}" is both locked and listed in "_unlocked" — remove it from one of them.`,
        );
      }
      if (!isLocked && !isUnlocked) {
        throw new Error(
          `Field "${path}" is not triaged for the Lite profile.\n` +
            "Every runtime config field needs a Lite decision:\n" +
            "  - locked off in Lite -> add it with a value to config-profiles/lite.locked.json\n" +
            `  - operator-configurable in Lite -> add "${path}" to "_unlocked"\n` +
            "Full workflow: https://github.com/OpenBB-finance/lite#changing-what-lite-locks",
        );
      }
    }
  }
}
