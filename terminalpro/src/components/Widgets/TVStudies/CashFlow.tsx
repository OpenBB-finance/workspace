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

export const cashFlowIndicatorId = "cash-flow@tv-basicstudies-1";
export const cashFlowIndicatorName = "Cash Flow";
const regex = /symbol":"(.*)"/;

const CashFlowIndicator = (PineJS: PineJS): ExtendedCustomIndicator => {
  return {
    name: cashFlowIndicatorName,
    metainfo: {
      _metainfoVersion: 51,
      id: cashFlowIndicatorId as RawStudyMetaInfoId,
      description: cashFlowIndicatorName,
      shortDescription: cashFlowIndicatorName,
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
          metric: "net_income",
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
          defval: "net_income",
          type: "text" as StudyInputType.Text,
          optionsTitles: {
            net_income: "Net Income",
            depreciation_and_amortization: "Depreciation And Amortization",
            stock_based_compensation: "Stock Based Compensation",
            change_in_working_capital: "Working Capital",
            change_in_account_receivables: "Account Receivables",
            change_in_inventory: "Inventory",
            change_in_account_payable: "Account Payable",
            change_in_other_working_capital: "Other Working Capital",
            change_in_other_non_cash_items: "Other Non Cash Items",
            net_cash_from_operating_activities: "Net Cash From Operating Activities",
            purchase_of_property_plant_and_equipment:
              "Purchase Of Property Plant And Equipment",
            purchase_of_investment_securities: "Purchase Of Investment Securities",
            sale_and_maturity_of_investments: "Sale And Maturity Of Investments",
            other_investing_activities: "Other Investing Activities",
            net_cash_from_investing_activities:
              "Net Cash Used Provided By Investing Activities",
            issuance_of_common_equity: "Issuance Of Common Equity",
            repayment_of_debt: "Repayment Of Debt",
            other_financing_activities: "Other Financing Activities",
            net_cash_from_financing_activities:
              "Net Cash Used Provided By Financing Activities",
            net_change_in_cash_and_equivalents: "Net Change In Cash And Equivalents",
            effect_of_exchange_rate_changes_on_cash:
              "Effect Of Exchange Rate Changes On Cash",
            cash_at_end_of_period: "Cash At End Of Period",
            cash_at_beginning_of_period: "Cash At Beginning Of Period",
            operating_cash_flow: "Operating Cash Flow",
            capital_expenditure: "Capital Expenditure",
            free_cash_flow: "Free Cash Flow",
          },
          options: [
            "net_income",
            "depreciation_and_amortization",
            "stock_based_compensation",
            "change_in_working_capital",
            "change_in_account_receivables",
            "change_in_inventory",
            "change_in_account_payable",
            "change_in_other_working_capital",
            "change_in_other_non_cash_items",
            "net_cash_from_operating_activities",
            "purchase_of_property_plant_and_equipment",
            "purchase_of_investment_securities",
            "sale_and_maturity_of_investments",
            "other_investing_activities",
            "net_cash_from_investing_activities",
            "issuance_of_common_equity",
            "repayment_of_debt",
            "other_financing_activities",
            "net_cash_from_financing_activities",
            "net_change_in_cash_and_equivalents",
            "effect_of_exchange_rate_changes_on_cash",
            "cash_at_end_of_period",
            "cash_at_beginning_of_period",
            "operating_cash_flow",
            "capital_expenditure",
            "free_cash_flow",
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
        const metric = this._input(2) ?? "net_income";

        this._currentSymbol = symbol;

        this._context.new_sym(
          `${symbol}-cashflow-${period}-${metric}`,
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
        const cashFlowTime = this._context.new_unlimited_var(this._context.symbol.time);

        const symbol =
          regex.exec(this._input(0))?.[1] ?? PineJS.Std.ticker(this._context);
        const period = this._input(1) ?? "annually";
        const metric = this._input(2) ?? "net_income";

        if (this._currentSymbol !== symbol && !symbol.includes("cashflow")) {
          this._context.new_sym(
            `${symbol}-cashflow-${period}-${metric}`,
            period === "annually" ? "12M" : "3M",
            period === "annually" ? "12M" : "3M",
          );
          this._currentSymbol = symbol;
        }

        const metricClose = this._context.new_unlimited_var(
          PineJS.Std.close(this._context),
        );
        const alignedClose = metricClose.adopt(cashFlowTime, mainSymbolTime, 0);
        this._context.select_sym(0);

        return [alignedClose];
      };
    },
  };
};

export default CashFlowIndicator;
