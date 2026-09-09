interface ExportProgressProps {
  current: number;
  total: number;
  label: string;
  /** Sub-progress for nested operations (e.g., tabs within dashboards) */
  subProgress?: {
    current: number;
    total: number;
    label: string;
  };
}

export function ExportProgress({
  current,
  total,
  label,
  subProgress,
}: ExportProgressProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ds-text-body">
          {label} ({current}/{total})
        </p>
        <div className="h-2 bg-general-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-main transition-all duration-300"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>
      {subProgress && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ds-text-body">
            {subProgress.label} ({subProgress.current}/{subProgress.total})
          </p>
          <div className="h-1.5 bg-general-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-main/70 transition-all duration-300"
              style={{ width: `${(subProgress.current / subProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
