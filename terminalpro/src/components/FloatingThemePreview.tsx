import { useEffect, useState } from "react";
import Draggable from "react-draggable";
import { useDebounceValue } from "usehooks-ts";
import { Select } from "~/components/ds/atoms/Select";
import Icon from "~/components/Icon";
import { getConfig } from "~/lib/runtimeConfig";
import { applyBrandColors, applyFontFamily } from "~/utils/colorUtils";

const showFloatingPreview = getConfig().whiteLabel.showFloatingThemePreview;

const FloatingThemePreview = () => {
  const [color, setColor] = useState(getConfig().whiteLabel.mainColor || "#3F51B5");
  const [fontFamily, setFontFamily] = useState(
    getConfig().whiteLabel.fontFamily || "Inter",
  );
  const [debouncedColor] = useDebounceValue(color, 300);
  const [showPreview, setShowPreview] = useState(false);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  const handleFontFamilyChange = (newFontFamily: string) => {
    setFontFamily(newFontFamily);
    applyFontFamily(newFontFamily);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  useEffect(() => {
    applyBrandColors(debouncedColor);
  }, [debouncedColor]);

  if (!showFloatingPreview) return null;

  return (
    <Draggable handle=".drag-handle" defaultPosition={{ x: 0, y: 0 }} bounds="parent">
      <div className="fixed top-4 right-4 z-50 bg-white dark:bg-dark-600 border border-light-200 dark:border-dark-300 rounded-lg shadow-lg overflow-hidden">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between drag-handle cursor-move select-none">
            <div className="flex items-center gap-2">
              <Icon
                id="material-symbols-drag-pan-rounded"
                className="w-3 h-3 text-light-600 dark:text-light-400"
              />
              <span className="text-xs font-bold text-light-900 dark:text-light-50">
                Theme Preview
              </span>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-light-700 dark:text-light-300 hover:text-light-900 dark:hover:text-light-50 transition-colors cursor-pointer"
            >
              {showPreview ? "Hide" : "Show"} .env
            </button>
          </div>

          <div className="flex items-center gap-2 cursor-auto">
            <label
              htmlFor="brand-color"
              className="text-xs font-medium text-light-900 dark:text-light-50 min-w-[70px]"
            >
              Brand Color:
            </label>
            <input
              id="brand-color"
              type="color"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-light-200 dark:border-dark-300"
              title="Live preview brand color"
            />
            <span className="text-xs text-light-700 dark:text-light-300 font-mono">
              {color}
            </span>
          </div>

          <div className="flex items-center gap-2 cursor-auto">
            <label
              htmlFor="font-family"
              className="text-xs font-medium text-light-900 dark:text-light-50 min-w-[70px]"
            >
              Font Family:
            </label>
            <Select
              options={[
                { label: "Inter", value: "Inter" },
                { label: "Roboto", value: "Roboto" },
              ]}
              value={fontFamily}
              onChange={handleFontFamilyChange}
              size="xs"
              className="w-20"
            />
          </div>
        </div>

        {showPreview && (
          <div className="border-t border-light-200 dark:border-dark-300 bg-light-50 dark:bg-dark-700 p-3">
            <div className="text-xs font-medium text-light-900 dark:text-light-50 mb-2">
              Update .env file:
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-xs bg-light-100 dark:bg-dark-800 px-2 py-1 rounded font-mono text-light-900 dark:text-light-50 flex-1">
                  VITE_WL_MAIN_COLOR="{color}"
                </code>
                <button
                  onClick={() => copyToClipboard(`VITE_WL_MAIN_COLOR="${color}"`)}
                  className="text-light-700 dark:text-light-300 hover:text-light-900 dark:hover:text-light-50 transition-colors"
                  title="Copy to clipboard"
                >
                  <Icon id="copy-03" className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-light-100 dark:bg-dark-800 px-2 py-1 rounded font-mono text-light-900 dark:text-light-50 flex-1">
                  VITE_WL_FONT_FAMILY="{fontFamily}"
                </code>
                <button
                  onClick={() => copyToClipboard(`VITE_WL_FONT_FAMILY="${fontFamily}"`)}
                  className="text-light-700 dark:text-light-300 hover:text-light-900 dark:hover:text-light-50 transition-colors"
                  title="Copy to clipboard"
                >
                  <Icon id="copy-03" className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default FloatingThemePreview;
