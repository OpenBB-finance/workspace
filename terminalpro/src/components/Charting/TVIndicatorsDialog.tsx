import { useEffect } from "react";
import { toast } from "sonner";
import { useStateReducer } from "~/hooks/useStateReducer";
import type { IChartingLibraryWidget } from "~/lib/charting_library/charting_library";
import { useShallowChartingStore } from "~/lib/state/charting";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";
import { balanceIndicatorName } from "../Widgets/TVStudies/Balance";
import { cashFlowIndicatorName } from "../Widgets/TVStudies/CashFlow";
import { incomeIndicatorName } from "../Widgets/TVStudies/Income";
import FinancialMetricsTabs from "./FinancialMetricsTabs";

export default function TVIndicatorsDialogDialog({
  open,
  setOpen,
  tvWidget,
  widgetId,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  tvWidget: IChartingLibraryWidget & { _ready: boolean };
  widgetId: string;
}) {
  const { updateMetrics, getSecurityMetrics, symbol } = useShallowChartingStore(
    (state) => ({
      updateMetrics: (metrics: any) => {
        state.updateSecurityMetrics(widgetId, state.getSymbol(widgetId), metrics);
      },
      getSecurityMetrics: () =>
        state.getSecurityMetrics(widgetId, state.getSymbol(widgetId)),
      symbol: state.getSymbol(widgetId),
    }),
  );

  const [state, dispatch] = useStateReducer({
    filter: "",
    metrics: getSecurityMetrics(),
    stockOpen: false,
  });

  useEffect(() => {
    updateMetrics(state.metrics);
  }, [state.metrics]);

  useEffect(() => {
    if (!tvWidget?._ready) return;
    try {
      const activeChart = tvWidget.activeChart();

      if (open) {
        const allStudies = tvWidget.activeChart().getAllStudies();

        tvWidget.onChartReady(() => {
          const securityMetrics = state.metrics;
          for (const metric of securityMetrics) {
            if (!allStudies?.some((s) => s.id === metric.tvId)) {
              metric.tvId = undefined;
            }
          }
          dispatch({ metrics: securityMetrics.filter((m) => m.tvId !== undefined) });
        });
        if (activeChart.symbolExt().type !== "stock") {
          toast.warning("Invalid Security Type", {
            description: "You can only add financial metrics to stocks.",
          });
          setOpen(false);
        } else dispatch({ stockOpen: activeChart.symbolExt().type === "stock" });
      }
    } catch (_e) {
      /* noop */
    }
  }, [open, tvWidget]);

  return (
    <BaseDialog
      open={state.stockOpen}
      onClose={() => {
        setOpen(false);
        dispatch({ stockOpen: false });
      }}
      hasOverlay={false}
      className="min-h-[246px] w-[95vw] max-w-2xl md:w-full pb-5 text-xs lg:max-w-2xl xl:max-w-2xl"
    >
      <div className="flex flex-col text-xs px-5">
        <DialogTitle className="text-xl font-bold py-[17px]">
          Financial Indicators
        </DialogTitle>
        <Input
          placeholder="Search"
          prefix={<Icon id="search" />}
          value={state.filter}
          onChange={(value) => dispatch({ filter: value as string })}
        />
      </div>
      <FinancialMetricsTabs
        filter={state.filter}
        selectedMetrics={state.metrics}
        setSelectedMetrics={(metrics) => dispatch({ metrics })}
      />
      <div className="flex items-center justify-end gap-4 px-5">
        <Button
          variant="outlined"
          onClick={() => {
            setOpen(false);
            dispatch({ stockOpen: false });
          }}
          size="sm"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            dispatch({ stockOpen: false });
            setOpen(false);

            tvWidget.onChartReady(() => {
              const allStudies = tvWidget.activeChart().getAllStudies();
              const securityMetrics = state.metrics;
              for (const metric of securityMetrics) {
                const period = metric.period === "quarter" ? "quarterly" : "annually";

                if (!allStudies?.some((s) => s.id === metric.tvId)) {
                  metric.tvId = undefined;
                }

                if (metric.tvId) {
                  if (metric.tvId && metric.newPane !== metric.prevPane) {
                    tvWidget.activeChart().removeEntity(metric.tvId);
                    metric.tvId = undefined;
                  }

                  if (!metric.active) {
                    tvWidget.activeChart().removeEntity(metric.tvId);
                    dispatch({
                      metrics: (prevMetrics) =>
                        prevMetrics.filter((m) => m.id !== metric.id),
                    });
                  }
                  if (
                    metric?.tvId &&
                    metric.active &&
                    tvWidget
                      .activeChart()
                      .getStudyById(metric.tvId)
                      .getInputValues()
                      .map((v) => v.id === "period" && v.value === period).length > 0
                  ) {
                    tvWidget
                      .activeChart()
                      .getStudyById(metric.tvId)
                      .setInputValues([
                        {
                          id: "period" as any,
                          value: period,
                        },
                      ]);
                  }
                }

                if (
                  metric.active &&
                  !allStudies?.some((s) => s.id === metric.tvId) &&
                  (metric.label.includes("statement") ||
                    metric.label.includes("balance"))
                ) {
                  const [indicatorName, _statement] = metric.label.split("-");

                  const indicators = {
                    cash: cashFlowIndicatorName,
                    income: incomeIndicatorName,
                    balance: balanceIndicatorName,
                  };

                  tvWidget
                    .activeChart()
                    .createStudy(
                      indicators[indicatorName],
                      metric.newPane === "inChart",
                      false,
                      {
                        symbol: "",
                        period,
                        metric: metric.id,
                      },
                      {},
                      {
                        priceScale:
                          metric.newPane === "inChart" ? "new-left" : "new-right",
                      },
                    )
                    .then((entityId) => {
                      dispatch({
                        metrics: (prevMetrics) =>
                          prevMetrics?.map((m) =>
                            m.id === metric.id ? { ...m, tvId: entityId } : m,
                          ),
                      });
                    });
                }
              }
            });
          }}
          className="obb-btn-tertiary"
        >
          Add
        </Button>
      </div>
    </BaseDialog>
  );
}
