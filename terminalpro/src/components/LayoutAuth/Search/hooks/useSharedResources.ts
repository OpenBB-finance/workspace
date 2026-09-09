import { useEffect, useMemo } from "react";
import { useUserResourcePermissions } from "~/hooks/useUserResourcePermissions";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import type { WidgetItem } from "../WidgetMenu";

export default function UseSharedResources() {
  const search = useShallowThemeStore((s) => s.search);
  const { getApiSourceById, getStoredFileById } = useShallowBackendConnectorStore(
    (s) => ({
      getApiSourceById: s.getApiSourceById,
      getStoredFileById: s.getStoredFileById,
    }),
  );

  const { data: sharedResources, refetch } = useUserResourcePermissions();

  useEffect(() => {
    if (search) refetch();
  }, [search]);

  const sharedWidgets = useMemo(() => {
    const { backends = [], files = [] } = sharedResources || {};
    const sharedBackendWidgets = backends.flatMap((backend) =>
      getApiSourceById(backend.uuid)
        ? []
        : Object.values(backend.widgets)?.map(
            (widget) =>
              ({
                ...widget,
                id: `shared-${widget.name}-${backend.uuid}`,
                uniqueId: `shared-${widget.name}-${backend.uuid}`,
                category: "Shared Backends",
                subCategory: backend.name,
                widgetType: "backend",
                isSharedWidget: true,
              }) as WidgetItem,
          ),
    );

    const sharedFileWidgets = files
      .filter((file) => !getStoredFileById(file.uuid))
      .map(
        (file) =>
          ({
            widgetId: `shared_file-${file.uuid}`,
            id: `shared_file-${file.uuid}`,
            uniqueId: `shared_file-${file.uuid}`,
            name: file.name,
            category: "Shared Files",
            widgetType: "file",
            connectionType: "file",
            description: file.description || `Shared file: ${file.name}`,
            extension: file.url ? file.url.split(".").pop() : "other",
            sourceId: file.uuid,
            url: file.url,
            external: true,
            endpoint: {
              url: file.url,
              method: "GET",
              headers: {},
              query: {},
            },
            isSharedWidget: true,
          }) as WidgetItem,
      );

    return [...sharedBackendWidgets, ...sharedFileWidgets];
  }, [sharedResources]);

  return sharedWidgets;
}
