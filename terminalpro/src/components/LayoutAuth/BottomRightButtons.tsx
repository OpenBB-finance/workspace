import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import useIsMobile from "~/hooks/useIsMobile";
import { isTabPath } from "~/lib/utils";
import AddWidgetMenu from "./AddWidgetMenu";
import DashboardToolbar from "./DashboardToolbar";

export default function BottomRightButtons() {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const isTab = useMemo(() => isTabPath(pathname), [isTabPath(pathname)]);

  return useMemo(
    () => (
      <>
        {isTab && isMobile && <AddWidgetMenu />}
        {isTab && !isMobile && <DashboardToolbar />}
      </>
    ),
    [isMobile, isTab],
  );
}
