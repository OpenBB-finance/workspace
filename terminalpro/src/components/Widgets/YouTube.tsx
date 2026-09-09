import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";
import DraggableCard from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, getContrastColor } from "~/lib/utils";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { useWidgetContext } from "../Widget.context";
import { MarkdownContent } from "./custom/Markdown";

const youtubeSchema = z.object({
  url: z
    .url()
    .refine((url) => url.includes("youtube.com") || url.includes("youtu.be"), {
      message: "Must be a valid YouTube URL",
    }),
});

type YoutubeForm = z.infer<typeof youtubeSchema>;

const YouTubeUrlForm = ({
  form,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: UseFormReturn<YoutubeForm>;
  onSubmit: (values: YoutubeForm) => void;
  onCancel?: () => void;
  submitLabel: string;
}) => (
  <Form {...form}>
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="w-full h-full flex flex-col justify-center items-center p-4"
    >
      <div className="w-4/5">
        <FormField
          name="url"
          control={form.control}
          render={({ field }) => (
            <FormInput
              type="text"
              label="YouTube URL"
              placeholder="Enter the YouTube URL"
              {...field}
              className="w-full"
            />
          )}
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        {onCancel && (
          <Button onClick={onCancel} variant="outlined" type="button" size="sm">
            Cancel
          </Button>
        )}
        <Button variant={onCancel ? "primary" : "secondary"} type="submit" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  </Form>
);

