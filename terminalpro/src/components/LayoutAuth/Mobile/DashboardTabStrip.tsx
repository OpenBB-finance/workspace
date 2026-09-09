import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useShallowAppStore } from "~/lib/state/app";
import { cn } from "~/lib/utils";

const TabButton = memo(
  ({
    tabIndex,
    name,
    isActive,
    activeRef,
    onNavigate,
  }: {
    tabIndex: string;
    name: string;
    isActive: boolean;
    activeRef: React.RefObject<HTMLButtonElement | null>;
    onNavigate: (tabIndex: string) => void;
  }) => {
    const handleClick = useCallback(() => onNavigate(tabIndex), [tabIndex, onNavigate]);

    return (
      <button
        ref={isActive ? activeRef : undefined}
        onClick={handleClick}
        className={cn(
          "flex-shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors",
          isActive
            ? "bg-btn-primary-bg text-btn-primary-label"
            : "bg-general-bg-secondary text-ds-text-body",
        )}
      >
        {name}
      </button>
    );
  },
);

export default function DashboardTabStrip() {
  const { id } = useParams();
  const navigate = useNavigate();

  const items = useShallowAppStore((state) => state.items);
  const tabs = useMemo(
    () => Object.values(items).filter((i) => !i.isFolder && i.data),
    [items],
  );

  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [id]);

  const handleNavigate = useCallback(
    (tabIndex: string) => navigate(`/app/${tabIndex}`),
    [navigate],
  );

  if (!id || tabs.length <= 1) return null;

  return (
    <div className="sticky top-0 z-40 flex gap-2 overflow-x-auto px-4 py-2 bg-surface-header border-b border-surface-divider hide-scrollbars">
      {tabs.map((tab) => (
        <TabButton
          key={tab.index}
          tabIndex={tab.index}
          name={tab.data?.name || "Untitled"}
          isActive={tab.index === id}
          activeRef={activeRef}
          onNavigate={handleNavigate}
        />
      ))}
    </div>
  );
}
