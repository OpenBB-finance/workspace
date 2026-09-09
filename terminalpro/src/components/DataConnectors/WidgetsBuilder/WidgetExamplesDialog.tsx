import { useCallback } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import { EXAMPLE_WIDGETS } from "./consts";
import type { ExampleWidget } from "./types";
import { useWidgetConfigContext } from "./WidgetConfigContext";

export default function WidgetExamplesDialog() {
  const context = useWidgetConfigContext((s) => ({
    dispatch: s.dispatchFormState,
    updateWidgetConfig: s.updateWidgetConfig,
    handleTestAndFetchData: s.handleTestAndFetchData,
  }));

  const isOpen = useWidgetConfigContext((s) => s.formState.examplesOpen);

  const handleSetOpen = useCallback(
    (mode: "open" | "close") => () =>
      context.dispatch({ examplesOpen: mode === "open" }),
    [],
  );

  const handleSelectExample = useCallback(
    async (example: ExampleWidget) => {
      context.dispatch({
        endpoint: example.formState.endpoint || "",
        authRequired: example.formState.authRequired ?? true,
        authHeaderKey: example.formState.authHeaderKey || "",
        tokenBearer: example.formState.tokenBearer || "",
        error: null,
        isUpdatingPreview: true,
        previewData: null,
        examplesOpen: false,
      });
      context.updateWidgetConfig(example.widgetConfig);

      await context.handleTestAndFetchData(example.formState.endpoint);

      // Small delay to show loading state before updating
      setTimeout(() => context.dispatch({ isUpdatingPreview: false }), 50);
    },
    [context],
  );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleSetOpen("open")}>
        <Icon id="book-open-01" className="size-4 mr-2" />
        Browse Examples
      </Button>
      <BaseDialog open={isOpen} onClose={handleSetOpen("close")}>
        <DialogHeader className="flex flex-col gap-2">
          <DialogTitle>Widget Examples</DialogTitle>
          <DialogDescription>
            Choose from pre-configured widget templates to get started quickly
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4">
            {EXAMPLE_WIDGETS.map((example) => (
              <div
                key={example.id}
                className="group p-4 border border-light-200 dark:border-dark-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-dark-800/20"
                onClick={() => handleSelectExample(example)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary-50 dark:bg-primary-900/20 group-hover:bg-primary-100 dark:group-hover:bg-primary-800/30 transition-colors">
                    <Icon
                      id={example.icon}
                      className="size-5 text-primary-600 dark:text-primary-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-light-700 dark:text-dark-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {example.title}
                    </h4>
                    <p className="text-xs text-light-500 dark:text-light-400 mt-1 line-clamp-3">
                      {example.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="obb-tag">{example.widgetConfig.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button size="sm" variant="outlined" onClick={handleSetOpen("close")}>
            Close
          </Button>
        </div>
      </BaseDialog>
    </>
  );
}
