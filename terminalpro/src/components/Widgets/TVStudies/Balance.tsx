import type {
  IContext,
  IPineStudyResult,
  PineJS,
  RawStudyMetaInfoId,
  StudyInputType,
  StudyInputValue,
  StudyLinePlotPreferences,
  StudyPlotType,
} from "~/lib/charting_library/charting_library";
import type { ExtendedCustomIndicator } from "./types";

export const balanceIndicatorId = "balance@tv-basicstudies-1";
export const balanceIndicatorName = "Balance Sheet";
const regex = /symbol":"(.*)"/;

const BalanceIndicator = (PineJS: PineJS): ExtendedCustomIndicator => {
  return {
    name: balanceIndicatorName,
    metainfo: {
      _metainfoVersion: 51,
      id: balanceIndicatorId as RawStudyMetaInfoId,
      description: balanceIndicatorName,
      shortDescription: balanceIndicatorName,
      is_hidden_study: true,
      is_price_study: false,
      isCustomIndicator: true,
      financialPeriod: "FY",
      format: {
        type: "volume",
        precision: 2,
      },
      plots: [{ id: "plot_0", type: "line" as StudyPlotType.Line }],
      defaults: {
        styles: {
          plot_0: {
            visible: true,
            plottype: 0 as StudyLinePlotPreferences["plottype"],
            display: 15 as StudyLinePlotPreferences["display"],
            linestyle: 0 as StudyLinePlotPreferences["linestyle"],
            linewidth: 2 as StudyLinePlotPreferences["linewidth"],
          },
        },
        inputs: {
          symbol: "",
          period: "quarterly",
          metric: "cash_and_cash_equivalents",
        },
        precision: 2,
      },
      styles: {
        plot_0: {
          title: "Metric",
          histogramBase: 0,
        },
      },
      inputs: [
        {
          id: "symbol",
          name: "Symbol",
          optional: true,
          type: "symbol" as StudyInputType.Symbol,
        },
        {
          id: "period",
          name: "Period",
          defval: "annually",
          type: "text" as StudyInputType.Text,
          options: ["quarterly", "annually"],
          confirm: true,
        },
        {
          id: "metric",
          name: "Metric",
          defval: "cash_and_cash_equivalents",
          type: "text" as StudyInputType.Text,
          optionsTitles: {
            cash_and_cash_equivalents: "Cash And Cash Equivalents",
            short_term_investments: "Short Term Investments",
            other_current_assets: "Other Current Assets",
            total_current_assets: "Total Current Assets",
            plant_property_equipment_net: "Plant Property Equipment Net",
            goodwill: "Goodwill",
            intangible_assets: "Intangible Assets",
            total_assets: "Total Assets",
            short_term_debt: "Short Term Debt",
            accounts_payable: "Accounts Payable",
            current_deferred_revenue: "Current Deferred Revenue",
            other_current_liabilities: "Other Current Liabilities",
            total_current_liabilities: "Total Current Liabilities",
            long_term_debt: "Long Term Debt",
            total_non_current_liabilities: "Total Non Current Liabilities",
            capital_lease_obligations: "Capital Lease Obligations",
            total_liabilities: "Total Liabilities",
            common_stock: "Common Stock",
            retained_earnings: "Retained Earnings",
            accumulated_other_comprehensive_income:
              "Accumulated Other Comprehensive Income",
            total_common_equity: "Total Common Equity",
            total_equity_non_controlling_interests:
              "Total Equity Non Controlling Interests",
            total_liabilities_and_shareholders_equity:
              "Total Liabilities Shareholders Equity",
            inventory: "Inventory",
            other_non_current_assets: "Other Non Current Assets",
            other_non_current_liabilities: "Other Non Current Liabilities",
            minority_interest: "Minority Interest",
            cash_and_short_term_investments: "Cash And Short Term Investments",
            net_receivables: "Net Receivables",
            goodwill_and_intangible_assets: "Goodwill And Intangible Assets",
            non_current_assets: "Non Current Assets",
            tax_payables: "Tax Payables",
            deferred_revenue_non_current: "Deferred Revenue Non Current",
            deferred_tax_liabilities_non_current:
              "Deferred Tax Liabilities Non Current",
            other_total_shareholders_equity: "Other Total Stock Holders Equity",
            total_liabilities_and_total_equity: "Total Liabilities And Total Equity",
            total_investments: "Total Investments",
            total_debt: "Total Debt",
            net_debt: "Net Debt",
          },
          options: [
            "cash_and_cash_equivalents",
            "short_term_investments",
            "other_current_assets",
            "total_current_assets",
            "plant_property_equipment_net",
            "goodwill",
            "intangible_assets",
            "total_assets",
            "short_term_debt",
            "accounts_payable",
            "current_deferred_revenue",
            "other_current_liabilities",
            "total_current_liabilities",
            "long_term_debt",
            "total_non_current_liabilities",
            "capital_lease_obligations",
            "total_liabilities",
            "common_stock",
            "retained_earnings",
            "accumulated_other_comprehensive_income",
            "total_common_equity",
            "total_equity_non_controlling_interests",
            "total_liabilities_and_shareholders_equity",
            "inventory",
            "other_non_current_assets",
            "other_non_current_liabilities",
            "minority_interest",
            "cash_and_short_term_investments",
            "net_receivables",
            "goodwill_and_intangible_assets",
            "non_current_assets",
            "tax_payables",
            "deferred_revenue_non_current",
            "deferred_tax_liabilities_non_current",
            "other_total_shareholders_equity",
            "total_liabilities_and_total_equity",
            "total_investments",
            "total_debt",
            "net_debt",
          ],
          confirm: true,
        },
      ],
    },

    constructor: function (): void {
      this.init = function (
        ctx: IContext,
        inputs: <T extends StudyInputValue>(index: number) => T,
      ): void {
        this._context = ctx;
        this._input = inputs;

        const symbol =
          regex.exec(this._input(0))?.[1] ?? PineJS.Std.ticker(this._context);
        const period = this._input(1) ?? "annually";
        const metric = this._input(2) ?? "cash_and_cash_equivalents";

        this._currentSymbol = symbol;

        this._context.new_sym(
          `${symbol}-balance-${period}-${metric}`,
          period === "annually" ? "12M" : "3M",
          period === "annually" ? "12M" : "3M",
        );
      };
      this.main = function (
        ctx: IContext,
        inputs: <T extends StudyInputValue>(index: number) => T,
      ): IPineStudyResult {
        this._context = ctx;
        this._input = inputs;

        this._context.select_sym(0);
        const mainSymbolTime = this._context.new_unlimited_var(
          this._context.symbol.time,
        );

        this._context.select_sym(1);
        const balanceTime = this._context.new_unlimited_var(this._context.symbol.time);

        const symbol =
          regex.exec(this._input(0))?.[1] ?? PineJS.Std.ticker(this._context);
        const period = this._input(1) ?? "annually";
        const metric = this._input(2) ?? "cash_and_cash_equivalents";

        if (this._currentSymbol !== symbol && !symbol.includes("balance")) {
          this._context.new_sym(
            `${symbol}-balance-${period}-${metric}`,
            period === "annually" ? "12M" : "3M",
            period === "annually" ? "12M" : "3M",
          );
          this._currentSymbol = symbol;
        }

        const metricClose = this._context.new_unlimited_var(
          PineJS.Std.close(this._context),
        );
        const alignedClose = metricClose.adopt(balanceTime, mainSymbolTime, 0);
        this._context.select_sym(0);

        return [alignedClose];
      };
    },
  };
};

export default BalanceIndicator;
