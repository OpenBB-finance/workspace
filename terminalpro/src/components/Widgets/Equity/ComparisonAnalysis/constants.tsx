import type { ColDef } from "ag-grid-enterprise";
import Avatar from "~/components/General/Avatar";

export const COMPARISON_TYPES = [
  {
    label: "Valuation Multiples",
    value: "valuation_multiples",
  },
  {
    label: "Financial Ratios",
    value: "financial_ratios",
  },
] as const;

export const FINANCIAL_RATIOS = [
  {
    label: "Liquidity",
    value: "liquidity",
  },
  {
    label: "Efficiency",
    value: "efficiency",
  },
  {
    label: "Profitability",
    value: "profitability",
  },
  {
    label: "Leverage",
    value: "leverage",
  },
  {
    label: "Coverage",
    value: "coverage",
  },
  {
    label: "Operating Cash Flow",
    value: "operating_cash_flow",
  },
] as const;

const TICKER_COL = {
  field: "symbol",
  headerName: "Name",
  pinned: "left",
  width: 200,
  minWidth: 120,
  chartDataType: "category" as const,
  tooltipValueGetter: (params) => `${params?.data?.name} (${params.value})`,
  cellRenderer: (params) => {
    return (
      <span className="flex items-center gap-2 text-xs">
        <Avatar
          src={`https://images.openbb.co/logos/${params.value}`}
          alt={params.value}
          size={24}
          extraClassName="shrink-0"
        />
        <span className="flex flex-col gap-px">
          <span className="text-left font-bold uppercase">{params.value}</span>
          <span>{params?.data?.name}</span>
        </span>
      </span>
    );
  },
} as ColDef;

export const VALUATION_COLS = [
  TICKER_COL,
  {
    field: "pe_ratio",
    headerName: "P/E Ratio",
    type: "numericColumn",
  },
  {
    field: "price_to_sales_ratio",
    headerName: "P/S Ratio",
    type: "numericColumn",
  },
  {
    field: "price_to_book_ratio",
    headerName: "P/B Ratio",
    type: "numericColumn",
  },
  {
    field: "enterprise_value_to_sales_ratio",
    headerName: "EV/S Ratio",
    type: "numericColumn",
  },
  {
    field: "enterprise_value_over_ebitda",
    type: "numericColumn",
    headerName: "EV/EBITDA",
  },
  {
    field: "dividend_yield",
    headerName: "Dividend Yield",
    type: "numericColumn",
  },
];

