import { useEffect, useRef, useState } from "react";
import type { RefreshDataSettings } from "~/components/RefreshDataDialog";

const MIN_REFRESH_RATE = 10;

interface UseAutoRefreshReturn {
  isAutoRefreshing: boolean;
  nextRefreshIn: number;
}

export function useAutoRefresh(
  refreshData: RefreshDataSettings | undefined,
  onRefresh: () => void,
): UseAutoRefreshReturn {
  const [nextRefreshIn, setNextRefreshIn] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const isEnabled =
    refreshData?.refreshEnabled && refreshData?.refreshRate >= MIN_REFRESH_RATE;
  const refreshRateMs = (refreshData?.refreshRate ?? 0) * 1000;

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!isEnabled || refreshRateMs < MIN_REFRESH_RATE * 1000) {
      setNextRefreshIn(0);
      return;
    }

    setNextRefreshIn(refreshData.refreshRate);

    countdownRef.current = setInterval(() => {
      setNextRefreshIn((prev) => (prev <= 1 ? prev : prev - 1));
    }, 1000);

    intervalRef.current = setInterval(() => {
      setNextRefreshIn(refreshData.refreshRate);
      onRefresh();
    }, refreshRateMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isEnabled, refreshRateMs, refreshData?.refreshRate, onRefresh]);

  return {
    isAutoRefreshing: isEnabled,
    nextRefreshIn,
  };
}
