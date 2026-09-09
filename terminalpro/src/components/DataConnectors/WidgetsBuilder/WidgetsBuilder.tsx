import { useCallback, useEffect } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/Resizable";
import { cn } from "~/lib/utils";
import { BackendWidgetSelector } from "./components/BackendWidgetSelector";
import { DataOriginSelector } from "./components/DataOriginSelector";
import { WidgetBuilderHeader } from "./components/WidgetBuilderHeader";
import { WidgetPreviewPanel } from "./components/WidgetPreviewPanel";
import JSONConfiguration from "./JSONConfiguration";
import UIConfiguration from "./UIConfiguration";
import { generateColumnDefinitionsFromData, isTableWidgetType } from "./utils";
import { useWidgetConfigContext, WidgetConfigProvider } from "./WidgetConfigContext";

export default function WidgetsBuilderRoot() {
  return (
    <WidgetConfigProvider>
      <WidgetsBuilder />
    </WidgetConfigProvider>
  );
}

export function WidgetsBuilder() {
  const context = useWidgetConfigContext((s) => ({
    getFormState: s.getFormState,
    dispatch: s.dispatchFormState,
    setWidgetConfig: s.setWidgetConfig,
    updateWidgetConfig: s.updateWidgetConfig,
    getWidgetConfig: s.getWidgetConfig,
    updateJsonFromConfig: s.updateJsonFromConfig,
  }));

  const state = useWidgetConfigContext((s) => ({
    activeConfigTab: s.formState.activeConfigTab,
    dataOrigin: s.formState.dataOrigin,
    previewData: s.formState.previewData,
  }));

  const handleTabChange = useCallback(
    (value: "ui" | "json") => {
      const { getFormState, updateJsonFromConfig, dispatch } = context;

      if (value === "json" && getFormState().activeConfigTab === "ui") {
        updateJsonFromConfig();
      }
      dispatch({ activeConfigTab: value });
    },
    [context],
  );

  // Auto-generate column definitions for table widgets
  useEffect(() => {
    if (!state.previewData) return;

    const config = context.getWidgetConfig();
    const isTableWidget = isTableWidgetType(config.type);
    let columnsDefs = config.columnsDefs;
    if (isTableWidget) {
      const generatedColumns = generateColumnDefinitionsFromData(state.previewData);

      if (!columnsDefs || columnsDefs.length === 0) {
        columnsDefs = generatedColumns;
      }
    }
    context.updateWidgetConfig({
      ...config,
      columnsDefs: columnsDefs || [],
    });
  }, [state.previewData, context]);

  return (
    <SettingsLayout title="Widget Studio" tabs={[]}>
      <div className="flex flex-col h-[calc(100vh-100px)]">
        <WidgetBuilderHeader />

        <DataOriginSelector />

        {state.dataOrigin === "existing_widget" && <BackendWidgetSelector />}

        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="widgets-builder-layout"
          className="flex-1 overflow-hidden px-6 min-h-0"
        >
          <ResizablePanel defaultSize={50} minSize={30} className="pr-3">
            <div
              className={cn(
                "flex flex-col bg-general-bg-primary rounded overflow-hidden h-full",
              )}
            >
              <Tabs
                variant="filled_secondary"
                value={state.activeConfigTab}
                onValueChange={handleTabChange}
                className="flex flex-col h-full"
              >
                <div className="p-6 flex-shrink-0">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ui">UI Configuration</TabsTrigger>
                    <TabsTrigger value="json">
                      JSON Configuration (Advanced)
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="ui"
                  className="mt-0 flex-1 overflow-y-auto max-h-[calc(100vh-200px)] px-0"
                >
                  <UIConfiguration />
                </TabsContent>

                <TabsContent value="json" className="mt-0 flex-1 overflow-hidden px-0">
                  <div className="overflow-y-auto h-full">
                    <JSONConfiguration />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle
            withHandle={true}
            onDragging={(isDragging) => context.dispatch({ isDragging })}
          />

          <ResizablePanel defaultSize={50} minSize={30} className="pl-3">
            <WidgetPreviewPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SettingsLayout>
  );
}
