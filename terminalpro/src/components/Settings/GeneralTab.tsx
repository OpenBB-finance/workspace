import * as TabsPrimitive from "@radix-ui/react-tabs";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Checkbox } from "~/components/Forms/Checkbox";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import AdvancedSelectedTicker from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { DEFAULT_TICKERS } from "~/lib/types";
import { cn } from "~/lib/utils";
import FeatureLock from "../General/FeatureLock";
import SnowflakeHide from "../General/SnowflakeHide";

function FontSizeDiv({ fontSize }: { fontSize: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded border border-light-300 dark:border-light-600",
        fontSize,
      )}
    >
      A
    </div>
  );
}

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

export default function GeneralTab() {
  const { theme, aiEnhancements, fontSize, defaultTicker, updateDisplaySettings } =
    useShallowThemeStore((state) => ({
      theme: state.theme,
      aiEnhancements: state.aiEnhancements,
      fontSize: state.fontSize,
      defaultTicker: state.defaultTicker,
      updateDisplaySettings: state.updateDisplaySettings,
    }));

  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );

  return (
    <TabsPrimitive.Content className="mt-5 mb-5 text-xs" value="general">
      <form className="flex gap-4 flex-col">
        <div className="flex flex-col gap-2.5 py-5 bg-general-bg-primary rounded-md p-4">
          <p className="body-sm-medium">Theme</p>
          <RadioGroup
            value={theme}
            onValueChange={(theme: "light" | "dark") =>
              updateDisplaySettings({ theme })
            }
            className="flex items-center gap-10 overflow-x-auto"
          >
            <RadioGroupItem
              value="dark"
              id="theme-dark"
              data-testid="theme-dark"
              label={
                <span className="inline-flex items-center gap-3 whitespace-nowrap">
                  Dark mode
                  <img
                    src="/assets/images/settings/theme_dark.svg"
                    alt="Dark mode preview"
                    className="w-[62px] h-auto rounded-none"
                  />
                </span>
              }
            />
            <RadioGroupItem
              value="light"
              id="theme-light"
              data-testid="theme-light"
              label={
                <span className="inline-flex items-center gap-3 whitespace-nowrap">
                  Light mode
                  <img
                    src="/assets/images/settings/theme_light.svg"
                    alt="Light mode preview"
                    className="w-[62px] h-auto rounded-none"
                  />
                </span>
              }
            />
          </RadioGroup>
        </div>
        <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
          <p className="body-sm-medium">Font size</p>
          <RadioGroup
            value={fontSize}
            onValueChange={(fontSize: "medium" | "large") =>
              updateDisplaySettings({ fontSize })
            }
            className="flex items-center gap-10 overflow-x-auto"
          >
            <RadioGroupItem
              value="medium"
              id="font-medium"
              data-testid="font-medium"
              label={
                <span className="inline-flex items-center gap-3 whitespace-nowrap">
                  Medium
                  <FontSizeDiv fontSize="text-base" />
                </span>
              }
            />
            <RadioGroupItem
              value="large"
              id="font-large"
              data-testid="font-large"
              label={
                <span className="inline-flex items-center gap-3 whitespace-nowrap">
                  Large
                  <FontSizeDiv fontSize="text-xl" />
                </span>
              }
            />
          </RadioGroup>
        </div>
        <SnowflakeHide>
          <div className="flex flex-col bg-general-bg-primary rounded-md p-4 gap-2.5 py-5">
            <p className="body-sm-medium">Default widget ticker</p>
            <div className="mt-2.5 flex items-center gap-10 overflow-x-auto">
              <div className="flex items-center gap-3">
                <AdvancedSelectedTicker
                  triggerSize="sm"
                  ticker={defaultTicker ? defaultTicker : DEFAULT_TICKERS.AAPL}
                  setTicker={(defaultTicker) =>
                    updateDisplaySettings({ defaultTicker })
                  }
                />
                <span>
                  Chose which ticker loads as default when you are adding a new widget
                  to a tab
                </span>
              </div>
            </div>
          </div>
        </SnowflakeHide>
        {aiCopilotAiEnhancementsFF && (
          <div className="flex bg-general-bg-primary rounded-md p-4 flex-col gap-2.5 py-5">
            <p className="body-sm-medium flex items-center gap-2">
              AI enhancements (recommended)
              <Tooltip
                message={
                  <>
                    <span>
                      <strong>Features include:</strong>
                    </span>
                    <ul className="list-disc pl-4">
                      <li>Widget title/description suggestion from copilot</li>
                      <li>Widget title/description suggestion upon upload</li>
                      <li>Copilot chat title generation</li>
                      <li>Dashboard name generation</li>
                      {inSnowflakeNativeApp && (
                        <li>Widget metadata on SQL query run</li>
                      )}
                    </ul>
                  </>
                }
              >
                <button type="button" className="ml-2">
                  <Icon id="info-circled-icon" />
                </button>
              </Tooltip>
            </p>

            <div className="flex flex-col gap-3">
              <FeatureLock isLocked={!isProTier}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={aiEnhancements}
                    onChange={(aiEnhancements) =>
                      updateDisplaySettings({ aiEnhancements })
                    }
                    id="ai-enhancements"
                  />
                  <label htmlFor="ai-enhancements" className="grow">
                    Enable AI-powered features that rely on third-party LLM vendors
                    (e.g. OpenAI)
                  </label>
                </div>
              </FeatureLock>
            </div>
          </div>
        )}
      </form>
    </TabsPrimitive.Content>
  );
}