export const FINANCIAL_RATIO_COLS = {
  liquidity: [
    TICKER_COL,
    {
      field: "current_ratio",
      headerName: "Current Ratio",
      type: "numericColumn",
    },
    {
      field: "quick_ratio",
      headerName: "Quick Ratio",
      type: "numericColumn",
    },
    {
      field: "cash_ratio",
      headerName: "Cash Ratio",
      type: "numericColumn",
    },
  ],
  efficiency: [
    TICKER_COL,
    {
      field: "days_of_sales_outstanding",
      headerName: "Days of Sales Outstanding",
      type: "numericColumn",
    },
    {
      field: "days_of_inventory_outstanding",
      headerName: "Days of Inventory Outstanding",
      type: "numericColumn",
    },
    {
      field: "operating_cycle",
      headerName: "Operating Cycle",
      type: "numericColumn",
    },
    {
      field: "days_of_payables_outstanding",
      headerName: "Days of Payables Outstanding",
      type: "numericColumn",
    },
    {
      field: "cash_conversion_cycle",
      headerName: "Cash Conversion Cycle",
      type: "numericColumn",
    },
    {
      field: "receivables_turnover",
      headerName: "Receivables Turnover",
      type: "numericColumn",
    },
    {
      field: "inventory_turnover",
      headerName: "Inventory Turnover",
      type: "numericColumn",
    },
    {
      field: "fixed_asset_turnover",
      headerName: "Fixed Assets Turnover",
      type: "numericColumn",
    },
    {
      field: "asset_turnover",
      headerName: "Asset Turnover",
      type: "numericColumn",
    },
  ],
  profitability: [
    TICKER_COL,
    {
      field: "gross_profit_margin",
      headerName: "Gross Profit Margin",
      type: "numericColumn",
    },
    {
      field: "operating_profit_margin",
      headerName: "Operating Profit Margin",
      type: "numericColumn",
    },
    {
      field: "pretax_profit_margin",
      headerName: "Pretax Profit Margin",
      type: "numericColumn",
    },
    {
      field: "net_profit_margin",
      headerName: "Net Profit Margin",
      type: "numericColumn",
    },
    {
      field: "effective_tax_rate",
      headerName: "Effective Tax Rate",
      type: "numericColumn",
    },
    {
      field: "return_on_assets",
      headerName: "Return on Assets",
      type: "numericColumn",
    },
    {
      field: "return_on_equity",
      headerName: "Return on Equity",
      type: "numericColumn",
    },
    {
      field: "return_on_capital_employed",
      headerName: "Return on Capital Employed",
      type: "numericColumn",
    },
    {
      field: "net_income_per_ebt",
      headerName: "Net Income per EBT",
      type: "numericColumn",
    },
    {
      field: "ebit_per_revenue",
      headerName: "EBIT per Total Revenue",
      type: "numericColumn",
    },
  ],
  leverage: [
    TICKER_COL,
    {
      field: "debt_ratio",
      headerName: "Debt Ratio",
      type: "numericColumn",
    },
    {
      field: "debt_equity_ratio",
      headerName: "Debt to Equity Ratio",
      type: "numericColumn",
    },
    {
      field: "long_term_debt_to_capitalization",
      headerName: "Long Term Debt to Capitalization",
      type: "numericColumn",
    },
    {
      field: "total_debt_to_capitalization",
      headerName: "Total Debt to Capitalization",
      type: "numericColumn",
    },
    {
      field: "interest_coverage_ratio",
      headerName: "Interest Coverage",
      type: "numericColumn",
    },
    {
      field: "cash_flow_to_debt",
      headerName: "Cash Flow to Debt Ratio",
      type: "numericColumn",
    },
    {
      field: "company_equity_multiplier",
      headerName: "Company Equity Multiplier",
      type: "numericColumn",
    },
  ],
  coverage: [
    TICKER_COL,
    {
      field: "cash_flow_coverage_ratio",
      headerName: "Cash Flow Coverage Ratio",
      type: "numericColumn",
    },
    {
      field: "short_term_coverage_ratio",
      headerName: "Short Term Coverage Ratio",
      type: "numericColumn",
    },
    {
      field: "capital_expenditure_coverage_ratio",
      headerName: "Capital Expenditure Coverage Ratio",
      type: "numericColumn",
    },
    {
      field: "dividend_paid_and_capex_coverage_ratio",
      headerName: "Dividend Paid and Capex Coverage Ratio",
      type: "numericColumn",
    },
  ],
  operating_cash_flow: [
    TICKER_COL,
    {
      field: "operating_cash_flow_per_share",
      headerName: "Operating Cash Flow per Share",
      type: "numericColumn",
    },
    {
      field: "free_cash_flow_per_share",
      headerName: "Free Cash Flow per Share",
      type: "numericColumn",
    },
    {
      field: "cash_per_share",
      headerName: "Cash per Share",
      type: "numericColumn",
    },
    {
      field: "operating_cash_flow_sales_ratio",
      headerName: "Operating Cash Flow Sales Ratio",
      type: "numericColumn",
    },
    {
      field: "free_cash_flow_operating_cash_flow_ratio",
      headerName: "Free Cash Flow Operating Cash Flow Ratio",
      type: "numericColumn",
    },
    {
      field: "cash_flow_coverage_ratio",
      headerName: "Cash Flow Coverage Ratio",
      type: "numericColumn",
    },
  ],
};
