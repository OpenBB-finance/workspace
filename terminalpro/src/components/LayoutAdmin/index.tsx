import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Navigate, Outlet } from "react-router-dom";
import { usePrivateRoute } from "~/hooks/usePrivateRoute";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/Resizable";
import AdminSidebar from "./AdminSidebar";
import "~/admin.css";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { validateAdminAccess } from "~/api/admin.api";
import NoItems from "~/components/LayoutAuth/NoItems";
import useSyncItems from "~/components/LayoutAuth/useSyncItems";
import { useShallowAppStore } from "~/lib/state/app";

export const MAX_DRAWER_WIDTH_PERCENT = 0.2;

function useAuthKeyPresses() {
  const themeStore = useShallowThemeStore((state) => ({
    toggleTheme: state.toggleTheme,
    debouncedUpdateSettings: state.debouncedUpdateSettings,
  }));

  useEffect(() => {
    const handleKeypress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 77) {
        // cmd + m
        e.preventDefault();
        themeStore.toggleTheme();
        themeStore.debouncedUpdateSettings();
      }
    };

    document.addEventListener("keydown", handleKeypress);
    return () => document.removeEventListener("keydown", handleKeypress);
  }, [themeStore]);
}

function usePanelEvents(leftPanelRef: RefObject<ImperativePanelHandle>) {
  const toggleLeftSidebar = useCallback(() => {
    if (leftPanelRef.current) {
      leftPanelRef.current.getSize() <= 4
        ? leftPanelRef.current.resize(8)
        : leftPanelRef.current.resize(4);
    }
  }, [leftPanelRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        if (event.key === "b") {
          event.preventDefault();
          toggleLeftSidebar();
        } else if (event.key === "l") {
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeftSidebar]);
}

function useHasAdminAccess() {
  const admin_access = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.admin_access,
  );
  const { error, isLoading } = useQuery<any, AxiosError>({
    queryKey: ["admin", "validate-access"],
    queryFn: validateAdminAccess,
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 15, // 15 minutes
    notifyOnChangeProps: ["error", "isLoading"],
  });

  return useMemo(() => {
    const forbidden = error?.response?.status === 403;
    const output = { hasAdminAccess: admin_access && !forbidden, isLoading };
    return output;
  }, [error, isLoading, admin_access]);
}

export default function LayoutAdmin({ children }: { children?: ReactNode }) {
  usePrivateRoute();
  useAuthKeyPresses();
  useSyncItems();

  const [expanded, dispatch] = useStateReducer({
    left: true,
    collapsedLeft: false,
  });

  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  usePanelEvents(leftPanelRef);

  const needsOnboarding = useAuthStore((state) => state.needsOnboarding);
  const hasItems = useShallowAppStore((state) => state.hasItems || !!state.rootItem);

  const { hasAdminAccess, isLoading } = useHasAdminAccess();

  useEffect(() => {
    if (hasItems && !hasAdminAccess && !isLoading) {
      toast.error("Permission denied", {
        description: "You don't have permission to access this page",
      });
    }
  }, [hasAdminAccess, isLoading]);

  if (!hasItems || isLoading) return <NoItems />;
  if (needsOnboarding) return <Navigate to="/onboarding" />;
  if (!hasAdminAccess) return <Navigate to="/app" />;
  return (
    <ResizablePanelGroup
      direction="horizontal"
      id="group"
      autoSaveId="persistence-admin"
    >
      <ResizablePanel
        ref={leftPanelRef}
        onCollapse={() => dispatch({ left: false, collapsedLeft: true })}
        onResize={(size) => {
          const updateState = { left: size > 5 } as typeof expanded;
          if (size >= 2) updateState.collapsedLeft = false;
          dispatch(updateState);
        }}
        collapsible={true}
        defaultSize={14}
        collapsedSize={0}
        minSize={4}
        maxSize={30}
        id="left-panel"
      >
        <AdminSidebar expandedState={expanded} />
      </ResizablePanel>

      <ResizableHandle
        type="left"
        withHandle={true}
        collapsed={expanded.collapsedLeft}
        onClick={() => {
          leftPanelRef.current?.expand();
        }}
      />
      <ResizablePanel
        minSize={40}
        defaultSize={82}
        id="middle-panel"
        className="relative"
      >
        <main
          id="workarea"
          className="flex h-screen w-full flex-col overflow-x-hidden bg-surface-page"
        >
          {children ? children : <Outlet />}
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
