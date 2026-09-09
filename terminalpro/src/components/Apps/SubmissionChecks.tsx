import Icon from "~/components/Icon";
import type { SubmissionCheck } from "~/types/marketplaceSubmission";

function StatusIcon({ status }: { status: SubmissionCheck["status"] }) {
  if (status === "passed") {
    return <Icon id="check-circle" className="h-4 w-4 shrink-0 text-alert-success" />;
  }
  if (status === "failed") {
    return <Icon id="warning-icon" className="h-4 w-4 shrink-0 text-alert-error" />;
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-ds-text-caption" />
    </span>
  );
}

/** Per-check pass/fail list shown after the developer runs the automated tests. */
export function SubmissionChecks({ checks }: { checks: SubmissionCheck[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2">
          <span className="mt-0.5">
            <StatusIcon status={check.status} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-ds-text-heading">
              {check.label}
            </span>
            {check.status === "failed" && check.error && (
              <span className="text-xs text-alert-error">{check.error}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
