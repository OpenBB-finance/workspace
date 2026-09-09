import dayjs from "dayjs";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { useThemeStore } from "~/lib/state/theme";
import { slugify } from "~/lib/utils";
import { RadioGroup, RadioGroupItem } from "../ds/atoms/RadioGroup";

export default function ExportWidgetModal() {
  const { exportWidgetData, setExportWidgetData } = useThemeStore();

  const formattedDateTime = dayjs().format("YYYY-MM-DD HH:mm:ss");

  const [title, setTitle] = useState(
    `${formattedDateTime} - ${exportWidgetData?.widgetName} Widget`,
  );

  const posthog = usePostHog();

  if (!exportWidgetData) return null;

  return (
    <Dialog
      open={!!exportWidgetData}
      onOpenChange={(open) => {
        if (!open) {
          setExportWidgetData(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export widget</DialogTitle>
        </DialogHeader>
        <div className="mt-2.5 flex flex-col gap-6">
          <label
            className="flex items-center gap-4 whitespace-nowrap"
            htmlFor="save-as"
          >
            <span className="w-16">Save as</span>
            <input
              id="save-as"
              className="obb-small-input h-6"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="flex items-start gap-4 whitespace-nowrap">
            <span className="w-14">Export as</span>
            <RadioGroup
              value={
                exportWidgetData.possibleExportFormats.find(
                  (item) =>
                    item.value.toLowerCase() ===
                    exportWidgetData.selectedExportFormat.toLowerCase(),
                )?.value || exportWidgetData.selectedExportFormat
              }
              onValueChange={(value) => {
                setExportWidgetData({
                  ...exportWidgetData,
                  selectedExportFormat: value,
                });
              }}
              className="flex flex-col gap-2"
            >
              {exportWidgetData.possibleExportFormats.map((type) => (
                <RadioGroupItem
                  key={type.value}
                  value={type.value}
                  id={`export-type-${type.value}`}
                  label={type.value.toUpperCase()}
                />
              ))}
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild={true}>
            <Button variant="outlined">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              if (posthog) {
                posthog.capture("user_exported_data_widget", {
                  widgetName: exportWidgetData.widgetName,
                  widgetId: exportWidgetData.widgetId,
                  selectedExportFormat: exportWidgetData.selectedExportFormat,
                });
              }
              toast.info("Widget export is being generated", {
                description: "The file will be downloaded shortly",
              });
              setExportWidgetData(null);
              const item = exportWidgetData.possibleExportFormats.find(
                (item) =>
                  item.value.toLocaleLowerCase() ===
                  exportWidgetData.selectedExportFormat.toLocaleLowerCase(),
              );
              if (item) {
                setTimeout(() => {
                  item.fn(slugify(title));
                }, 3000);
              }
            }}
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
