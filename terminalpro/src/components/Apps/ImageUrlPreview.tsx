import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import { HTTP_URL_RE } from "~/lib/utils/externalUrl";
import type { ImageUrlStatus } from "./useImageUrlStatuses";

interface ImageUrlPreviewProps {
  url: string;
  status: ImageUrlStatus | undefined;
  /** Thumbnail aspect: "square" for logos, "wide" (default) for covers/screenshots. */
  aspect?: "square" | "wide";
}

/**
 * Inline thumbnail + load status for an image-URL field. Renders nothing until
 * the URL looks like an http(s) link (format errors are the form's job). Once it
 * does, it shows the image and — via {@link useImageUrlStatuses} in the parent —
 * flags broken or non-public links (e.g. Google Drive share links) before submit.
 */
export function ImageUrlPreview({
  url,
  status,
  aspect = "wide",
}: ImageUrlPreviewProps) {
  const trimmed = url.trim();
  if (!HTTP_URL_RE.test(trimmed)) return null;

  return (
    <div className="flex items-center gap-2">
      {status !== "error" && (
        <img
          src={trimmed}
          alt=""
          className={cn(
            "h-10 shrink-0 rounded border border-general-border-secondary object-cover",
            aspect === "square" ? "aspect-square" : "aspect-[5/3]",
          )}
        />
      )}
      {status === "loading" && (
        <span className="flex items-center gap-1 body-xs-regular text-ds-text-caption">
          <Icon id="mdi-loading" className="size-3.5 shrink-0 animate-spin" />
          Checking image…
        </span>
      )}
      {status === "loaded" && (
        <span className="flex items-center gap-1 body-xs-regular text-alert-success">
          <Icon id="check-circle" className="size-3.5 shrink-0" />
          Image loads
        </span>
      )}
      {status === "error" && (
        <span className="flex items-start gap-1 body-xs-regular text-alert-error">
          <Icon id="warning-icon" className="mt-px size-3.5 shrink-0" />
          Couldn't load this image. Use a public direct image URL — Google Drive/Dropbox
          share links won't work.
        </span>
      )}
    </div>
  );
}
