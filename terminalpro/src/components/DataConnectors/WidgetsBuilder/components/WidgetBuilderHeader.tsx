import { useCallback } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import { someTruthy } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import { TabContentHeader } from "~/components/LayoutAuth/Skeleton/TabContentHeader";
import { useWidgetConfigContext } from "../WidgetConfigContext";
import WidgetExamplesDialog from "../WidgetExamplesDialog";

export function WidgetBuilderHeader() {
  const { hasProgress, showClearConfirm, dispatch, onClearAll } =
    useWidgetConfigContext((s) => {
      const widgetConfig = s.getWidgetConfig();
      const state = s.formState;
      return {
        showClearConfirm: s.formState.showClearConfirm,
        hasProgress: someTruthy(
          state.endpoint,
          widgetConfig.name,
          widgetConfig.description,
          state.selectedWidget,
          state.jsonValue,
          widgetConfig.params,
          widgetConfig.columnsDefs,
        ),
        dispatch: s.dispatchFormState,
        onClearAll: s.resetContext,
      };
    });

  const handleClearClick = useCallback(() => {
    if (hasProgress) {
      dispatch({ showClearConfirm: true });
    } else {
      onClearAll();
    }
  }, [hasProgress, dispatch, onClearAll]);

  const handleConfirmClear = useCallback(() => {
    onClearAll();
    dispatch({ showClearConfirm: false });
  }, [onClearAll, dispatch]);

  return (
    <TabContentHeader.Root className="border-none px-6 mt-4 flex-shrink-0">
      <TabContentHeader.Left>
        <TabContentHeader.Title>Configure your custom widget</TabContentHeader.Title>
        <TabContentHeader.Description>
          Define the widget configuration and test with your API endpoint. You are not
          supposed to use a random internet API, but rather an endpoint you or your team
          made that has CORS enabled. You can check the{" "}
          <a
            href="https://docs.openbb.co/workspace/data-widgets"
            target="_blank"
            rel="noopener noreferrer"
            className="obb-hyper-link"
          >
            documentation
          </a>{" "}
          or see the examples{" "}
          <button
            onClick={() => dispatch({ examplesOpen: true })}
            className="obb-hyper-link no-underline"
          >
            here
          </button>
          .
        </TabContentHeader.Description>
      </TabContentHeader.Left>
      <TabContentHeader.Right>
        <div className="flex items-center gap-3">
          <ConfirmDialog
            open={showClearConfirm}
            onClose={() => dispatch({ showClearConfirm: false })}
            title="Clear all progress?"
            description="This will reset all widget configuration and form data. This action cannot be undone."
            confirmText="Clear All"
            onConfirm={handleConfirmClear}
            trigger={
              <Button variant="outlined" size="sm" onClick={handleClearClick}>
                <Icon id="jam-refresh-reverse" className="size-4" />
                Clear All
              </Button>
            }
          />
          <WidgetExamplesDialog />
        </div>
      </TabContentHeader.Right>
    </TabContentHeader.Root>
  );
}

WidgetBuilderHeader.displayName = "WidgetBuilderHeader";
