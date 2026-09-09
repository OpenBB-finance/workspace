import type { EntityId } from "~/lib/charting_library/charting_library";

export type SecurityType = {
  id: string;
  symbol: string;
  label: string;
  color: string;
  category: "securities" | "crypto" | "indices";
  metrics: MetricType[];
  active: boolean;
};

export type MetricType = {
  id: string;
  dataKey?: string;
  callBack?: (data: any, plotlyData: any, security: SecurityType) => any;
  label: string;
  color: string;
  active: boolean;
  tvId?: EntityId;
  period?: "annual" | "quarter";
  newPane?: string;
  prevPane?: string;
};

export const CHARTING_COLORS = [
  "#005CA9",
  "#4ADE80",
  "#16A34A",
  "#33BBFF",
  "#F5B166",
  "#EF7D00",
  "#991B1B",
  "#FACCD8",
  "#E93361",
  "#CCBE00",
];

// We might want to create new mockup colors for metrics :D
export const METRIC_COLORS = [
  "#ef7d00",
  "#005ca9",
  "#9b30d9",
  "#af005f",
  "#26481f",
  "#822661",
  "#af87ff",
];

export const ICONS = {
  sunIcon: {
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    path: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z",
  },
  moonIcon: {
    viewBox: "0 0 25 25",
    width: 25,
    height: 25,
    path: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  },
};

export const layout_defaults = {
  overlaying: "y",
  side: "left",
  tickfont: { size: 12 },
  tickpadding: 5,
  showgrid: false,
  showline: false,
  showticklabels: true,
  showlegend: true,
  zeroline: false,
  anchor: "x",
  type: "linear",
  autorange: true,
  automargin: true,
};

export const TEMPLATES = {
  major: {
    label: "Major Asset Classes",
    children: [
      {
        label: "Commodities ETFs",
        description: "Major commodities performance",
        id: "major-commodities-etfs",
      },
    ],
  },
  economic: {
    label: "Economic",
    children: [
      {
        label: "Commodities",
        description: "Major commodities performance",
        id: "assets-commodities",
      },
      {
        label: "Currencies",
        description: "Major commodities performance",
        id: "assets-currencies",
      },
    ],
  },
  misc: {
    label: "Misc",
    children: [
      {
        label: "AAPL+BTC",
        description: "Apple and Bitcoin Prices",
        id: "aapl-btc",
        values: {
          securities: [
            {
              id: "BTC",
              label: "Bitcoin",
              category: "crypto",
              color: "#e6e227",
              metrics: [
                {
                  id: "total-return-price",
                  label: "Total Return",
                  color: "#e6e227",
                  active: true,
                },
              ],
              active: true,
            },
            {
              id: "AAPL",
              label: "Apple Inc.",
              category: "securities",
              color: "#171c45",
              metrics: [
                {
                  id: "total-return-price",
                  label: "Total Return",
                  color: "#171c45",
                  active: true,
                },
              ],
              active: true,
            },
          ],
        },
      },
    ],
  },
};

