import { slugify } from "~/lib/utils/utils";
import type { ListedAppAuthField, ListedAppAuthType } from "~/types/listedApps";
import type { SubmissionFormData } from "~/types/marketplaceSubmission";

/** Derive a stable auth field id from its label (`"API Key"` → `"api_key"`). */
export function deriveAuthFieldId(label: string): string {
  return slugify(label, "_");
}

/**
 * Build the backend `auth_type` array from the dialog radio + anonymous checkbox.
 * `none` always yields `["none"]`; other modes optionally prepend `"none"`.
 */
export function buildAuthTypes(form: SubmissionFormData): ListedAppAuthType[] {
  if (form.authMode === "none") return ["none"];
  if (form.authAllowAnonymous) return ["none", form.authMode];
  return [form.authMode];
}

/**
 * Build backend `auth_fields` from custom rows. Trims label/key, derives ids,
 * and omits whitespace-only prefixes. Non-empty prefixes keep their original
 * spacing (`"Bearer "` must retain its trailing space when concatenated).
 */
export function buildAuthFields(form: SubmissionFormData): ListedAppAuthField[] {
  return form.authFields.map((row) => {
    const label = row.label.trim();
    const key = row.key.trim();
    const field: ListedAppAuthField = {
      id: deriveAuthFieldId(label),
      label,
      key,
    };
    if (row.prefix.trim()) field.prefix = row.prefix;
    return field;
  });
}
