import { EMAIL_RE, HTTP_URL_RE as URL_RE } from "~/lib/utils/externalUrl";
import type {
  SubmissionCheck,
  SubmissionFormData,
} from "~/types/marketplaceSubmission";

/** Backend metadata the automated checks read (snapshotted on the submission). */
export interface SubmissionCheckMeta {
  backendUrl: string;
  widgetCount: number;
}

const REQUIRED_FIELDS: [keyof SubmissionFormData, string][] = [
  ["appName", "App name"],
  ["vendorName", "Vendor name"],
  ["category", "Category"],
  ["description", "Description"],
];

const pass = (): Pick<SubmissionCheck, "status"> => ({ status: "passed" });
const fail = (error: string): Pick<SubmissionCheck, "status" | "error"> => ({
  status: "failed",
  error,
});

/**
 * Pure evaluation of every automated submission check against the current form
 * + backend snapshot. The mock service runs this after a simulated delay; the
 * dialog gates the Submit button on every check passing.
 */
export function evaluateSubmissionChecks(
  form: SubmissionFormData,
  meta: SubmissionCheckMeta,
): SubmissionCheck[] {
  const missing = REQUIRED_FIELDS.filter(([key]) => !`${form[key] ?? ""}`.trim()).map(
    ([, label]) => label,
  );

  return [
    {
      id: "backend-reachable",
      label: "Backend reachable",
      ...(meta.backendUrl
        ? pass()
        : fail("Backend URL is missing or the connection is no longer active.")),
    },
    {
      id: "required-fields",
      label: "Required fields complete",
      ...(missing.length === 0
        ? pass()
        : fail(`Fill in required fields: ${missing.join(", ")}.`)),
    },
    {
      id: "has-widgets",
      label: "At least one widget",
      ...(meta.widgetCount > 0
        ? pass()
        : fail("This backend exposes no widgets. Add at least one before listing.")),
    },
    {
      id: "valid-thumbnail",
      label: "Valid thumbnail URL",
      ...(URL_RE.test(form.thumbnail.trim())
        ? pass()
        : fail("Enter a valid image URL starting with http:// or https://.")),
    },
    {
      id: "valid-contact-email",
      label: "Valid contact email",
      ...(!form.contactEmail.trim() || EMAIL_RE.test(form.contactEmail.trim())
        ? pass()
        : fail("Enter a valid contact email address.")),
    },
  ];
}

export function allChecksPassed(checks: SubmissionCheck[] | undefined): boolean {
  return !!checks?.length && checks.every((c) => c.status === "passed");
}
