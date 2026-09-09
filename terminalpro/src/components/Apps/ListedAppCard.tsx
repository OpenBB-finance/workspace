import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Tag } from "~/components/ds/atoms/Tag";
import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import { AppCardDropdown } from "~/components/LayoutAuth/AppCard/AppCardDropdown";
import type { AppCardDropdownItem } from "~/components/LayoutAuth/AppCard/types";
import Tooltip from "~/components/Tooltip";
import { useShallowThemeStore } from "~/lib/state/theme";
import type { ListedApp } from "~/types/listedApps";
import type {
  MarketplaceSubmission,
  SubmissionStatus,
} from "~/types/marketplaceSubmission";
import { isNewListedApp } from "./listedAppSort";

/** Status shown bottom-right on owner submission cards (dot + label). */
const FOOTER_STATUS = {
  pending: { label: "Pending", className: "text-alert-warning" },
  approved: { label: "Live", className: "text-alert-success" },
  rejected: { label: "Rejected", className: "text-alert-error" },
} as const satisfies Record<SubmissionStatus, { label: string; className: string }>;

interface ListedAppCardProps {
  app: ListedApp;
  isSubscribed: boolean;
  onOpenDetails: () => void;
  onOpenApp?: () => void;
  onRate?: () => void;
  onDisconnect?: () => void;
  /**
   * Present when this card is the developer's own submission (owner view). Drives
   * the status tag + footer CTA instead of the consumer connect/subscribe chrome.
   */
  submission?: MarketplaceSubmission;
  /** Owner action: open the submission dialog (pending/rejected edit). */
  onSubmitListing?: () => void;
  /**
   * Owner action: open the submission dialog to propose a new version (approved).
   * Omitted while a revision is already open, which hides the action.
   */
  onUpdateListing?: () => void;
  /** Extra dropdown items for the owner card (e.g. dev-only review controls). */
  submissionDropdownItems?: AppCardDropdownItem[];
  isLite?: boolean;
}

