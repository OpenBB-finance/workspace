import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

export type PanelsState = {
  left: boolean;
  right: boolean;
  collapsedRight: boolean;
  collapsedLeft: boolean;
  adminleft: boolean;
  admincollapsedLeft: boolean;
};

type PanelSide = keyof PanelsState;

const initialState: PanelsState = {
  left: true,
  right: false,
  collapsedRight: false,
  collapsedLeft: false,
  adminleft: true,
  admincollapsedLeft: false,
};

export function usePanelsState(side: PanelSide) {
  const pathname = useLocation()?.pathname;
  const sideKey = useMemo(
    () => (pathname?.startsWith("/admin") ? `admin${side}` : side) as PanelSide,
    [pathname?.startsWith("/admin"), side],
  );
  const [expanded] = useLocalStorage("workspace-panels", initialState);

  const expandedSide = useMemo(() => expanded[sideKey], [expanded, sideKey]);

  return expandedSide;
}

export function useLayoutPanelsState() {
  return useLocalStorage("workspace-panels", initialState);
}
