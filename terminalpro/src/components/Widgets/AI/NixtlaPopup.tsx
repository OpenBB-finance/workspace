import { zodResolver } from "@hookform/resolvers/zod";
import type { ChartType } from "ag-grid-enterprise";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { Label } from "~/components/ds/atoms/Label";
import { FormSelect } from "~/components/ds/atoms/Select";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { Form, FormField } from "~/components/ds/molecules/Form";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useProNixtlaTimegen } from "~/lib/api/sdkComponents";

const nixtlaSchema = z.object({
  fh: z.string(),
  freq: z.enum(["D", "W", "MS", "QS", "YS"]),
  level: z.array(z.string()).optional(),
});

export type ForecastData = { [date: string]: number };
export type SeriesData = {
  type: ChartType;
  xKey: string;
  yKey: string;
  yLowKey?: string;
  yHighKey?: string;
  data: ForecastData;
  color?: string;
};

type nixtlaForm = z.infer<typeof nixtlaSchema>;

const CONFIDENCE_LEVELS_COLORS = ["#FFD700", "#FFB14E", "#FF6347", "#FF4500"];

export default function ForecastingNixtlaPopup(props: {
  open: boolean;
  onClose: () => void;
  data: any[];
  timeseries: string;
  forecast: boolean;
  onForecast: (forecastSeriesData?: SeriesData[]) => void;
}) {
  const { open, onClose, data, timeseries, forecast, onForecast } = props;

  const [state, dispatch] = useStateReducer({
    abortController: new AbortController(),
    error: null as string | null,
  });

  const handleOnClose = useCallback(() => {
    dispatch((prev) => {
      if (!prev.abortController.signal.aborted) {
        prev.abortController.abort("Forecasting cancelled by user.");
      }

      return {
        ...prev,
        abortController: new AbortController(),
        error: null,
      };
    });
    onClose();
  }, [onClose]);

  const form = useForm({
    resolver: zodResolver(nixtlaSchema),
    defaultValues: { fh: "7", freq: "YS", level: [] } as nixtlaForm,
  });

  const { mutateAsync, isPending: isLoading } = useProNixtlaTimegen(
    {
      onSuccess(response, variables, _context) {
        const objectOrderedByDate = variables.body.y.reduce((acc, item) => {
          acc[item.timestamp] = item.value;
          return acc;
        }, {} as ForecastData);

        const { levelData, ...forecastResult } = response.results.reduce(
          (acc, result) => {
            if (import.meta.env.DEV) console.log(result);
            acc[result.date] = result.forecast;
            for (const item of result.levels) {
              const level = item.level.toString();
              if (!acc.levelData[level])
                acc.levelData[level] = { loData: {}, hiData: {} };

              acc.levelData[level].loData[result.date] = item.low;
              acc.levelData[level].hiData[result.date] = item.high;
            }

            return acc;
          },
          {
            levelData: {} as {
              [level: string]: { loData: ForecastData; hiData: ForecastData };
            },
          },
        );

        const forecastChartArray = [
          {
            type: "line",
            xKey: "Date",
            yKey: timeseries,
            data: objectOrderedByDate,
          },
          {
            type: "line",
            xKey: "Date",
            yKey: `${timeseries} Forecast`,
            data: forecastResult,
            color: "#B182FF",
          },
        ] as SeriesData[];

        let i = 0;

        for (const lvl in levelData) {
          const color = CONFIDENCE_LEVELS_COLORS[i % CONFIDENCE_LEVELS_COLORS.length];

          forecastChartArray.push({
            type: "line",
            xKey: "Date",
            yKey: `${timeseries} Forecast Hi ${lvl}%`,
            data: levelData[lvl].hiData,
            color,
          });
          forecastChartArray.push({
            type: "line",
            xKey: "Date",
            yKey: `${timeseries} Forecast Lo ${lvl}%`,
            data: levelData[lvl].loData,
            color,
          });

          i++;
        }

        onForecast(forecastChartArray);

        onClose();
      },
      onError(error, _variables, _context) {
        if (import.meta.env.DEV) {
          console.error("Error in Nixtla TimeGEN-1 API call:", error);
        }
        const errorMessage = error.message || "Unknown error";
        const truncatedMessage = errorMessage.split("\\n")[0].replace(/"/g, "");
        dispatch({ error: truncatedMessage });
      },
    },
    state.abortController.signal,
  );

  const onSubmit = async (values: nixtlaForm) => {
    const sortedData = data.sort(
      (a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime(),
    );
    const nixtlaFormattedData = sortedData.reduce(
      (acc, item) => {
        // item might be an year (int 2020) or a date (2020-01-01) on .Date so we need to account for that
        const isYear = item.Date.toString().length === 4;
        const date = isYear ? new Date(item.Date, 0, 1) : new Date(item.Date);
        const formattedDate = date.toISOString().split("T")[0];
        // acc[formattedDate] = item[timeseries];
        acc.push({ timestamp: formattedDate, value: item[timeseries] });

        return acc;
      },
      [] as { timestamp: string; value: number }[],
    );

    const payload = {
      body: {
        y: nixtlaFormattedData,
        freq: values.freq,
        fh: Number(values.fh),
        level: values.level.map((level) => Number(level)) || [],
      },
    };

    mutateAsync(payload);
  };

  const [confidenceLevels, setConfidenceLevels] = useState<string[]>([]);

  const addConfidenceLevel = () => {
    setConfidenceLevels([...confidenceLevels, "80"]);
  };

  const removeConfidenceLevel = (index: number) => {
    setConfidenceLevels(confidenceLevels.filter((_, i) => i !== index));
  };

  const updateConfidenceLevel = (index: number, value: string) => {
    const newLevels = [...confidenceLevels];
    newLevels[index] = value;
    setConfidenceLevels(newLevels);
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open]);

  useEffect(() => {
    form.setValue("level", confidenceLevels);
  }, [confidenceLevels]);

  const canShowLevel = useMemo(() => {
    const freq = form.watch("freq");
    const dataLength = data.length;

    switch (freq) {
      case "D":
        return dataLength >= 300;
      case "W":
        return dataLength >= 64;
      case "MS":
      case "QS":
      case "YS":
        return dataLength >= 48;
      default:
        return false;
    }
  }, [form.watch("freq"), data.length]);

  return (
    <BaseDialog open={open} onClose={handleOnClose}>
      <DialogTitle>Nixtla: Forecasting with TimeGEN-1</DialogTitle>
      <DialogDescription className="text-light-500">
        When forecasting, you can use the TimeGEN-1 model to predict future values of a
        time series.
      </DialogDescription>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="fh"
            render={({ field }) => (
              <FormInput
                label="Forecast Horizon"
                type="number"
                placeholder="e.g., 7"
                min={1}
                {...field}
              />
            )}
          />

          <FormField
            name="freq"
            render={({ field }) => (
              <FormSelect
                label="Frequency"
                options={[
                  { label: "Daily", value: "D" },
                  { label: "Weekly", value: "W" },
                  { label: "Monthly", value: "MS" },
                  { label: "Quarterly", value: "QS" },
                  { label: "Yearly", value: "YS" },
                ]}
                {...field}
              />
            )}
          />
          <div className="mb-2">
            <div className="flex justify-between items-center">
              <Label>Confidence Interval</Label>
              <Tooltip
                message={
                  canShowLevel
                    ? "Add a confidence level"
                    : "Not enough data to add a confidence level"
                }
              >
                <button
                  type="button"
                  onClick={addConfidenceLevel}
                  className="obb-small-navbar-btn disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  disabled={!canShowLevel}
                >
                  <Icon id="plus-icon" className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            {canShowLevel ? (
              confidenceLevels.map((level, index) => (
                <div key={index} className="flex items-center gap-2 mt-2">
                  <div className="w-full">
                    <FormInput
                      type="number"
                      value={level}
                      onChange={(value) =>
                        updateConfidenceLevel(index, value.toString())
                      }
                      placeholder="e.g., 80"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeConfidenceLevel(index)}
                    className="obb-small-navbar-btn"
                  >
                    <Icon id="trash-icon" className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs dark:text-dark-200 text-light-500">
                Not enough data to add a confidence level
              </div>
            )}
          </div>
          {state.error && (
            <div
              className="flex flex-col gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-4 mb-2
              rounded-md border-[1.5px] border-red-800 dark:border-red-700 mt-2 w-[560px] max-w-full"
            >
              <div className="flex items-center gap-2">
                <Icon
                  id="warning-icon"
                  className="h-5 w-5 flex-shrink-0 text-red-500"
                />
                <p className="font-bold text-light-800 dark:text-white text-sm leading-[18px]">
                  Error
                </p>
              </div>
              <div className="text-xs text-light-800 dark:text-white">
                {state.error || "An error occurred while processing your request."}
              </div>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between gap-2.5">
            <DialogClose asChild={true}>
              <Button size="sm" variant="outlined" type="button">
                Cancel
              </Button>
            </DialogClose>
            <div className="flex items-center gap-2.5">
              <Button
                size="sm"
                type="button"
                disabled={!forecast}
                onClick={() => onForecast()}
                variant="danger"
              >
                Remove Forecast
              </Button>
              <Button loading={isLoading} size="sm" disabled={forecast}>
                Forecast
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </BaseDialog>
  );
}
