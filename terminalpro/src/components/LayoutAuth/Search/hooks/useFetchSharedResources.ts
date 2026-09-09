import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useUserResourcePermissions } from "~/hooks/useUserResourcePermissions";

export default function useFetchSharedResources(isSharedResource?: boolean) {
  const { data, isFetching, refetch, isStale } = useUserResourcePermissions({
    enabled: isSharedResource,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const sharedResources = useMemo(() => {
    if (!data) return;
    const { backends = [], files = [], prompts = [] } = data;
    return {
      files,
      prompts,
      backends: backends.map((backend) => ({
        ...backend,
        widgets: Object.fromEntries(
          Object.entries(backend.widgets || {}).map(([key, widget]) => [
            key,
            {
              ...widget,
              endpoint: widget.endpoint.url.replace(`${backend.url}/`, ""),
            },
          ]),
        ),
        templates: backend.templates.map((template) => ({
          ...template,
          prompts: template.prompts.map((prompt) => {
            if (typeof prompt === "string") return prompt;

            return prompt?.promptId;
          }),
        })),
      })),
    };
  }, [data]);

  useEffect(() => {
    if (isFetching) return;
    if (isSharedResource && isStale) refetch();
  }, [isSharedResource]);

  return sharedResources;
}
