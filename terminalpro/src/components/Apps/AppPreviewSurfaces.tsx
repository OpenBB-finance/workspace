import { useMemo } from "react";
import AppCard from "~/components/LayoutAuth/AppCard/AppCard";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import { noop } from "~/lib/utils";
import type { ListedApp } from "~/types/listedApps";
import type { PreviewMode } from "./appPreview";
import { ListedAppCard } from "./ListedAppCard";
import { ListedAppDetailsContent } from "./ListedAppDetailsContent";

interface AppPreviewSurfacesProps {
  mode: PreviewMode;
  listedApp: ListedApp;
  template: AppTemplate;
}

/**
 * Renders a listing exactly as one of the three real marketplace surfaces
 * would, by mounting the components the marketplace itself renders. Shared by
 * the vendor's submission preview and the admin review dialog so the two can't
 * drift — a styling change lands on both or neither.
 */
export function AppPreviewSurfaces({
  mode,
  listedApp,
  template,
}: AppPreviewSurfacesProps) {
  // `ListedAppDetailsContent` is memoised; an inline element here would hand it
  // a fresh prop ref on every render and defeat that.
  const titleSlot = useMemo(
    () => (
      <span className="body-sm-bold truncate text-ds-text-heading">
        {listedApp.appName}
      </span>
    ),
    [listedApp.appName],
  );

  return (
    <div className="flex justify-center rounded border border-general-border-secondary bg-general-bg-secondary p-6">
      {mode === "general" ? (
        <div className="pointer-events-none w-[280px] select-none">
          <AppCard template={template} hideActions={true} />
        </div>
      ) : mode === "marketplace" ? (
        <div className="w-[350px]">
          <ListedAppCard app={listedApp} isSubscribed={false} onOpenDetails={noop} />
        </div>
      ) : (
        <div className="flex h-[440px] w-full max-w-[560px] flex-col overflow-hidden rounded border border-general-border-secondary bg-general-bg-primary">
          <ListedAppDetailsContent
            app={listedApp}
            isSubscribed={false}
            titleSlot={titleSlot}
          />
        </div>
      )}
    </div>
  );
}