export const FINANCIAL_METRICS = {
  "income-statement": {
    label: "Income Statement",
    children: [
      {
        label: "Revenue",
        id: "revenue",
        description: "Revenue",
        children: [
          {
            label: "Revenue",
            id: "revenue",
            description: "Revenue",
          },
          {
            label: "Cost of Revenue",
            id: "cost_of_revenue",
            description: "Cost of Revenue",
          },
          {
            label: "Gross Profit",
            id: "gross_profit",
            description: "Gross Profit",
          },
          {
            label: "Gross Profit Margin",
            id: "gross_profit_margin",
            description: "Gross Profit Margin",
          },
          {
            label: "Research And Development Expense",
            id: "research_and_development_expense",
            description: "Research And Development Expense",
          },
          {
            label: "Selling General And Administrative Expense",
            id: "selling_general_and_admin_expense",
            description: "Selling General And Administrative Expense",
          },
          {
            label: "Other Expenses",
            id: "other_expenses",
            description: "Other Expenses",
          },
          {
            label: "Total Operating Expenses",
            id: "total_operating_expenses",
            description: "Total Operating Expenses",
          },
          {
            label: "Cost And Expenses",
            id: "cost_and_expenses",
            description: "Cost And Expenses",
          },
          {
            label: "Interest Income",
            id: "interest_income",
            description: "Interest Income",
          },
          {
            label: "Total Interest Expense",
            id: "total_interest_expense",
            description: "Total Interest Expense",
          },
          {
            label: "Depreciation And Amortization",
            id: "depreciation_and_amortization",
            description: "Depreciation And Amortization",
          },
          {
            label: "Ebitda",
            id: "ebitda",
            description: "Ebitda",
          },
          {
            label: "Ebitda Margin",
            id: "ebitda_margin",
            description: "Ebitda Margin",
          },
          {
            label: "Operating Income",
            id: "total_operating_income",
            description: "Operating Income",
          },
          {
            label: "Operating Income Margin",
            id: "operating_income_margin",
            description: "Operating Income Margin",
          },
          {
            label: "Total Other Income Expenses Net",
            id: "total_other_income_expenses",
            description: "Total Other Income Expenses Net",
          },
          {
            label: "Income Before Tax",
            id: "total_pre_tax_income",
            description: "Income Before Tax",
          },
          {
            label: "Income Before Tax Margin",
            id: "pre_tax_income_margin",
            description: "Income Before Tax Margin",
          },
          {
            label: "Income Tax Expense",
            id: "income_tax_expense",
            description: "Income Tax Expense",
          },
          {
            label: "Consolidated Net Income",
            id: "consolidated_net_income",
            description: "Consolidated Net Income",
          },
          {
            label: "Net Income Margin",
            id: "net_income_margin",
            description: "Net Income Margin",
          },
          {
            label: "Earnings Per Share",
            id: "basic_earnings_per_share",
            description: "Earnings Per Share",
          },
          {
            label: "Earnings Per Share Diluted",
            id: "diluted_earnings_per_share",
            description: "Earnings Per Share Diluted",
          },
          {
            label: "Weighted Average Shares Outstanding",
            id: "weighted_average_basic_shares_outstanding",
            description: "Weighted Average Shares Outstanding",
          },
          {
            label: "Weighted Average Shares Outstanding Diluted",
            id: "weighted_average_diluted_shares_outstanding",
            description: "Weighted Average Shares Outstanding Diluted",
          },
        ],
      },
    ],
  },
  "balance-sheet": {
    label: "Balance Sheet",
    children: [
      {
        label: "Assets",
        id: "assets",
        description: "Assets",
        children: [
          {
            label: "Cash And Cash Equivalents",
            id: "cash_and_cash_equivalents",
            description: "Cash And Cash Equivalents",
          },
          {
            label: "Short Term Investments",
            id: "short_term_investments",
            description: "Short Term Investments",
          },
          {
            label: "Net Receivables",
            id: "net_receivables",
            description: "Net Receivables",
          },
          {
            label: "Inventory",
            id: "inventory",
            description: "Inventory",
          },
          {
            label: "Other Current Assets",
            id: "other_current_assets",
            description: "Other Current Assets",
          },
          {
            label: "Total Current Assets",
            id: "total_current_assets",
            description: "Total Current Assets",
          },
        ],
      },
      {
        label: "Non_Current Assets",
        id: "non_current_assets",
        description: "Non_Current Assets",
        children: [
          {
            label: "Property Plant Equipment Net",
            id: "plant_property_equipment_net",
            description: "Property Plant Equipment Net",
          },
          {
            label: "Goodwill",
            id: "goodwill",
            description: "Goodwill",
          },
          {
            label: "Intangible Assets",
            id: "intangible_assets",
            description: "Intangible Assets",
          },
          {
            label: "Other Non_Current Assets",
            id: "other_non_current_assets",
            description: "Other Non_Current Assets",
          },
          {
            label: "Non_Current Assets",
            id: "non_current_assets",
            description: "Non_Current Assets",
          },
          {
            label: "Total Assets",
            id: "total_assets",
            description: "Total Assets",
          },
        ],
      },
      {
        label: "Liabilities",
        id: "liabilities",
        description: "Liabilities",
      },
      {
        label: "Current Liabilities",
        id: "current_liabilities",
        description: "Current Liabilities",
        children: [
          {
            label: "Accounts Payable",
            id: "accounts_payable",
            description: "Accounts Payable",
          },
          {
            label: "Short Term Debt",
            id: "short_term_debt",
            description: "Short Term Debt",
          },
          {
            label: "Tax Payables",
            id: "tax_payables",
            description: "Tax Payables",
          },
          {
            label: "Deferred Revenue",
            id: "current_deferred_revenue",
            description: "Deferred Revenue",
          },
          {
            label: "Other Current Liabilities",
            id: "other_current_liabilities",
            description: "Other Current Liabilities",
          },
          {
            label: "Total Current Liabilities",
            id: "total_current_liabilities",
            description: "Total Current Liabilities",
          },
          {
            label: "Total Liabilities",
            id: "total_liabilities",
            description: "Total Liabilities",
          },
        ],
      },
      {
        label: "Non_Current Liabilities",
        id: "non_current_liabilities",
        description: "Non_Current Liabilities",
        children: [
          {
            label: "Long Term Debt",
            id: "long_term_debt",
            description: "Long Term Debt",
          },
          {
            label: "Deferred Revenue Non_Current",
            id: "deferred_revenue_non_current",
            description: "Deferred Revenue Non_Current",
          },
          {
            label: "Deferred Tax Liabilities Non_Current",
            id: "deferred_tax_liabilities_non_current",
            description: "Deferred Tax Liabilities Non_Current",
          },
          {
            label: "Other Non_Current Liabilities",
            id: "other_non_current_liabilities",
            description: "Other Non_Current Liabilities",
          },
          {
            label: "Total Non_Current Liabilities",
            id: "total_non_current_liabilities",
            description: "Total Non_Current Liabilities",
          },
        ],
      },
      {
        label: "Stockholders Equity",
        id: "stockholders_equity",
        description: "Stockholders Equity",
        children: [
          {
            label: "Common Stock",
            id: "common_stock",
            description: "Common Stock",
          },
          {
            label: "Retained Earnings",
            id: "retained_earnings",
            description: "Retained Earnings",
          },
          {
            label: "Other Total Stock Holders Equity",
            id: "other_total_shareholders_equity",
            description: "Other Total Stock Holders Equity",
          },
          {
            label: "Total Liabilities Shareholders Equity",
            id: "total_liabilities_and_shareholders_equity",
            description: "Total Liabilities Shareholders Equity",
          },
        ],
      },
    ],
  },
  "cash-flow-statement": {
    label: "Cash Flow Statement",
    children: [
      {
        label: "Operating Activities",
        id: "cash_flows_from_operating_activities",
        description: "Cash Flows From Operating Activities",
        children: [
          {
            label: "Net Income",
            id: "net_income",
            description: "Net Income",
          },
          {
            label: "Depreciation And Amortization",
            id: "depreciation_and_amortization",
            description: "Depreciation And Amortization",
          },
          {
            label: "Stock Based Compensation",
            id: "stock_based_compensation",
            description: "Stock Based Compensation",
          },
          {
            label: "Change In Working Capital",
            id: "change_in_working_capital",
            description: "Change In Working Capital",
          },
          {
            label: "Changes In Account Receivables",
            id: "change_in_account_receivables",
            description: "Changes In Account Receivables",
          },
          {
            label: "Change In Inventory",
            id: "change_in_inventory",
            description: "Change In Inventory",
          },
          {
            label: "Change In Account Payable",
            id: "change_in_account_payable",
            description: "Change In Account Payable",
          },
          {
            label: "Change In Other Working Capital",
            id: "change_in_other_working_capital",
            description: "Change In Other Working Capital",
          },
          {
            label: "Change In Other Non Cash Items",
            id: "change_in_other_non_cash_items",
            description: "Change In Other Non Cash Items",
          },
          {
            label: "Net Cash From Operating Activities",
            id: "net_cash_from_operating_activities",
            description: "Net Cash From Operating Activities",
          },
        ],
      },
      {
        label: "Investing Activities",
        id: "cash_flows_from_investing_activities",
        description: "Cash Flows From Investing Activities",
        children: [
          {
            label: "Purchase Of Property Plant And Equipment",
            id: "purchase_of_property_plant_and_equipment",
            description: "Purchase Of Property Plant And Equipment",
          },
          {
            label: "Purchase Of Investment Securities",
            id: "purchase_of_investment_securities",
            description: "Purchase Of Investment Securities",
          },
          {
            label: "Sale And Maturity Of Investments",
            id: "sale_and_maturity_of_investments",
            description: "Sale And Maturity Of Investments",
          },
          {
            label: "Other Investing Activities",
            id: "other_investing_activities",
            description: "Other Investing Activities",
          },
          {
            label: "Net Cash Used Provided By Investing Activities",
            id: "net_cash_from_investing_activities",
            description: "Net Cash Used Provided By Investing Activities",
          },
        ],
      },
      {
        label: "Financing Activities",
        id: "cash_flows_from_financing_activities",
        description: "Cash Flows From Financing Activities",
        children: [
          {
            label: "Issuance Of Common Equity",
            id: "issuance_of_common_equity",
            description: "Issuance Of Common Equity",
          },
          {
            label: "Repayment Of Debt",
            id: "repayment_of_debt",
            description: "Repayment Of Debt",
          },
          {
            label: "Other Financing Activities",
            id: "other_financing_activities",
            description: "Other Financing Activities",
          },
          {
            label: "Net Cash Used Provided By Financing Activities",
            id: "net_cash_from_financing_activities",
            description: "Net Cash Used Provided By Financing Activities",
          },
        ],
      },
      {
        label: "Supplemental Cash Flows",
        id: "supplemental_cash_flows",
        description: "Supplemental Cash Flows",
        children: [
          {
            label: "Net Change In Cash And Equivalents",
            id: "net_change_in_cash_and_equivalents",
            description: "Net Change In Cash And Equivalents",
          },
          {
            label: "Effect Of Exchange Rate Changes On Cash",
            id: "effect_of_exchange_rate_changes_on_cash",
            description: "Effect Of Exchange Rate Changes On Cash",
          },
          {
            label: "Cash At End Of Period",
            id: "cash_at_end_of_period",
            description: "Cash At End Of Period",
          },
          {
            label: "Cash At Beginning Of Period",
            id: "cash_at_beginning_of_period",
            description: "Cash At Beginning Of Period",
          },
          {
            label: "Operating Cash Flow",
            id: "operating_cash_flow",
            description: "Operating Cash Flow",
          },
          {
            label: "Capital Expenditure",
            id: "capital_expenditure",
            description: "Capital Expenditure",
          },
          {
            label: "Free Cash Flow",
            id: "free_cash_flow",
            description: "Free Cash Flow",
          },
        ],
      },
    ],
  },
};
