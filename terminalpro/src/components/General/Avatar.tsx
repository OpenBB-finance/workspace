import { cva, type VariantProps } from "class-variance-authority";
import isEqual from "lodash.isequal";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  convertHeadersToRecord,
  type QueryOptions,
  type TResponseCb,
  useJsonData,
} from "~/lib/api";
import type { Selector } from "~/lib/state/app";
import type { Source } from "~/lib/state/backendConnector";
import { Avatar as DSAvatar } from "../ds/atoms/Avatar";
import { cn } from "../ds/utils";

const avatarVariants = cva(
  [
    "BB-Avatar relative flex aspect-square shrink-0 overflow-hidden rounded-full",
    "bg-transparent dark:text-white text-black",
  ],
  {
    variants: {
      variant: {
        xs: "subtitle-2xs-medium w-6",
        sm: "body-xs-medium w-8",
        md: "subtitle-sm-medium w-10",
        lg: "subtitle-md-medium w-12",
        noVariant: "",
      },
    },
    defaultVariants: {
      variant: "sm",
    },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src: string;
  alt: string;
  fallback?: ReactNode;
  className?: string;
  size?: number;
  extraClassName?: string;
  withVariantCva?: boolean;
  imageClassName?: string;
  onError?: () => void;
  headers?: Record<string, string>;
  cacheKey?: string;
}

function alternativeText(alt: string) {
  if (!alt || typeof alt !== "string") return;
  const words = alt.trim().split(" ");
  if (words.length === 1) return alt.slice(0, 2).toUpperCase();

  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const responseCb: TResponseCb<string> = async (response, resolve, reject) => {
  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text") || contentType.includes("application/json")) {
      const textContent = await response.text();
      if (textContent.startsWith("data:")) return resolve(textContent);

      if (/^[A-Za-z0-9+/]+=*$/.test(textContent.substring(0, 100))) {
        const dataUri = `data:${contentType};base64,${textContent}`;

        return resolve(dataUri);
      }
    }

    const imageBlob = await response.blob();
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(imageBlob);
  } catch (err) {
    reject("Failed to load image");
  }
};

export const Avatar = memo((props: AvatarProps) => {
  const {
    src,
    alt,
    withVariantCva = true,
    variant,
    size = 24,
    className = "inline-flex items-center justify-center rounded-[2px]",
    extraClassName = "",
    imageClassName = "",
    fallback,
    headers,
    cacheKey = src,
  } = props;

  const { isBase64OrLocal, enabled, setError } = useShallowAvatarStore((state) => ({
    isBase64OrLocal: src?.startsWith("data:") || src?.startsWith("/"),
    enabled: !!src && !state.isError(cacheKey),
    setError: state.setError,
  }));

  const onError = useCallback(() => {
    setError(cacheKey);
    if (props.onError) props.onError();
  }, [setError, cacheKey, props.onError]);

  const queryOptions = useMemo<QueryOptions<string>>(
    () => ({
      url: src,
      endpointHeaders: headers,
      queryKey: [cacheKey],
      responseCb,
    }),
    [src, headers, cacheKey],
  );

  const { data, isLoading, isError } = useJsonData<string>(queryOptions, {
    enabled: enabled && !isBase64OrLocal,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: false,
    retry: false,
    placeholderData: (prevData, prevQuery) => {
      if (prevData) return prevData;
      if (isBase64OrLocal) return src;
      if (prevQuery?.state?.data) return prevQuery.state.data;
      return src;
    },
  });

  const canRender = enabled && (!isLoading || isError);

  const { corsFallback, imgFallback } = useMemo(() => {
    const props = { src, alt, size: variant };
    const imgFallback = fallback ?? alternativeText(alt);

    const corsFallback = (
      <DSAvatar
        {...props}
        key={src}
        fallback={imgFallback}
        className={cn(
          "bg-transparent dark:text-white text-black",
          className,
          extraClassName,
        )}
        delayMs={100}
      />
    );

    return { corsFallback, imgFallback };
  }, [src, alt, variant, fallback, className, extraClassName]);

  return (
    <span
      style={
        withVariantCva && size && !variant ? { width: size, height: size } : undefined
      }
      className={cn(
        withVariantCva && avatarVariants({ variant }),
        className,
        extraClassName,
      )}
      data-testid="avatar"
    >
      {canRender ? (
        <img
          src={data || src}
          alt={alt}
          decoding="async"
          draggable={false}
          className={imageClassName}
          onError={onError}
        />
      ) : isLoading || enabled ? (
        imgFallback
      ) : (
        corsFallback
      )}
    </span>
  );

  // return (
  //   <AvatarPrimitive.Root
  //     className={clsx(
  //       "inline-flex items-center justify-center rounded-[2px]",
  //       extraClassName,
  //     )}
  //     data-testid="avatar"
  //     style={{ width: size, height: size }}
  //   >
  //     <AvatarPrimitive.Image src={src} alt={alt} />
  //     <AvatarPrimitive.Fallback delayMs={300}>
  //       {alt?.slice(0, 2)}
  //     </AvatarPrimitive.Fallback>
  //   </AvatarPrimitive.Root>
  // );
});

