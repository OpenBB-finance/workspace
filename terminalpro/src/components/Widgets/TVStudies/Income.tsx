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

export const incomeIndicatorId = "income-revenue@tv-basicstudies-1";
export const incomeIndicatorName = "Income";
const regex = /symbol":"(.*)"/;

const IncomeIndicator = (PineJS: PineJS): ExtendedCustomIndicator => {
  return {
    name: incomeIndicatorName,
    metainfo: {
      _metainfoVersion: 51,
      id: incomeIndicatorId as RawStudyMetaInfoId,
      description: incomeIndicatorName,
      shortDescription: incomeIndicatorName,
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
          metric: "revenue",
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
          defval: "revenue",
          type: "text" as StudyInputType.Text,
          optionsTitles: {
            revenue: "Revenue",
            cost_of_revenue: "Cost Of Revenue",
            gross_profit: "Gross Profit",
            gross_profit_margin: "Gross Profit Margin",
            research_and_development_expense: "Research And Development Expense",
            selling_general_and_admin_expense:
              "Selling General And Administrative Expense",
            other_expenses: "Other Expenses",
            total_operating_expenses: "Operating Expenses",
            cost_and_expenses: "Cost And Expenses",
            interest_income: "Interest Income",
            total_interest_expense: "Interest Expense",
            depreciation_and_amortization: "Depreciation And Amortization",
            ebitda: "Ebitda",
            ebitda_margin: "Ebitda Margin",
            total_operating_income: "Operating Income",
            operating_income_margin: "Operating Income Margin",
            total_other_income_expenses: "Total Other Income Expenses Net",
            total_pre_tax_income: "Income Before Tax",
            pre_tax_income_margin: "Income Before Tax Margin",
            income_tax_expense: "Income Tax Expense",
            consolidated_net_income: "Consolidated Net Income",
            net_income_margin: "Net Income Margin",
            basic_earnings_per_share: "Earnings Per Share",
            diluted_earnings_per_share: "Earnings Per Share Diluted",
            weighted_average_basic_shares_outstanding:
              "Weighted Average Shares Outstanding",
            weighted_average_diluted_shares_outstanding:
              "Weighted Average Shares Outstanding Diluted",
          },
          options: [
            "revenue",
            "cost_of_revenue",
            "gross_profit",
            "gross_profit_margin",
            "research_and_development_expense",
            "selling_general_and_admin_expense",
            "other_expenses",
            "total_operating_expenses",
            "cost_and_expenses",
            "interest_income",
            "total_interest_expense",
            "depreciation_and_amortization",
            "ebitda",
            "ebitda_margin",
            "total_operating_income",
            "operating_income_margin",
            "total_other_income_expenses",
            "total_pre_tax_income",
            "pre_tax_income_margin",
            "income_tax_expense",
            "consolidated_net_income",
            "net_income_margin",
            "basic_earnings_per_share",
            "diluted_earnings_per_share",
            "weighted_average_basic_shares_outstanding",
            "weighted_average_diluted_shares_outstanding",
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
        const metric = this._input(2) ?? "revenue";

        this._currentSymbol = symbol;

        this._context.new_sym(
          `${symbol}-income-${period}-${metric}`,
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
        const incomeTime = this._context.new_unlimited_var(this._context.symbol.time);

        const symbol =
          regex.exec(this._input(0))?.[1] ?? PineJS.Std.ticker(this._context);
        const period = this._input(1) ?? "annually";
        const metric = this._input(2) ?? "revenue";

        if (this._currentSymbol !== symbol && !symbol.includes("income")) {
          this._context.new_sym(
            `${symbol}-income-${period}-${metric}`,
            period === "annually" ? "12M" : "3M",
            period === "annually" ? "12M" : "3M",
          );
          this._currentSymbol = symbol;
        }

        const metricClose = this._context.new_unlimited_var(
          PineJS.Std.close(this._context),
        );
        const alignedClose = metricClose.adopt(incomeTime, mainSymbolTime, 0);
        this._context.select_sym(0);

        return [alignedClose];
      };
    },
  };
};

export default IncomeIndicator;
