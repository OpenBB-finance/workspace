import { z } from "zod";
import { EMAIL_RE, HTTP_URL_RE as URL_RE } from "~/lib/utils/externalUrl";
import { deriveAuthFieldId } from "./submissionAuth";

const nonEmpty = (message: string) =>
  z.string().refine((v) => v.trim().length > 0, message);

const requiredUrl = z
  .string()
  .refine((v) => URL_RE.test(v.trim()), "Enter a valid URL (https://…)");

const optionalUrl = z
  .string()
  .refine((v) => !v.trim() || URL_RE.test(v.trim()), "Enter a valid URL (https://…)");

/** Minimum number of gallery screenshots a listing must provide. */
export const MIN_SCREENSHOTS = 2;

/**
 * Fixed set of marketplace categories an app can be listed under. Mirrors the
 * categories on the public marketplace (payments.openbb.dev/marketplace/apps).
 */
export const APP_CATEGORIES = [
  "Sentiment",
  "Filings & Research",
  "Fundamentals",
  "Fixed Income",
  "Consumer",
  "Trading Activity",
  "Commodity",
  "Prediction Markets",
  "Crypto",
  "Portfolio & Risk",
  "News",
  "Geospatial",
] as const;

const authFieldRowSchema = z.object({
  label: z.string(),
  key: z.string(),
  prefix: z.string(),
});

/**
 * Validation for the submission form. Keys + value types mirror
 * `SubmissionFormData` exactly, so validated values feed the submission service
 * unchanged. No `.transform()` is used to keep the inferred type structurally
 * identical to `SubmissionFormData`. Auth row rules live in `superRefine` so
 * stale rows don't error while the section is off or mode ≠ custom.
 */
export const submissionFormSchema = z
  .object({
    // Step 1 — Vendor Profile (email optional)
    vendorName: nonEmpty("Company name is required"),
    vendorWebsiteUrl: requiredUrl,
    vendorDescription: nonEmpty("Company description is required"),
    vendorThumbnailUrl: requiredUrl,
    contactEmail: z
      .string()
      .refine((v) => !v.trim() || EMAIL_RE.test(v.trim()), "Enter a valid email"),
    // Step 2 — App Details (tagline + docs optional)
    appName: nonEmpty("App name is required"),
    description: nonEmpty("App description is required"),
    category: nonEmpty("Category is required"),
    tagline: z.string(),
    thumbnail: requiredUrl,
    documentationUrl: optionalUrl,
    screenshots: z
      .array(
        z
          .string()
          .refine(
            (v) => !v.trim() || URL_RE.test(v.trim()),
            "Enter a valid URL (https://…)",
          ),
      )
      .refine(
        (urls) => urls.filter((u) => URL_RE.test(u.trim())).length >= MIN_SCREENSHOTS,
        { message: `Add at least ${MIN_SCREENSHOTS} screenshot URLs` },
      ),
    // Auth (optional section; row rules gated in superRefine)
    authEnabled: z.boolean(),
    authMode: z.enum(["none", "api_key", "custom"]),
    authAllowAnonymous: z.boolean(),
    authFields: z.array(authFieldRowSchema),
    // MCP (optional section; rules gated in superRefine)
    mcpEnabled: z.boolean(),
    mcpName: z.string(),
    mcpUrl: z.string(),
    mcpDescription: z.string(),
    mcpAuthType: z.enum(["oauth", "token"]),
  })
  .superRefine((data, ctx) => {
    if (data.mcpEnabled) {
      if (!data.mcpName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["mcpName"],
          message: "Server name is required",
        });
      }
      if (!URL_RE.test(data.mcpUrl.trim())) {
        ctx.addIssue({
          code: "custom",
          path: ["mcpUrl"],
          message: "Enter a valid URL (https://…)",
        });
      }
    }

    if (!data.authEnabled || data.authMode !== "custom") return;

    if (data.authFields.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["authFields"],
        message: "Add at least one authentication field",
      });
      return;
    }

    const seenIds = new Map<string, number>();
    const seenKeys = new Map<string, number>();

    for (const [i, row] of data.authFields.entries()) {
      const label = row.label.trim();
      const key = row.key.trim();

      if (!label) {
        ctx.addIssue({
          code: "custom",
          path: ["authFields", i, "label"],
          message: "Label is required",
        });
      } else {
        const id = deriveAuthFieldId(label);
        if (!id) {
          ctx.addIssue({
            code: "custom",
            path: ["authFields", i, "label"],
            message: "Label must contain letters or numbers",
          });
        } else {
          const first = seenIds.get(id);
          if (first !== undefined) {
            ctx.addIssue({
              code: "custom",
              path: ["authFields", i, "label"],
              message: "Field labels must produce unique ids",
            });
          } else {
            seenIds.set(id, i);
          }
        }
      }

      if (!key) {
        ctx.addIssue({
          code: "custom",
          path: ["authFields", i, "key"],
          message: "Header key is required",
        });
      } else {
        const first = seenKeys.get(key);
        if (first !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["authFields", i, "key"],
            message: "Header keys must be unique",
          });
        } else {
          seenKeys.set(key, i);
        }
      }
    }
  });

export type SubmissionFormValues = z.infer<typeof submissionFormSchema>;

/** Validated when advancing past Step 1 (Vendor Profile). */
export const VENDOR_FIELDS = [
  "vendorName",
  "vendorWebsiteUrl",
  "vendorDescription",
  "vendorThumbnailUrl",
  "contactEmail",
] as const;

/** Validated when advancing past Step 2 (App Details) into the preview. */
export const APP_FIELDS = [
  "appName",
  "description",
  "category",
  "tagline",
  "thumbnail",
  "documentationUrl",
  "screenshots",
  "authEnabled",
  "authMode",
  "authAllowAnonymous",
  "authFields",
  "mcpEnabled",
  "mcpName",
  "mcpUrl",
  "mcpDescription",
  "mcpAuthType",
] as const;
