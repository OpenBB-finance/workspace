import { memo, useCallback, useMemo, useRef } from "react";
import "swiper/swiper-bundle.css";
import type { Swiper as SwiperType } from "swiper";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { cn } from "~/components/ds/utils";
import Avatar from "~/components/General/Avatar";
import Icon from "~/components/Icon";
import { useStateReducer } from "~/hooks/useStateReducer";

type MediaType = "image" | "video" | "youtube";

function classifyMediaItem(url: string): MediaType {
  try {
    const hostname = new URL(url).hostname;
    if (/(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/.test(hostname)) return "youtube";
  } catch {
    // invalid URL, treat as image
  }
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)) return "video";
  return "image";
}

function getYouTubeEmbedUrl(url: string): string {
  try {
    let videoId = "";
    if (url.includes("youtu.be")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0] ?? "";
    } else if (url.includes("youtube.com/watch")) {
      const urlParams = new URLSearchParams(new URL(url).search);
      videoId = urlParams.get("v") ?? "";
    } else if (url.includes("youtube.com/embed")) {
      videoId = url.split("embed/")[1]?.split("?")[0] ?? "";
    }
    if (!videoId) return "";
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return "";
  }
}

interface MediaCarouselProps {
  items: string[];
  className?: string;
  appName?: string;
}

/** @deprecated Use MediaCarousel instead */
export function ScreenshotsCarousel({
  screenshots,
  className,
  appName,
}: {
  screenshots: string[];
  className?: string;
  appName?: string;
}) {
  return <MediaCarousel items={screenshots} className={className} appName={appName} />;
}

const MediaSlide = memo(
  ({
    url,
    index,
    appName,
    onError,
  }: {
    url: string;
    index: number;
    appName: string;
    onError: (index: number) => void;
  }) => {
    const mediaType = useMemo(() => classifyMediaItem(url), [url]);

    const slideContainer =
      "relative w-full aspect-video overflow-hidden flex items-center justify-center rounded";

    if (mediaType === "youtube") {
      const embedUrl = getYouTubeEmbedUrl(url);
      if (!embedUrl) return null;
      return (
        <div className={slideContainer}>
          <iframe
            src={embedUrl}
            title={`${appName} video ${index + 1}`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }

    if (mediaType === "video") {
      return (
        <div className={slideContainer}>
          <video
            src={url}
            controls
            preload="metadata"
            className="w-full h-full object-contain"
            aria-label={`${appName} video ${index + 1}`}
          >
            <track kind="captions" />
          </video>
        </div>
      );
    }

    return (
      <div className={slideContainer}>
        <Avatar
          src={url}
          alt={`${appName} screenshot ${index + 1}`}
          withVariantCva={false}
          className="rounded-none!"
          imageClassName="w-full h-full object-scale-down"
          onError={() => onError(index)}
          fallback={
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-ds-text-caption">
              <Icon id="material-symbols-image-outline" className="w-8 h-8" />
              <span className="text-xs">Failed to load image</span>
            </div>
          }
        />
      </div>
    );
  },
);

export function MediaCarousel({
  items,
  className,
  appName = "App",
}: MediaCarouselProps) {
  const swiperRef = useRef<SwiperType | null>(null);
  const [state, dispatch] = useStateReducer({
    currentSlide: 0,
    imageErrors: {} as Record<number, boolean>,
  });

  const handleImageError = useCallback((index: number) => {
    dispatch({ imageErrors: (prev) => ({ ...prev, [index]: true }) });
  }, []);

  const handlePrev = useCallback(() => {
    swiperRef.current?.slidePrev();
  }, []);

  const handleNext = useCallback(() => {
    swiperRef.current?.slideNext();
  }, []);

  const visibleItems = useMemo(
    () => items.filter((_, index) => !state.imageErrors[index]),
    [items, state.imageErrors],
  );

  if (!items || items.length === 0 || visibleItems.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative group">
        <Swiper
          grabCursor={true}
          modules={[Pagination]}
          loop={items.length > 1}
          className="w-full rounded-lg overflow-hidden"
          slidesPerView={1}
          spaceBetween={16}
          speed={300}
          autoHeight={false}
          onSlideChange={(swiper) => dispatch({ currentSlide: swiper.realIndex })}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
        >
          {items.map((url, index) => (
            <SwiperSlide key={`media-${index}`}>
              <MediaSlide
                url={url}
                index={index}
                appName={appName}
                onError={handleImageError}
              />
            </SwiperSlide>
          ))}
        </Swiper>

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full dark:bg-brand-main/80 bg-brand-darker/80 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous slide"
            >
              <Icon id="chevron-left" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full dark:bg-brand-main/80 bg-brand-darker/80 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next slide"
            >
              <Icon id="chevron-right" className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {items.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === state.currentSlide
                  ? "bg-brand-main"
                  : "bg-general-border-secondary hover:bg-general-border-primary",
              )}
              onClick={() => swiperRef.current?.slideTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