interface AuthenticatedAvatar
  extends Omit<
    AvatarProps,
    "imageClassName" | "withVariantCva" | "headers" | "variant" | "size"
  > {
  source?: Source;
}

export const AuthenticatedAvatar = memo<AuthenticatedAvatar>((props) => {
  const { src, source, className, ...rest } = props;

  const processedUrl = useMemo(() => {
    if (!src) return undefined;

    if (src.startsWith("data:")) return src;

    const hasUrlPrefix =
      src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/");

    if (!hasUrlPrefix) {
      const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
      const looksLikeBase64 = base64Pattern.test(src.trim());

      if (looksLikeBase64) return `data:image/png;base64,${src}`;
    }

    return src;
  }, [src]);

  const { url, headers } = useMemo(() => {
    const output = { url: processedUrl, headers: {} as Record<string, string> };
    if (!processedUrl) return output;
    const isSourceBackend = source?.url && processedUrl.includes(source.url);
    if (!isSourceBackend) return output;

    let headers: Record<string, string> = {};

    if (isSourceBackend && source?.endpointHeaders) {
      const { headers: sourceHeaders } = convertHeadersToRecord(source.endpointHeaders);
      headers = { ...headers, ...sourceHeaders };
    }
    output.headers = headers;
    return output;
  }, [processedUrl, source]);

  return (
    <Avatar
      {...rest}
      className="w-full h-full rounded-none!"
      imageClassName={className}
      src={url}
      headers={headers}
      withVariantCva={false}
      cacheKey={url?.startsWith("data:") ? `${source?.uuid}-${rest.alt}` : url}
    />
  );
});

interface AvatarState {
  errors: Record<string, number>;
  setError: (src: string) => void;
  isError: (src: string) => boolean;
}

export const useAvatarStore = createWithEqualityFn<AvatarState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        errors: {},
        setError: (src) =>
          set((state) => ({
            errors: { ...state.errors, [src]: Date.now() + 60 * 5 * 1000 },
          })),
        isError: (src) => {
          const { errors } = get();
          return !!errors[src] && errors[src] > Date.now();
        },
      }),
      {
        version: 2,
        name: "obb_image_load",
        storage: createJSONStorage(() => ({
          getItem: (name) => {
            const item = localStorage.getItem(name);

            return item ? JSON.parse(atob(item)) : null;
          },
          setItem: (name, value) => {
            localStorage.setItem(name, btoa(JSON.stringify(value)));
          },
          removeItem: (name) => localStorage.removeItem(name),
        })),
        onRehydrateStorage: () => (state) => {
          if (state) {
            const { errors = {} } = state;
            const now = Date.now();

            const filteredErrors = Object.fromEntries(
              Object.entries(errors).filter(([, expiry]) => expiry > now),
            );

            state.errors = filteredErrors;
          }
        },
        migrate: (persistedState, version) => {
          if (version < 2) {
            const { errors = {} } = persistedState as AvatarState;
            const now = Date.now();
            for (const key in errors) {
              errors[key] = now + 60 * 5 * 1000;
            }
            return { errors };
          }
          return persistedState;
        },
      },
    ),
  ),
);

export function useShallowAvatarStore<S extends AvatarState, T>(
  selector: Selector<S, T>,
): T {
  return useAvatarStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

export default Avatar;
