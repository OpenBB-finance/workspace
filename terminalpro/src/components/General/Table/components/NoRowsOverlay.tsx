import type { CustomNoRowsOverlayProps } from "ag-grid-react";
import { useEffect, useState } from "react";
import Icon from "~/components/Icon";

export function NoRowsOverlay({ api }: CustomNoRowsOverlayProps) {
  const [hasActiveFilters, setHasActiveFilters] = useState(
    () => Object.keys(api.getFilterModel?.() ?? {}).length > 0,
  );

  useEffect(() => {
    const handler = () => {
      setHasActiveFilters(Object.keys(api.getFilterModel?.() ?? {}).length > 0);
    };
    api.addEventListener("filterChanged", handler);
    return () => {
      if (api.isDestroyed()) return;
      api.removeEventListener("filterChanged", handler);
    };
  }, [api]);

  const clearFilters = () => {
    api.setFilterModel(null);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Icon
        id={hasActiveFilters ? "filter" : "search"}
        className="w-6 h-6 text-ds-text-caption"
      />
      <p className="body-sm-medium text-ds-text-body">
        {hasActiveFilters ? "No rows match the active filters" : "No rows to display"}
      </p>
      {hasActiveFilters && (
        <p className="body-xs-regular text-ds-text-caption">
          Try adjusting or clear all the filters
        </p>
      )}
    </div>
  );
}