export default function YouTube() {
  const { widget, updateWidget, isShared } = useWidgetContext();
  const [open, setOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const theme = useShallowThemeStore((state) => state.theme);

  // Backend mode: widget has an endpoint configured
  const isBackendMode = !!widget.endpoint?.url;
  // When raw=true, transcript comes from backend with ?raw=true parameter
  const backendTranscriptEnabled = !!widget.raw;

  // Transcript is only available when both backend mode and raw are enabled
  const hasTranscriptSupport = isBackendMode && backendTranscriptEnabled;

  // Build params for backend requests
  const backendParams = useMemo(() => {
    return Object.fromEntries(
      Object.entries({
        ...(widget.endpoint?.query ?? {}),
        ...(widget.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );
  }, [widget.endpoint?.query, widget.storage?.params]);

  // Fetch video URL from backend endpoint (only in backend mode)
  const backendVideoQuery = useJsonData<string>(
    {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: backendParams,
      addBearerToken: true,
      responseCb: async (response, resolve) => {
        const text = await response.text();
        return resolve(text.trim());
      },
    },
    {
      enabled: isBackendMode,
      staleTime: widget.staleTime ?? 1000 * 60 * 15,
    },
  );

  // Fetch transcript from backend (only when backend mode + raw enabled)
  const backendTranscriptQuery = useJsonData<string>(
    {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: { ...backendParams, raw: "true" },
      addBearerToken: true,
      responseCb: async (response, resolve) => {
        const text = await response.text();
        return resolve(text);
      },
    },
    {
      enabled: hasTranscriptSupport,
      staleTime: widget.staleTime ?? 1000 * 60 * 15,
    },
  );

  // Determine the video URL to use
  const url = isBackendMode
    ? backendVideoQuery.data || ""
    : widget.storage?.youtubeUrl || "";

  const form = useForm<YoutubeForm>({
    resolver: zodResolver(youtubeSchema),
    defaultValues: { url },
  });

  const onSubmit = (values: YoutubeForm) => {
    updateWidget((prev) => ({
      ...prev,
      storage: { ...prev.storage, youtubeUrl: values.url },
    }));
    setOpen(false);
  };

  // Determine loading state
  const isLoading = isBackendMode
    ? backendVideoQuery.isLoading ||
      (showTranscript && hasTranscriptSupport && backendTranscriptQuery.isLoading)
    : false;

  const getEmbedUrl = (url: string) => {
    try {
      let videoId = "";

      if (url.includes("youtu.be")) {
        videoId = url.split("youtu.be/")[1]?.split("?")[0];
      } else if (url.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get("v") || "";
      } else if (url.includes("youtube.com/embed")) {
        videoId = url.split("embed/")[1]?.split("?")[0];
      }

      if (!videoId) {
        throw new Error("Could not extract video ID");
      }

      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    } catch (error) {
      console.error("Error parsing YouTube URL:", error);
      return "";
    }
  };

  const [embedError, setEmbedError] = useState(false);

  // Reset embed error when URL changes
  useEffect(() => {
    setEmbedError(false);
  }, [url]);

  const color = useMemo(() => {
    const color = widget?.storage?.color;
    if (!color) return theme === "dark" ? "#fff" : "#000";
    return getContrastColor(color);
  }, [widget?.storage?.color, theme]);

  // Get params UI for backend widgets
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      title={widget.name}
      loading={isLoading || (isBackendMode && backendVideoQuery.isLoading)}
      aiEnabled={true}
      showAIContextButton={hasTranscriptSupport}
      aiData={hasTranscriptSupport ? backendTranscriptQuery.data : undefined}
      elementBelowNavbar={renderBelowNavbarRows}
      elementRightNextToTitle={renderRow0Params}
      extraNavbarElements={
        hasTranscriptSupport ? (
          <Tooltip message={showTranscript ? "Show video" : "Show transcript"}>
            <button
              type="button"
              onClick={() => setShowTranscript((prev) => !prev)}
              disabled={!url}
              className={cn("obb-small-navbar-btn flex items-center justify-center", {
                "bg-brand-main text-white hover:bg-brand-main dark:hover:bg-brand-main":
                  showTranscript,
              })}
            >
              <Icon id="transcript-icon" className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        ) : undefined
      }
      elementNextToTitle={
        url &&
        !isBackendMode && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => !isShared && setOpen(true)}
            className={cn({ "cursor-default": isShared })}
          >
            <Icon id="edit-03" />
            <span
              className="underline font-normal whitespace-nowrap truncate max-w-[400px]"
              title={url}
            >
              {url}
            </span>
          </Button>
        )
      }
      extraClassName="!p-0"
    >
      {url ? (
        <>
          {open && (
            <YouTubeUrlForm
              form={form}
              onSubmit={onSubmit}
              onCancel={() => setOpen(false)}
              submitLabel="Update"
            />
          )}
          {!open &&
            (showTranscript && hasTranscriptSupport ? (
              <div
                style={{
                  backgroundColor: widget?.storage?.color,
                  color,
                }}
                className="h-full w-full text-xs dark:bg-[#212126] overflow-y-auto px-3 py-2"
              >
                {backendTranscriptQuery.isLoading ? (
                  "Loading transcript..."
                ) : backendTranscriptQuery.error ? (
                  <span className="text-red-500">
                    Failed to load transcript from backend
                  </span>
                ) : backendTranscriptQuery.data ? (
                  <div className="prose-sm prose dark:prose-invert max-w-none">
                    <MarkdownContent content={backendTranscriptQuery.data} />
                  </div>
                ) : (
                  "No transcript available"
                )}
              </div>
            ) : embedError ? (
              <SearchResultsNotFound
                firstMessage="Unable to load video"
                secondMessage="This video might be private, deleted, or have embedding disabled."
              >
                {!isBackendMode && (
                  <Button
                    onClick={() => setOpen(true)}
                    variant="secondary"
                    size="xs"
                    className="mt-4"
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} id="edit-03" />
                    Edit URL
                  </Button>
                )}
              </SearchResultsNotFound>
            ) : (
              <iframe
                src={getEmbedUrl(url)}
                title={widget.name || "YouTube video"}
                width="100%"
                height="100%"
                className="border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen={true}
                onError={() => setEmbedError(true)}
                onLoad={() => setEmbedError(false)}
              />
            ))}
        </>
      ) : isBackendMode ? (
        // Backend mode but no URL yet - show loading or error
        <div className="w-full h-full flex flex-col justify-center items-center p-4">
          {backendVideoQuery.isLoading ? (
            <span className="text-ds-text-caption">Loading video...</span>
          ) : backendVideoQuery.error ? (
            <SearchResultsNotFound
              firstMessage="Failed to load video"
              secondMessage="Could not fetch video URL from backend endpoint."
            />
          ) : (
            <span className="text-ds-text-caption">
              No video URL returned from backend
            </span>
          )}
        </div>
      ) : (
        <YouTubeUrlForm form={form} onSubmit={onSubmit} submitLabel="Submit" />
      )}
    </DraggableCard>
  );
}
