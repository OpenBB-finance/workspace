import { Content } from "@radix-ui/react-tabs";
import clsx from "clsx";
import { Checkbox } from "~/components/Forms/Checkbox";
import { useShallowThemeStore } from "~/lib/state/theme";

export default function LayoutTab() {
  const {
    gridCorners,
    quickAddButtonVisible,
    collapsedPanelExpandOnHover,
    updateDisplaySettings,
  } = useShallowThemeStore((state) => ({
    gridCorners: state.gridCorners,
    quickAddButtonVisible: state.quickAddButtonVisible,
    collapsedPanelExpandOnHover: state.collapsedPanelExpandOnHover,
    updateDisplaySettings: state.updateDisplaySettings,
  }));

  return (
    <Content className="mt-5 text-xs" value="tab-layout">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium">Corner drag handles</p>
          <div className="mt-2.5 pl-2.5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-20 items-center gap-3 rounded border border-light-300 dark:border-light-600">
                {["nw", "ne", "sw", "se"].map((corner: "nw" | "ne" | "sw" | "se") => (
                  <button
                    key={corner}
                    style={{
                      top: corner[0] === "n" ? -8 : "auto",
                      bottom: corner[0] === "s" ? -8 : "auto",
                      left: corner[1] === "w" ? -8 : "auto",
                      right: corner[1] === "e" ? -8 : "auto",
                      position: "absolute",
                    }}
                    onClick={() => {
                      if (gridCorners.includes(corner)) {
                        updateDisplaySettings({
                          gridCorners: gridCorners.filter((c) => c !== corner),
                        });
                      } else {
                        updateDisplaySettings({
                          gridCorners: [...gridCorners, corner],
                        });
                      }
                    }}
                    className={clsx(
                      "h-4 w-4 rounded border border-light-300 dark:border-light-600",
                      {
                        "bg-light-300 dark:bg-light-600": gridCorners.includes(corner),
                      },
                    )}
                  />
                ))}
              </div>
              <span className="ml-4">
                Click corners to enable/disable the draggable handles for resizing
                widgets inside a dashboard
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium">Quick add toolbar</p>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={quickAddButtonVisible}
              onChange={(quickAddButtonVisible) =>
                updateDisplaySettings({ quickAddButtonVisible })
              }
              id="quick-add-button-transparent"
            />
            <label
              htmlFor="quick-add-button-transparent"
              className="inline-flex items-center gap-3"
            >
              Button on the bottom right corner of a dashboard to add widgets is always
              visible
            </label>
          </div>
        </div>
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium">Collapsed sidebar and AI chat visibility</p>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={collapsedPanelExpandOnHover}
              onChange={(collapsedPanelExpandOnHover) =>
                updateDisplaySettings({ collapsedPanelExpandOnHover })
              }
              id="collapsed-panel-expand-on-hover"
            />
            <label
              htmlFor="collapsed-panel-expand-on-hover"
              className="inline-flex items-center gap-3"
            >
              If the sidebar or AI chat are collapsed, the expand button appears only on
              hover
            </label>
          </div>
        </div>
      </div>
    </Content>
  );
}
