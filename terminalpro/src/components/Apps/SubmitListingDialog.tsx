import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useFormContext, useWatch } from "react-hook-form";
import { EMPTY_SUBMISSION_FORM } from "~/api/marketplaceSubmission.api";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { Select } from "~/components/ds/atoms/Select";
import { Textarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogHeader, DialogTitle } from "~/components/ds/dialogs/Dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ds/molecules/Form";
import { Notice } from "~/components/ds/molecules/Notice";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import {
  useRunSubmissionTests,
  useSubmitForReview,
} from "~/hooks/useMarketplaceSubmissions";
import { apiErrorMessage } from "~/lib/utils/apiError";
import { showNotification } from "~/lib/utils/toast";
import type {
  SubmissionCheck,
  SubmissionFormData,
  SubmissionTarget,
} from "~/types/marketplaceSubmission";
import { PREVIEW_MODES, type PreviewMode } from "./appPreview";
import { incrementVersion } from "./developerAppMapping";
import { ImageUrlPreview } from "./ImageUrlPreview";
import { SubmissionAuthSection } from "./SubmissionAuthSection";
import { SubmissionChecks } from "./SubmissionChecks";
import { SubmissionMcpSection } from "./SubmissionMcpSection";
import { SubmissionPreview } from "./SubmissionPreview";
import { allChecksPassed } from "./submissionCheckUtils";
import {
  APP_CATEGORIES,
  APP_FIELDS,
  MIN_SCREENSHOTS,
  submissionFormSchema,
  VENDOR_FIELDS,
} from "./submissionForm";
import { type ImageUrlStatus, useImageUrlStatuses } from "./useImageUrlStatuses";

type Step = "vendor" | "app" | "preview";
/** Text/select fields only — auth uses a dedicated section. */
type FieldName = {
  [K in keyof SubmissionFormData]: SubmissionFormData[K] extends string ? K : never;
}[keyof SubmissionFormData];

const IMAGE_ERROR =
  "This image URL doesn't load. Use a public direct image link (not a Google Drive/Dropbox share link).";

interface FieldProps<T extends FieldName, P = Pick<SubmissionFormData, T>> {
  name: T;
  label: string;
  placeholder: string;
  description: string;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
  /** When set, render a fixed-option dropdown instead of a free-text input. */
  options?: readonly string[];
  /** Extra content rendered under the input (e.g. an image-URL preview). */
  belowInput?: ReactNode | ((values: P) => ReactNode);
}