export function ListedAppCard({
  app,
  isSubscribed,
  onOpenDetails,
  onOpenApp,
  onRate,
  onDisconnect,
  submission,
  onSubmitListing,
  onUpdateListing,
  submissionDropdownItems,
  isLite,
}: ListedAppCardProps) {
  const theme = useShallowThemeStore((state) => state.theme);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isOwnerCard = !!submission;

  useEffect(() => {
    const checkIfTruncated = () => {
      if (descriptionRef.current) {
        const { scrollHeight, clientHeight } = descriptionRef.current;
        setIsDescriptionTruncated(scrollHeight > clientHeight);
      }
    };

    checkIfTruncated();
    window.addEventListener("resize", checkIfTruncated);
    return () => window.removeEventListener("resize", checkIfTruncated);
  }, [app.description]);

  const imgSrc = useMemo(() => {
    if (app.vendorThumbnailUrl) return app.vendorThumbnailUrl;
    if (theme === "dark") return app.thumbnailDark || app.thumbnail;
    return app.thumbnailLight || app.thumbnail;
  }, [
    theme,
    app.vendorThumbnailUrl,
    app.thumbnailDark,
    app.thumbnailLight,
    app.thumbnail,
  ]);

  const vendorInitials = useMemo(
    () =>
      app.vendorName
        .split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [app.vendorName],
  );

  const isConnectedOrIncluded = isSubscribed || app.isBuiltIn;
  const isNew = useMemo(
    () => !isConnectedOrIncluded && isNewListedApp(app.createdDate),
    [isConnectedOrIncluded, app.createdDate],
  );

  const dropdownItems = useMemo<AppCardDropdownItem[]>(() => {
    if (isOwnerCard) return submissionDropdownItems ?? [];
    if (!isSubscribed || app.isBuiltIn) return [];
    const items: AppCardDropdownItem[] = [];
    if (onOpenApp) items.push({ label: "Open App", onClick: onOpenApp });
    if (onRate) items.push({ label: "Rate App", onClick: onRate });
    if (onDisconnect) {
      items.push({ label: "Disconnect", onClick: onDisconnect, color: "#E03C3C" });
    }
    return items;
  }, [
    isOwnerCard,
    submissionDropdownItems,
    isSubscribed,
    app.isBuiltIn,
    onOpenApp,
    onRate,
    onDisconnect,
  ]);

  const descriptionElement = (
    <div ref={descriptionRef} className="text-xs text-ds-text-body line-clamp-3">
      {app.description || (
        <span className="italic text-ds-text-caption">No description yet</span>
      )}
    </div>
  );

  // Owner cards are not click-to-open (drafts have no consumer detail view);
  // their explicit footer buttons drive the actions instead.
  const interactiveProps = isOwnerCard
    ? {}
    : {
        role: "button" as const,
        tabIndex: 0,
        onClick: onOpenDetails,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetails();
          }
        },
      };

  return (
    <div
      {...interactiveProps}
      className={cn(
        "bg-general-bg-primary border border-general-border-secondary",
        "rounded p-3 flex flex-col transition-colors",
        isOwnerCard
          ? "cursor-default"
          : "hover:border-general-border-primary cursor-pointer",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 flex items-center justify-center bg-general-bg-secondary border border-general-border-secondary">
          {imgSrc && !imageError ? (
            <img
              src={imgSrc}
              alt={app.vendorName}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-ds-text-heading font-bold text-xs">
              {vendorInitials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {app.category && (
            <div className="subtitle-2xs-medium uppercase tracking-widest text-ds-text-caption line-clamp-1">
              {app.category}
            </div>
          )}
          <h3 className="text-sm font-bold text-ds-text-heading line-clamp-1">
            {app.appName}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!submission && isNew && (
            <Tag color="dark-blue" className="shrink-0">
              New
            </Tag>
          )}
          {dropdownItems.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <AppCardDropdown items={dropdownItems} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {app.tagline && (
          <p className="body-sm-medium text-ds-text-heading line-clamp-2">
            {app.tagline}
          </p>
        )}
        {isDescriptionTruncated ? (
          <Tooltip message={app.description} position="top" className="max-w-[300px]">
            {descriptionElement}
          </Tooltip>
        ) : (
          descriptionElement
        )}
      </div>

      {submission?.status === "rejected" && submission.rejectionFeedback && (
        <Tooltip
          message={submission.rejectionFeedback}
          position="top"
          className="max-w-[300px]"
        >
          <div className="mt-2 flex w-fit items-center gap-1 text-xs text-alert-error">
            <Icon id="warning-icon" className="h-3.5 w-3.5 shrink-0" />
            <span className="underline decoration-dotted">Why was this rejected?</span>
          </div>
        </Tooltip>
      )}

      <div className="mt-auto pt-3">
        <div className="border-t border-general-border-secondary" />
        <div
          className="mt-3 flex items-center justify-between gap-2 cursor-auto!"
          onClick={(e) => e.stopPropagation()}
        >
          {submission ? (
            <OwnerFooter
              submission={submission}
              onSubmitListing={onSubmitListing}
              onUpdateListing={onUpdateListing}
              onOpenDetails={onOpenDetails}
            />
          ) : (
            <>
              <Button
                variant={isConnectedOrIncluded || isLite ? "outlined" : "secondary"}
                size="xs"
                onClick={onOpenDetails}
              >
                {isConnectedOrIncluded || isLite ? "View Details" : "Connect App"}
              </Button>
              {app.isBuiltIn ? (
                <span className="flex items-center gap-1 text-xs font-normal text-tag-blue-label">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Included
                </span>
              ) : isSubscribed ? (
                <span className="flex items-center gap-1 text-xs font-normal text-alert-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Connected
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OwnerFooter({
  submission,
  onSubmitListing,
  onUpdateListing,
  onOpenDetails,
}: {
  submission: MarketplaceSubmission;
  onSubmitListing?: () => void;
  onUpdateListing?: () => void;
  onOpenDetails: () => void;
}) {
  const status = FOOTER_STATUS[submission.status];

  return (
    <>
      {submission.status === "approved" ? (
        <div className="flex items-center gap-2">
          <Button variant="outlined" size="xs" onClick={onOpenDetails}>
            View Details
          </Button>
          {onUpdateListing && (
            <Button variant="secondary" size="xs" onClick={onUpdateListing}>
              Update listing
            </Button>
          )}
        </div>
      ) : (
        <Button variant="secondary" size="xs" onClick={onSubmitListing}>
          Edit submission
        </Button>
      )}
      <div className="flex items-center gap-2">
        {/* A live listing and its in-review revision are sibling cards with the
            same name — the version is what tells them apart. */}
        <span className="text-xs text-ds-text-caption">v{submission.version}</span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-normal",
            status.className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </div>
    </>
  );
}
