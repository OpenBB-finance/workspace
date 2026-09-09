import * as TabsPrimitive from "@radix-ui/react-tabs";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Checkbox } from "~/components/Forms/Checkbox";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import SnowflakeHide from "../General/SnowflakeHide";

const showMinimizeWidgetFF = getConfig().ui.showMinimizeWidget;
const showChartGenerationFF = getConfig().ui.showChartGeneration;

export default function WidgetTab() {
  const {
    decimalDigits,
    showWidgetControlsEllipsis,
    tablePagination,
    showMinimizeButton,
    autoHideWidgetNavbar,
    updateDisplaySettings,
  } = useShallowThemeStore((state) => ({
    decimalDigits: state.decimalDigits,
    showWidgetControlsEllipsis: state.showWidgetControlsEllipsis,
    tablePagination: state.tablePagination,
    showMinimizeButton: state.showMinimizeButton,
    autoHideWidgetNavbar: state.autoHideWidgetNavbar,
    updateDisplaySettings: state.updateDisplaySettings,
  }));

  return (
    <TabsPrimitive.Content className="mt-5 mb-5 text-xs" value="widget">
      <form className="flex gap-4 flex-col">
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium">Widget control icons</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={showWidgetControlsEllipsis}
                onChange={(showWidgetControlsEllipsis) =>
                  updateDisplaySettings({ showWidgetControlsEllipsis })
                }
                id="widget-control-icons"
              />
              <label
                htmlFor="widget-control-icons"
                className="inline-flex items-center gap-3"
              >
                Collapse widget controls: Hides action icons behind a chevron, revealed
                on hover
              </label>
            </div>
            {showMinimizeWidgetFF && (
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={showMinimizeButton}
                  onChange={(showMinimizeButton) =>
                    updateDisplaySettings({ showMinimizeButton })
                  }
                  id="show-minimize-button-control"
                />
                <label
                  htmlFor="show-minimize-button-control"
                  className="inline-flex items-center gap-3"
                >
                  Minimize button on header: Adds a minimize icon to collapse the widget
                  in place
                </label>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={autoHideWidgetNavbar}
                onChange={(autoHideWidgetNavbar) =>
                  updateDisplaySettings({ autoHideWidgetNavbar })
                }
                id="auto-hide-widget-navbar"
              />
              <label
                htmlFor="auto-hide-widget-navbar"
                className="inline-flex items-center gap-3"
              >
                Auto-hide iframe widget navbar (show on hover)
              </label>
            </div>
          </div>
        </div>
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium mb-2.5">Maximum decimal places</p>
          <DecimalDigitsRadio
            label=""
            decimalDigits={decimalDigits}
            setDecimalDigits={(decimalDigits) =>
              updateDisplaySettings({ decimalDigits })
            }
            extraClassName="gap-10 justify-start"
          />
        </div>

        <SnowflakeHide>
          <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
            <p className="body-sm-medium">Table vertical navigation</p>
            <RadioGroup
              value={tablePagination ? "table-pagination" : "table-scroll"}
              onValueChange={(value) => {
                const tablePagination = value === "table-pagination";
                updateDisplaySettings({ tablePagination });
              }}
              className="mt-2.5 flex items-center gap-10 overflow-x-auto"
            >
              <RadioGroupItem
                value="table-scroll"
                id="table-scroll"
                data-testid="table-scroll"
                label="Use infinite scrolling"
              />
              <RadioGroupItem
                value="table-pagination"
                id="table-pagination"
                data-testid="table-pagination"
                label="Use pagination"
              />
            </RadioGroup>
          </div>
        </SnowflakeHide>
      </form>
    </TabsPrimitive.Content>
  );
}
