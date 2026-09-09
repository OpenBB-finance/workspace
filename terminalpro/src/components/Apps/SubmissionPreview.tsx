import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import { noop } from "~/lib/utils";
import type { ListedApp } from "~/types/listedApps";
import type {
  MarketplaceSubmission,
  SubmissionFormData,
} from "~/types/marketplaceSubmission";
import { AppPreviewSurfaces } from "./AppPreviewSurfaces";
import { PREVIEW_OPTIONS, type PreviewMode, previewWidgets } from "./appPreview";
import { submissionToListedApp } from "./listedAppFromSubmission";

interface SubmissionPreviewProps {
  /** Backend snapshot (drives the widget-count badges + listed-app shape). */
  widgetCount: number;
  backendUrl: string;
  /** Modes the vendor has already looked at this session (owned by the parent). */
  viewedModes: ReadonlySet<PreviewMode>;
  /** Fired whenever a mode becomes visible, including the default on mount. */
  onModeViewed: (mode: PreviewMode) => void;
}

/**
 * Shows how the in-progress submission will render across the surfaces a real
 * listing appears in — reusing the exact components the marketplace renders, fed
 * from the live form values.
 */
export function SubmissionPreview({
  widgetCount,
  backendUrl,
  viewedModes,
  onModeViewed,
}: SubmissionPreviewProps) {
  const values = useWatch() as SubmissionFormData;
  const [mode, setMode] = useState<PreviewMode>("marketplace");

  // Report the visible mode up so the parent can require all three before submit.
  // Fires on mount for the default, then on every switch.
  useEffect(() => {
    onModeViewed(mode);
  }, [mode, onModeViewed]);

  const previewSubmission = useMemo<MarketplaceSubmission>(
    () => ({
      id: "preview",
      backendUrl,
      widgetCount,
      version: "1",
      status: "pending",
      form: values,
      createdDate: "",
      updatedDate: "",
    }),
    [backendUrl, widgetCount, values],
  );

  // The connected backend gives a widget count, not a list of widget objects.
  const widgets = useMemo(() => previewWidgets(widgetCount), [widgetCount]);

  const listedApp = useMemo<ListedApp>(
    () => ({
      ...submissionToListedApp(previewSubmission),
      widgets,
      totalWidgets: widgetCount,
    }),
    [previewSubmission, widgets, widgetCount],
  );

  const template = useMemo<AppTemplate>(
    () => ({
      id: "preview",
      name: values.appName || "Untitled app",
      description: values.description || "",
      type: "listed",
      widgets,
      totalWidgets: widgetCount,
      prompts: [],
      img: values.thumbnail || undefined,
      vendorName: values.vendorName || undefined,
      onClick: noop,
    }),
    [
      values.appName,
      values.description,
      values.thumbnail,
      values.vendorName,
      widgets,
      widgetCount,
    ],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="body-xs-regular text-ds-text-caption">
          Preview each view before submitting:
        </span>
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as PreviewMode)}
          variant="filled_secondary"
        >
          <TabsList>
            {PREVIEW_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="flex items-center justify-center gap-1.5"
              >
                {viewedModes.has(option.value) ? (
                  <Icon
                    id="check-circle"
                    className="size-3.5 shrink-0 text-alert-success"
                  />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-current opacity-50" />
                )}
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <AppPreviewSurfaces mode={mode} listedApp={listedApp} template={template} />
    </div>
  );
}
