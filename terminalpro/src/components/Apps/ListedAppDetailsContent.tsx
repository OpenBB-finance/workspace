import { memo, type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { WidgetTooltipItem } from "~/components/AI/WidgetTooltipItem";
import { Tag } from "~/components/ds/atoms/Tag";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import { cn } from "~/components/ds/utils";
import { HoverPopover } from "~/components/HoverPopover";
import Icon from "~/components/Icon";
import { PopoverContent } from "~/components/LayoutAuth/AppCard/PopoverContent";
import { useShallowThemeStore } from "~/lib/state/theme";
import { openExternalUrl, safeExternalUrl } from "~/lib/utils/externalUrl";
import { type ListedApp, mcpServerUsesTokenAuth } from "~/types/listedApps";
import { DetailRow } from "./DetailRow";
import { McpAppPopover } from "./McpAppPopover";
import { MediaCarousel } from "./MediaCarousel";

const WidgetPopoverContent = memo(
  (props: {
    id: string;
    title: string;
    items: ListedApp["widgets"];
    totalItems?: number;
    origin?: string;
  }) => {
    const { items, origin, ...rest } = props;

    const itemsMemo = useMemo(
      () =>
        items.map((w, index) => {
          const displayName = `${w.name}${(w.count ?? 0) > 1 ? ` (${w.count})` : ""}`;
          return (
            <WidgetTooltipItem
              key={`widget-${index}`}
              name={displayName}
              description={w.description}
              origin={origin}
            />
          );
        }),
      [items, origin],
    );

    return <PopoverContent {...rest} items={itemsMemo} />;
  },
);
WidgetPopoverContent.displayName = "WidgetPopoverContent";

interface ListedAppDetailsContentProps {
  app: ListedApp;
  isSubscribed: boolean;
  /**
   * Title node rendered in the header — a Radix `DialogTitle` inside the modal,
   * a plain element in the static preview (which has no Dialog context).
   */
  titleSlot: ReactNode;
  /** App Details header actions (status + connect/auth). Omitted in preview. */
  appActions?: ReactNode;
}

/**
 * Presentational body of the listed-app details view: the header, the Vendor
 * Profile rows, and the App Details section (description, widget/prompt/MCP
 * counts, media). Rendered both by {@link file://./ListedAppDetailsModal.tsx}
 * (with live connect/auth actions) and by the submission dialog's preview.
 */
export const ListedAppDetailsContent = memo((props: ListedAppDetailsContentProps) => {
  const { app, isSubscribed, titleSlot, appActions } = props;

  const uniqueId = useId();
  const theme = useShallowThemeStore((state) => state.theme);
  const [imageError, setImageError] = useState(false);

  // Accordion open state is shared across every app's details view and persisted.
  const [vendorProfileOpen, setVendorProfileOpen] = useLocalStorage(
    "listedAppDetails.vendorProfileOpen",
    false,
  );
  const [appDetailsOpen, setAppDetailsOpen] = useLocalStorage(
    "listedAppDetails.appDetailsOpen",
    true,
  );

  const contactEmail = app.contactEmail || "support@openbb.co";

  // Both URLs are vendor-authored and this view also renders unreviewed
  // submissions (admin Final Preview), so only http(s) links are followable.
  const vendorWebsiteUrl = safeExternalUrl(app.vendorWebsiteUrl);
  const documentationUrl = safeExternalUrl(app.documentationUrl);

  const handleVendorWebsiteClick = useCallback(() => {
    openExternalUrl(vendorWebsiteUrl);
  }, [vendorWebsiteUrl]);

  const handleDocsClick = useCallback(() => {
    openExternalUrl(documentationUrl);
  }, [documentationUrl]);

  const vendorHostname = useMemo(() => {
    if (!vendorWebsiteUrl) return null;
    return new URL(vendorWebsiteUrl).hostname;
  }, [vendorWebsiteUrl]);

  const vendorInitials = useMemo(() => {
    return app.vendorName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [app.vendorName]);

  const imgSrc = useMemo(() => {
    if (app.vendorThumbnailUrl) return app.vendorThumbnailUrl;
    if (theme === "dark") {
      return app.thumbnailDark || app.thumbnail;
    }
    return app.thumbnailLight || app.thumbnail;
  }, [
    theme,
    app.vendorThumbnailUrl,
    app.thumbnailDark,
    app.thumbnailLight,
    app.thumbnail,
  ]);

  return (
    <div className="flex flex-col gap-4 p-4 flex-auto min-h-0 overflow-hidden">
      <div className="flex items-center gap-2.5 shrink-0 pr-12">
        <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-general-bg-secondary border border-general-border-secondary">
          {imgSrc && !imageError ? (
            <img
              src={imgSrc}
              alt={app.vendorName}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-ds-text-heading font-bold text-sm">
              {vendorInitials}
            </span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          {titleSlot}
          <span className="body-xs-regular text-ds-text-caption truncate">
            {app.vendorName}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-auto min-h-0 overflow-y-auto">
        <SettingsMenu
          title="Vendor Profile"
          canCollapse
          open={vendorProfileOpen}
          onOpenChange={setVendorProfileOpen}
          className="shrink-0"
        >
          <div>
            <DetailRow label="Name">{app.vendorName}</DetailRow>
            <DetailRow label="Email">{contactEmail}</DetailRow>
            {vendorHostname && (
              <DetailRow label="Website">
                <button
                  type="button"
                  onClick={handleVendorWebsiteClick}
                  title={vendorWebsiteUrl ?? undefined}
                  className="text-left hover:text-link-color hover:underline break-words"
                >
                  {vendorHostname}
                </button>
              </DetailRow>
            )}
            {app.category && (
              <DetailRow label="Category">
                <Tag color="grey">{app.category}</Tag>
              </DetailRow>
            )}
            {app.vendorDescription && (
              <DetailRow label="Description">{app.vendorDescription}</DetailRow>
            )}
          </div>
        </SettingsMenu>

        <SettingsMenu
          title="App Details"
          canCollapse
          open={appDetailsOpen}
          onOpenChange={setAppDetailsOpen}
          className={cn({
            "flex flex-col flex-auto min-h-0": appDetailsOpen,
            "shrink-0": !appDetailsOpen,
          })}
          contentClassName="flex flex-col flex-auto min-h-0"
          bodyClassName="flex-auto min-h-0 overflow-y-auto"
          rightElement={appActions}
        >
          <p className="body-xs-regular text-ds-text-body">
            {app.description}
            {documentationUrl && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={handleDocsClick}
                  title={documentationUrl}
                  className="inline text-link-color underline"
                >
                  Learn more
                </button>
              </>
            )}
          </p>

          {(!!app.widgets?.length ||
            !!app.prompts?.length ||
            !!app.mcpServers?.[0]) && (
            <div className="flex items-center divide-x divide-general-border-secondary">
              {!!app.widgets?.length && (
                <div className="px-3 first:pl-0 last:pr-0">
                  <HoverPopover
                    contentClassName="bg-general-bg-primary p-2.5"
                    id={`modal-widgets-${uniqueId}`}
                    side="top"
                    onClick={(e) => e.stopPropagation()}
                    triggerClassName="flex items-center gap-1.5"
                    trigger={
                      <>
                        <Icon
                          id="layout-top"
                          className="w-3.5 h-3.5 text-ds-text-caption"
                        />
                        <span className="body-2xs-regular">
                          <span className="text-ds-text-caption">Widgets: </span>
                          <span className="text-ds-text-subtitle font-semibold">
                            {app.totalWidgets || app.widgets.length}
                          </span>
                        </span>
                      </>
                    }
                    content={
                      <WidgetPopoverContent
                        id={`modal-widgets-${uniqueId}`}
                        title="Widgets"
                        items={app.widgets}
                        origin={app.vendorName}
                        totalItems={app.totalWidgets || app.widgets.length}
                      />
                    }
                  />
                </div>
              )}

              {!!app.prompts?.length && (
                <div className="px-3 first:pl-0 last:pr-0">
                  <HoverPopover
                    contentClassName="bg-general-bg-primary p-2.5"
                    id={`modal-prompts-${uniqueId}`}
                    side="top"
                    onClick={(e) => e.stopPropagation()}
                    triggerClassName="flex items-center gap-1.5"
                    trigger={
                      <>
                        <Icon
                          id="message-text-square-02"
                          className="w-3.5 h-3.5 text-ds-text-caption"
                        />
                        <span className="body-2xs-regular">
                          <span className="text-ds-text-caption">Prompts: </span>
                          <span className="text-ds-text-subtitle font-semibold">
                            {app.prompts.length}
                          </span>
                        </span>
                      </>
                    }
                    content={
                      <PopoverContent
                        id={`modal-prompts-${uniqueId}`}
                        title="Prompts"
                        items={app.prompts}
                      />
                    }
                  />
                </div>
              )}

              {!!app.mcpServers?.[0] && (
                <div className="px-3 first:pl-0 last:pr-0">
                  <HoverPopover
                    contentClassName="bg-general-bg-primary p-2.5"
                    id={`modal-mcp-${uniqueId}`}
                    side="top"
                    onClick={(e) => e.stopPropagation()}
                    triggerClassName="flex items-center gap-1.5"
                    trigger={
                      <>
                        <Icon id="mcp" className="w-3.5 h-3.5 text-ds-text-caption" />
                        <span className="body-2xs-regular">
                          <span className="text-ds-text-caption">MCP: </span>
                          <span className="text-ds-text-subtitle font-semibold">
                            {app.mcpServers.length}
                          </span>
                        </span>
                      </>
                    }
                    content={
                      <McpAppPopover
                        vendorAppUuid={app.id}
                        vendorName={app.vendorName}
                        mcpServer={app.mcpServers[0]}
                        isSubscribed={isSubscribed || !!app.isBuiltIn}
                        tokenActionExternal={mcpServerUsesTokenAuth(app.mcpServers[0])}
                      />
                    }
                  />
                </div>
              )}
            </div>
          )}

          {(app.media ?? app.screenshots)?.length ? (
            <MediaCarousel
              items={(app.media ?? app.screenshots) as string[]}
              appName={app.appName}
            />
          ) : null}
        </SettingsMenu>
      </div>
    </div>
  );
});
ListedAppDetailsContent.displayName = "ListedAppDetailsContent";
