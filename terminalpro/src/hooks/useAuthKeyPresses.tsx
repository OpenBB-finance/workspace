import { useCallback, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import { saveDashboards } from "~/api/dashboard.api";
import { isCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import { useDataConnectorContext } from "~/components/DataConnectors/Providers/DataConnectorContext";
import { usePanelsState } from "~/components/LayoutAuth/AppLayout/hooks/usePanelsState";
import { useShallowAppStore } from "~/lib/state/app";
import { useCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { dispatchSaveState } from "~/lib/utils";
import { createTab } from "~/lib/utils/app";

const useAuthKeyPresses = () => {
  const { setOpen } = useDataConnectorContext();
  const themeStore = useShallowThemeStore((state) => ({
    toggleGroupingVisibility: state.toggleGroupingVisibility,
    toggleTheme: state.toggleTheme,
    togglePresenterMode: state.togglePresenterMode,
    toggleShortcutSidebar: state.toggleShortcutSidebar,
    toggleSearch: state.toggleSearch,
    setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
    setCreateFolderPopup: state.setCreateFolderPopup,
    debouncedUpdateSettings: state.debouncedUpdateSettings,
  }));

  const rightPanelCollapsed = usePanelsState("collapsedRight");

  const addTab = useShallowAppStore((state) => state.addTab);

  // const { id } = useParams();

  //const { undo, redo, clear } = useAppTemporalStore((state) => state);

  const debouncedSave = useDebouncedCallback(saveDashboards, 200, {
    leading: true,
    maxWait: 200,
  });

  const handleKeypress = useCallback(
    async (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        (e.key === "ArrowRight" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        // shift key
        //tab.data.widgets
      }
      if (e.keyCode === 27) {
        // escape
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 71) {
        // cmd + g
        e.preventDefault();
        themeStore.toggleGroupingVisibility();
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 75) {
        // cmd + k
        e.preventDefault();
        themeStore.setInitialSelectedSearchTab("widgets");

        themeStore.toggleSearch();
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 76) {
        // cmd + l
        e.preventDefault();
        if (isCopilotAvailable()) {
          const {
            isFullscreen,
            lastPanelState,
            toggleFullscreen,
            setLastPanelState,
            setIsIntentionallyCollapsed,
          } = useCopilotStore.getState();
          if (isFullscreen) {
            // Ctrl+L from fullscreen always goes to normal open
            setIsIntentionallyCollapsed(false);
            toggleFullscreen();
            // After exiting fullscreen, ensure panel stays open at normal size
            setTimeout(() => {
              if (document.getElementById("expand-copilot-btn")) {
                document.getElementById("expand-copilot-btn")?.click();
              }
            }, 50);
          } else if (rightPanelCollapsed) {
            // Panel is closed, so open it to the last state
            if (lastPanelState === "fullscreen") {
              toggleFullscreen(); // this will trigger useEffect in RightSidePanel to expand
            } else {
              document.getElementById("toggle-copilot-btn")?.click();
            }
            setTimeout(() => {
              document.getElementById("copilot-input")?.focus();
            }, 200);
          } else {
            // Panel is in normal open state, so close it
            setLastPanelState("open");
            document.getElementById("toggle-copilot-btn")?.click();
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 85) {
        // cmd + u - maximize/minimize AI copilot
        e.preventDefault();
        if (isCopilotAvailable()) {
          const { isFullscreen, toggleFullscreen, setIsIntentionallyCollapsed } =
            useCopilotStore.getState();

          if (rightPanelCollapsed) {
            // Hidden → Fullscreen
            setIsIntentionallyCollapsed(false);
            toggleFullscreen();
          } else if (isFullscreen) {
            // Fullscreen → Hidden (always)
            toggleFullscreen();
            setIsIntentionallyCollapsed(true);
          } else {
            // Normal Open → Fullscreen
            toggleFullscreen();
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 66) {
        // cmd + b
        e.preventDefault();
        document.getElementById("toggle-left-sidebar-btn")?.click();
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 77) {
        // cmd + m
        e.preventDefault();
        themeStore.toggleTheme();
        themeStore.debouncedUpdateSettings();
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 70 && e.shiftKey) {
        // cmd + shift + f
        e.preventDefault();
        themeStore.togglePresenterMode();
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 72) {
        // cmd + h
        e.preventDefault();
        themeStore.toggleShortcutSidebar();
      }

      // if ((e.ctrlKey || e.metaKey) && e.keyCode === 90) {
      //   // cmd + z
      //   e.preventDefault();
      //   //undo();
      // }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 67 && e.shiftKey) {
        // cmd + shift + c
        e.preventDefault();
        setOpen(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 84 && e.altKey) {
        // cmd + alt + t
        e.preventDefault();
        createTab(addTab);
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 70 && e.altKey) {
        // cmd + alt + f
        e.preventDefault();
        themeStore.setCreateFolderPopup(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.keyCode === 83 && e.shiftKey) {
        // cmd + shift + s
        e.preventDefault();
        dispatchSaveState().then(() => debouncedSave({ withNotification: true }));
      }

      /*if ((e.ctrlKey || e.metaKey) && e.keyCode === 68) {
        // cmd + d
        e.preventDefault();
        if (!id) {
          notify({
            title: "No tab selected",
            body: "Please select a dashboard first",
          });
          toast("No tab selected");
          return;
        }
        let lastWidgetId = null;
        const { selectedWidgetIds } = useSelectedWidgetsStore.getState();
        for (const index in selectedWidgetIds) {
          const widget = getWidgetById(selectedWidgetIds[index]);
          if (!widget) {
            notify({
              title: "No widget selected",
              body: "Please select a widget first",
            });
            return;
          }

          lastWidgetId = uuidv4();

          addWidget(id, {
            ...widget,
            id: lastWidgetId,
          } as any);
          notify({
            title: "Widget duplicated",
            body: "The widget has been duplicated and added to the bottom of the tab",
          });
        }

        setTimeout(() => {
          const widgetEl = document.getElementById(lastWidgetId);
          if (widgetEl) {
            widgetEl.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center",
            });
          }
        }, 100);
      }*/
    },
    [themeStore, debouncedSave, rightPanelCollapsed],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener("keydown", handleKeypress, { signal: ctrl.signal });
    return () => ctrl.abort();
  }, [handleKeypress]);
};

export default useAuthKeyPresses;

/*
      //document.getElementById("audio")?.play();

 else {
        if ((e.ctrlKey || e.metaKey) && e.keyCode >= 48 && e.keyCode <= 57) {
          e.preventDefault();
          const number = e.keyCode - 48;
          //setActiveDashboardByNumber(number - 1);
        }
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 78) {
          e.preventDefault();
          addTab({
            name: `Dashboard ${
              dashboards.filter((tab) => tab.type === "custom")
                .length + 1
            }`,
            type: "custom",
          });
        }

        // meta + arrow right
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 39) {
          e.preventDefault();
          //setActiveDashboardNext();
        }
        // meta + arrow left
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 37) {
          e.preventDefault();
          //setActiveDashboardPrevious();
        }
      }

      */