/** A labelled form field with a helper caption + auto-rendered validation error. */
function Field<T extends FieldName, P = Pick<SubmissionFormData, T>>(
  props: FieldProps<T, P>,
) {
  const { name, label, placeholder, description, multiline, options, belowInput } =
    props;
  const { control } = useFormContext<SubmissionFormData>();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1.5">
          <FormLabel>{label}</FormLabel>
          {options ? (
            <Select
              options={options}
              value={field.value as string}
              onChange={field.onChange}
              placeholder={placeholder}
            />
          ) : (
            <FormControl>
              {multiline ? (
                <Textarea
                  placeholder={placeholder}
                  rows={4}
                  autoheight={false}
                  {...field}
                />
              ) : (
                <Input placeholder={placeholder} {...field} />
              )}
            </FormControl>
          )}
          {typeof belowInput === "function"
            ? belowInput({ [name]: field.value as string } as P)
            : belowInput}
          <p className="body-xs-regular text-ds-text-support">{description}</p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Per-row errors for the `screenshots` array. Element-level messages live under
 * numeric keys; the array-level (min-count) message lives on `message`.
 */
type ScreenshotErrors =
  | ({ message?: string } & Record<number, { message?: string } | undefined>)
  | undefined;

/** Repeatable list of gallery screenshot URLs (drives the details-view carousel). */
function ScreenshotsField({ statuses }: { statuses: Record<string, ImageUrlStatus> }) {
  const { control } = useFormContext<SubmissionFormData>();
  return (
    <FormField
      control={control}
      name="screenshots"
      render={({ field, fieldState }) => {
        const urls = field.value ?? [];
        const errors = fieldState.error as ScreenshotErrors;
        const arrayMessage =
          typeof errors?.message === "string" ? errors.message : undefined;
        return (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel>Screenshots</FormLabel>
            <div className="flex flex-col gap-3">
              {urls.map((url, i) => {
                const rowError = errors?.[i]?.message;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="https://…/screenshot.png"
                        value={url}
                        error={!!rowError}
                        onChange={(v: string) =>
                          field.onChange(urls.map((u, j) => (j === i ? v : u)))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={true}
                        aria-label="Remove screenshot"
                        className="shrink-0"
                        onClick={() => field.onChange(urls.filter((_, j) => j !== i))}
                      >
                        <Icon id="x-close" className="h-4 w-4" />
                      </Button>
                    </div>
                    <ImageUrlPreview url={url} status={statuses[url.trim()]} />
                    {rowError && (
                      <p className="body-xs-regular text-alert-error">{rowError}</p>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="self-start"
                onClick={() => field.onChange([...urls, ""])}
              >
                Add screenshot
              </Button>
            </div>
            <p className="body-xs-regular text-ds-text-support">
              Add at least {MIN_SCREENSHOTS} gallery images shown on your app's details
              page — one URL per screenshot.
            </p>
            {arrayMessage && (
              <p className="body-xs-regular text-alert-error">{arrayMessage}</p>
            )}
          </FormItem>
        );
      }}
    />
  );
}

function StepTab({
  value,
  badge,
  children,
}: {
  value: Step;
  badge: string;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex w-full items-center justify-center gap-2"
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-current text-[10px] font-semibold">
        {badge}
      </span>
      {children}
    </TabsTrigger>
  );
}

function StepIntro({ step, children }: { step: string; children: ReactNode }) {
  return (
    <p className="body-xs-regular text-ds-text-body">
      <span className="font-semibold text-ds-text-heading">{step}</span> {children}
    </p>
  );
}

/** Pad a screenshots list up to the minimum so the empty rows are visible. */
function padScreenshots(screenshots: string[]): string[] {
  if (screenshots.length >= MIN_SCREENSHOTS) return screenshots;
  return [...screenshots, ...Array(MIN_SCREENSHOTS - screenshots.length).fill("")];
}

/** Every image URL that must actually load before a submission is accepted. */
function collectImageUrls(form: SubmissionFormData): string[] {
  return [form.vendorThumbnailUrl, form.thumbnail, ...form.screenshots]
    .map((u) => u.trim())
    .filter(Boolean);
}

function dialogTitle(target: SubmissionTarget | null): string {
  if (!target) return "Submit to Marketplace";
  if (target.kind === "update") return "Update Listing";
  if (target.kind === "existing") return "Edit Submission";
  return "Submit to Marketplace";
}

function submitButtonLabel(target: SubmissionTarget | null): string {
  if (target?.kind === "update") return "Submit Update";
  return "Submit App";
}

function successNotification(target: SubmissionTarget | null) {
  if (target?.kind === "update") {
    return {
      message: "Update submitted for review",
      description:
        "The OpenBB team will review your changes. The live listing stays unchanged until approved.",
    };
  }
  if (target?.kind === "existing") {
    return {
      message: "Submission updated",
      description: "Your changes were saved and the review team has been notified.",
    };
  }
  return {
    message: "Submitted for review",
    description:
      "The OpenBB team will review your app. You can see the status in the Marketplace tab.",
  };
}

interface SubmitListingDialogProps {
  /** The listing being created (new seed) or edited (existing); `null` = closed. */
  target: SubmissionTarget | null;
  onClose: () => void;
}

export function SubmitListingDialog({ target, onClose }: SubmitListingDialogProps) {
  const form = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: EMPTY_SUBMISSION_FORM,
  });
  const [step, setStep] = useState<Step>("vendor");
  const [checks, setChecks] = useState<SubmissionCheck[] | null>(null);
  const [verifyingImages, setVerifyingImages] = useState(false);
  const [viewedModes, setViewedModes] = useState<ReadonlySet<PreviewMode>>(new Set());
  const runTests = useRunSubmissionTests();
  const submitForReview = useSubmitForReview();

  // `useWatch` re-renders on any change, but returns a stable object while the
  // values are unchanged — unlike `form.watch()`, whose fresh ref every render
  // would defeat every downstream `useMemo` (notably the three previews).
  const values = useWatch({ control: form.control }) as SubmissionFormData;

  // Load every image URL to catch broken/non-public links (e.g. Google Drive
  // share links) that pass the format check. Lives here — not per field —
  // because the step form remounts on navigation, which would drop probe state.
  const imageUrls = useMemo(
    () =>
      [values.vendorThumbnailUrl, values.thumbnail, ...values.screenshots]
        .map((u) => u.trim())
        .filter(Boolean),
    [values.vendorThumbnailUrl, values.thumbnail, values.screenshots],
  );
  const { statuses, ensureSettled, resetErrors } = useImageUrlStatuses(imageUrls);

  const markModeViewed = useCallback(
    (mode: PreviewMode) =>
      setViewedModes((prev) => (prev.has(mode) ? prev : new Set(prev).add(mode))),
    [],
  );
  const allViewsPreviewed = viewedModes.size === PREVIEW_MODES.length;

  // Reset the form + wizard whenever the dialog opens. Every submission starts
  // from a clean state: an existing submission seeds its saved form, a brand-new
  // one seeds just the app name (and the connection's existing cover, if any).
  // Both seed at least two screenshot rows so the min-2 requirement is visible.
  // only — `form` and `resetErrors` are stable, and re-running on either would
  // wipe whatever the developer has typed since the dialog opened.
  useEffect(() => {
    if (!target) return;
    const seedForm =
      target.kind === "existing" || target.kind === "update"
        ? {
            ...target.submission.form,
            screenshots: padScreenshots(target.submission.form.screenshots),
          }
        : {
            ...EMPTY_SUBMISSION_FORM,
            appName: target.seed.appName,
            thumbnail: target.seed.existingCover ?? "",
            screenshots: ["", ""],
          };
    form.reset(seedForm);
    setStep("vendor");
    setChecks(null);
    setViewedModes(new Set());
    resetErrors();
  }, [target]);

  const checksFailed = !!checks && !allChecksPassed(checks);

  const snapshot = useMemo(() => {
    if (target?.kind === "new") {
      return {
        backendUrl: target.seed.backendUrl,
        widgetCount: target.seed.widgetCount,
      };
    }
    if (target?.kind === "existing" || target?.kind === "update") {
      return {
        backendUrl: target.submission.backendUrl,
        widgetCount: target.submission.widgetCount,
      };
    }
    return { backendUrl: "", widgetCount: 0 };
  }, [target]);

  const nextVersion =
    target?.kind === "update" ? incrementVersion(target.submission.version) : undefined;

  const rejectionFeedback =
    target?.kind === "existing" && target.submission.status === "rejected"
      ? target.submission.rejectionFeedback
      : undefined;

  const goToApp = useCallback(async () => {
    const ok = await form.trigger([...VENDOR_FIELDS]);
    if (!ok) return;
    setStep("app");
  }, [form.trigger]);

  const goToPreview = useCallback(async () => {
    const ok = await form.trigger([...APP_FIELDS]);
    if (!ok) return;
    setStep("preview");
  }, [form.trigger]);

  const handleSubmitApp = useCallback(async () => {
    if (!target) return;
    const ok = await form.trigger();
    if (!ok) {
      const vendorHasError = VENDOR_FIELDS.some((f) => form.formState?.errors?.[f]);
      setStep(vendorHasError ? "vendor" : "app");
      return;
    }
    const formValues = form.getValues();

    // Hard gate: every image must actually load. Broken/non-public URLs pass the
    // format check but fail here — flag the offending field and jump to its step.
    setVerifyingImages(true);
    const settled = await ensureSettled(collectImageUrls(formValues)).finally(() =>
      setVerifyingImages(false),
    );
    const broken = (url: string) => settled[url.trim()] === "error";
    let vendorImageBroken = false;
    let appImageBroken = false;
    if (broken(formValues.vendorThumbnailUrl)) {
      form.setError("vendorThumbnailUrl", { type: "image", message: IMAGE_ERROR });
      vendorImageBroken = true;
    }
    if (broken(formValues.thumbnail)) {
      form.setError("thumbnail", { type: "image", message: IMAGE_ERROR });
      appImageBroken = true;
    }
    formValues.screenshots.forEach((url, i) => {
      if (broken(url)) {
        form.setError(`screenshots.${i}`, { type: "image", message: IMAGE_ERROR });
        appImageBroken = true;
      }
    });
    if (vendorImageBroken || appImageBroken) {
      setStep(vendorImageBroken ? "vendor" : "app");
      return;
    }

    try {
      const result = await runTests.mutateAsync([target, formValues]);
      setChecks(result);
      if (!allChecksPassed(result)) {
        setStep("app");
        return;
      }
      await submitForReview.mutateAsync([target, formValues]);
    } catch (error) {
      showNotification({
        message: "Submission failed",
        description: apiErrorMessage(
          error,
          "Something went wrong submitting your app. Please try again.",
        ),
        toastType: "error",
      });
      return;
    }
    const toast = successNotification(target);
    showNotification({
      message: toast.message,
      description: toast.description,
      toastType: "success",
    });
    onClose();
  }, [
    form.getValues,
    form.setError,
    form.trigger,
    ensureSettled,
    form.formState?.errors,
    runTests.mutateAsync,
    submitForReview.mutateAsync,
    onClose,
    target,
  ]);

  const submitting = verifyingImages || runTests.isPending || submitForReview.isPending;

  return (
    <BaseDialog
      open={!!target}
      onClose={onClose}
      className="max-w-3xl sm:max-w-3xl"
      modal={true}
    >
      <DialogHeader>
        <DialogTitle>{dialogTitle(target)}</DialogTitle>
      </DialogHeader>

      {nextVersion && (
        <Notice variant="info" title="New version">
          Your update will be submitted as version {nextVersion}. The current live
          listing stays unchanged until this version is approved.
        </Notice>
      )}

      <Tabs
        value={step}
        onValueChange={(v) => setStep(v as Step)}
        variant="filled_secondary"
      >
        <TabsList className="w-full">
          <StepTab value="vendor" badge="01">
            Vendor Profile
          </StepTab>
          <StepTab value="app" badge="02">
            App Details
          </StepTab>
          <StepTab value="preview" badge="03">
            Final Preview
          </StepTab>
        </TabsList>
      </Tabs>

      {rejectionFeedback && (
        <Notice variant="warning" title="App Review — Feedback">
          {rejectionFeedback}
        </Notice>
      )}

      <Form {...form}>
        <form
          key={step}
          onSubmit={(e) => e.preventDefault()}
          className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1"
        >
          {step === "vendor" ? (
            <>
              <StepIntro step="Step 1:">
                Start by telling us about your company. We'll review your vendor profile
                first. Once approved, you'll move on to the app details. Note that all
                fields are mandatory. Before submitting, please ensure all URLs are
                publicly accessible and follow the specified formats. Submissions that
                do not meet these requirements will need to be revised and re-submitted.
              </StepIntro>
              <Field
                name="vendorName"
                label="Company Name"
                placeholder="e.g. Alpha Vantage"
                description="Your company's official name as it should appear on the marketplace listing."
              />
              <Field
                name="vendorWebsiteUrl"
                label="Website URL"
                placeholder="https://yourcompany.com"
                description="Your company's website. Displayed as a clickable link below your company name (e.g., https://yourcompany.com)."
              />
              <Field
                name="vendorDescription"
                label="Company Description"
                placeholder="Describe what your company does and offers"
                description="A brief overview of your company and your overall product offerings. Keep it concise — 2 to 4 sentences."
                multiline
              />
              <Field
                name="vendorThumbnailUrl"
                label="Company logo"
                placeholder="https://…/logo.png"
                description="Square logo shown as the icon on your marketplace card and details (e.g. 256×256)."
                belowInput={({ vendorThumbnailUrl }) => (
                  <ImageUrlPreview
                    url={vendorThumbnailUrl}
                    status={statuses[vendorThumbnailUrl.trim()]}
                    aspect="square"
                  />
                )}
              />
              <Field
                name="contactEmail"
                label="Support contact email (optional)"
                placeholder="support@yourcompany.com"
                description="The email address displayed on your listing under 'Contact' for user inquiries and support."
              />
            </>
          ) : step === "app" ? (
            <>
              <StepIntro step="Step 2:">
                Describe your app and how it works inside OpenBB Workspace. Our team
                reviews every submission to ensure it meets our quality and data
                standards: including your app description, screenshots, hosted URL, and
                widget functionality. Once approved, your app will be automatically
                published and available to all OpenBB users in the marketplace.
              </StepIntro>
              <Field
                name="appName"
                label="App name"
                placeholder="e.g. Market Intelligence"
                description="The name shown on your app's marketplace card and details."
              />
              <Field
                name="description"
                label="Description"
                placeholder="Describe what this app does and when to use it"
                description="Shown on your listing — what your app does and when to use it."
                multiline
              />
              <Field
                name="category"
                label="Category"
                placeholder="Select a category"
                options={APP_CATEGORIES}
                description="The category your app appears under on the marketplace."
              />
              <Field
                name="tagline"
                label="Tagline (optional)"
                placeholder="One-line hook shown beneath the title"
                description="A short hook shown beneath the app title on its card."
              />
              <Field
                name="thumbnail"
                label="Thumbnail image URL"
                placeholder="https://…/cover.png"
                description="A hosted cover image URL (5:3 ratio recommended, e.g. 1000×600)."
                belowInput={({ thumbnail }) => (
                  <ImageUrlPreview
                    url={thumbnail}
                    status={statuses[thumbnail.trim()]}
                    aspect="wide"
                  />
                )}
              />
              <ScreenshotsField statuses={statuses} />
              <Field
                name="documentationUrl"
                label="Documentation URL (optional)"
                placeholder="https://docs.yourcompany.com"
                description="Link to your app's documentation, shown as “Learn more”."
              />
              <SubmissionAuthSection />
              <SubmissionMcpSection />
            </>
          ) : (
            <>
              <StepIntro step="Step 3:">
                Review how your app will appear across the marketplace, then submit it
                for review.
              </StepIntro>
              <SubmissionPreview
                widgetCount={snapshot.widgetCount}
                backendUrl={snapshot.backendUrl}
                viewedModes={viewedModes}
                onModeViewed={markModeViewed}
              />
            </>
          )}
        </form>
      </Form>

      {checksFailed && checks && (
        <div className="mt-2 rounded border border-general-border-secondary p-3">
          <p className="mb-2 body-xs-medium text-alert-error">
            Some checks didn't pass. Fix the items below, then submit again.
          </p>
          <SubmissionChecks checks={checks} />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        {step === "preview" && !allViewsPreviewed ? (
          <p className="body-xs-regular text-ds-text-caption">
            Check all three previews above to enable Submit.
          </p>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {step === "preview" ? (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmitApp}
              loading={submitting}
              disabled={submitting || !allViewsPreviewed}
            >
              {submitButtonLabel(target)}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={step === "vendor" ? goToApp : goToPreview}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </BaseDialog>
  );
}
