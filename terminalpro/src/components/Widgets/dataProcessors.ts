import dayjs from "dayjs";
import get from "lodash/get";
import {
  FINANCIAL_RATIO_COLS,
  getColumnDefs,
  getQuarterColumnDefs,
} from "~/components/General/Table/AgGridUtils";
import { getTableData, transposeData } from "~/components/General/Table/utils";
import type { WidgetT } from "~/components/types";
import { getIndicatorDescription } from "~/components/Widgets/Economy/constants";
import type * as schemas from "~/lib/api/sdkSchemas";
import { beautifySlug, formatNumber, getJsonColDefs, getJsonWidget } from "~/lib/utils";

export type ForwardTrendsData =
  | schemas.IntrinioForwardSalesEstimatesData
  | schemas.IntrinioForwardEpsEstimatesData;

export function processAgGridTableData(
  queryData: any,
  widget: WidgetT,
  decimalDigitsToUse: number,
) {
  const period = (widget.storage?.params?.period || "quarter") as "annual" | "quarter";
  const selectedGroup = widget.storage?.params?.selectedGroup ?? "liquidity";
  const columnDefsFromJSON = getJsonColDefs(widget);
  const widgetFromJSON = getJsonWidget(widget);

  let data = queryData?.results ?? queryData;
  if (widget?.external) {
    const dataKey = widget?.data?.dataKey;
    const results = get(queryData, dataKey, queryData);
    data = Array.isArray(results) ? results : [results];
  }

  if (!data?.length) return { rowData: [], columnDefs: [] };

  const showAll = widget.data?.table?.showAll ?? widgetFromJSON.data?.table?.showAll;
  const formatterFn =
    widget.data?.table?.formatterFn ?? widgetFromJSON.data?.table?.formatterFn;

  let rowData = getTableData(
    data,
    {
      data: {
        table: {
          transpose: widget?.storage?.transpose,
          columnsDefs: columnDefsFromJSON,
          showAll,
          formatterFn,
        },
      },
      external: widget?.external,
      widgetId: widget?.widgetId,
    } as WidgetT,
    { period },
  );

  if (widget?.widgetId === "financial_ratios") {
    const tabCols = FINANCIAL_RATIO_COLS[selectedGroup];
    if (widgetFromJSON?.data?.table?.transpose) {
      rowData = rowData.filter((row) => tabCols.includes(row.Index));
    }
  }

  if (rowData?.length) {
    const columnDefs = getColumnDefs(
      rowData,
      {
        widgetId: widget?.widgetId,
        external: widget?.external,
        storage: { enableAdvanced: widget?.storage?.enableAdvanced },
        data: {
          table: {
            columnsDefs: columnDefsFromJSON,
            transpose: widgetFromJSON?.data?.table?.transpose,
            formatterFn,
          },
        },
      },
      decimalDigitsToUse,
    );

    /*
    moved to AgGridUtils.ts getColumnDefs function
    for (const col of columnDefs) {
      if (col.chartDataType === "category") {
          col.enableRowGroup = true;
          col.enableValue = true;
          col.enablePivot = true;
        }

        if (col.cellDataType === "number") {
          col.allowedAggFuncs = ["sum", "min", "max", "avg", "count", "first", "last"];
          col.enableValue = true;
          col.enablePivot = true;
        }
      }*/

    if (["annual", "ttm"].includes(period)) return { rowData, columnDefs };

    const newColumnDefs = getQuarterColumnDefs(rowData, columnDefs);

    return { rowData, columnDefs: newColumnDefs };
  }
  return { rowData: [], columnDefs: [] };
}

export function processEarningsTranscriptData(
  queryData: schemas.OBBjectEarningsCallTranscript,
  widget: Partial<WidgetT>,
) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const selectedQuarter = widget.storage?.params?.quarter || `Q${dayjs().quarter()}`;
  const parsedQuarter = Number.parseInt(selectedQuarter.replace("Q", ""), 10);
  const element = data?.find((item) => item.quarter === parsedQuarter);

  return { rowData: [element] };
}

export function processETFClassificationData(queryData: schemas.OBBjectEtfInfo) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const element = data?.[0] as schemas.IntrinioEtfInfoData;

  const rowData = [
    {
      "ETF Classification": "Linked Index",
      Value: element?.index_linked,
    },
    {
      "ETF Classification": "Index Symbol",
      Value: element?.index_symbol,
    },
    {
      "ETF Classification": "Issuer",
      Value: element?.issuer,
    },
    {
      "ETF Classification": "Weighting Scheme",
      Value: element?.index_weighting_scheme,
    },
    {
      "ETF Classification": "Style",
      Value: element?.investment_style,
    },
    {
      "ETF Classification": "Replication Structure",
      Value: element?.replication_structure,
    },
    {
      "ETF Classification": "Developed Emerging",
      Value: element?.developed_emerging,
    },
    {
      "ETF Classification": "Continent",
      Value: element?.continent,
    },
    {
      "ETF Classification": "Country",
      Value: element?.specific_country,
    },
  ];

  return { rowData };
}

export function processETFCharacteristicsData(queryData: schemas.OBBjectEtfInfo) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const element = data?.[0] as schemas.IntrinioEtfInfoData;

  const rowData = [
    {
      "ETF Characteristics": "Developed Emerging",
      Value: element?.developed_emerging,
    },
    {
      "ETF Characteristics": "Derivatives Based",
      Value: element?.derivatives_based,
    },
    {
      "ETF Characteristics": "Replication Structure",
      Value: element?.replication_structure,
    },
    {
      "ETF Characteristics": "Currency Hedged",
      Value: element?.currency_hedged,
    },
    {
      "ETF Characteristics": "Inverse Leveraged",
      Value: element?.inverse_leveraged,
    },
    {
      "ETF Characteristics": "Sector",
      Value: element?.sector,
    },
    {
      "ETF Characteristics": "Industry",
      Value: element?.industry,
    },
    {
      "ETF Characteristics": "Sub-Industry",
      Value: element?.industry_group,
    },
    {
      "ETF Characteristics": "Cross-Sector Theme",
      Value: element?.cross_sector_theme,
    },
    {
      "ETF Characteristics": "Natural Resources Type",
      Value: element?.natural_resources_type,
    },
    {
      "ETF Characteristics": "Real Estate",
      Value: element?.real_estate,
    },
    {
      "ETF Characteristics": "Bond Type",
      Value: element?.bond_type,
    },
    {
      "ETF Characteristics": "Government Bond Types",
      Value: element?.government_bond_types,
    },
    {
      "ETF Characteristics": "Municipal Bond Region",
      Value: element?.municipal_bond_region,
    },
    {
      "ETF Characteristics": "Municipal VRDO",
      Value: element?.municipal_vrdo,
    },
    {
      "ETF Characteristics": "Mortgage Bond Types",
      Value: element?.mortgage_bond_types,
    },
    {
      "ETF Characteristics": "Bond Tax Status",
      Value: element?.bond_tax_status,
    },
    {
      "ETF Characteristics": "Credit Quality",
      Value: element?.credit_quality,
    },
    {
      "ETF Characteristics": "Average Maturity",
      Value: element?.average_maturity,
    },
    {
      "ETF Characteristics": "Specific Maturity Year",
      Value: element?.specific_maturity_year,
    },
    {
      "ETF Characteristics": "Bond Currency Denomination",
      Value: element?.bond_currency_denomination,
    },
    {
      "ETF Characteristics": "Laddered",
      Value: element?.laddered,
    },
    {
      "ETF Characteristics": "Zero Coupon",
      Value: element?.zero_coupon,
    },
    {
      "ETF Characteristics": "Floating Rate",
      Value: element?.floating_rate,
    },
    {
      "ETF Characteristics": "Build America Bonds",
      Value: element?.build_america_bonds,
    },
    {
      "ETF Characteristics": "Commodity Types",
      Value: element?.commodity_types,
    },
    {
      "ETF Characteristics": "Energy Type",
      Value: element?.energy_type,
    },
    {
      "ETF Characteristics": "Agricultural Type",
      Value: element?.agricultural_type,
    },
    {
      "ETF Characteristics": "Metal Type",
      Value: element?.metal_type,
    },
    {
      "ETF Characteristics": "Target Date Multi-Asset Type",
      Value: element?.target_date_multi_asset_type,
    },
    {
      "ETF Characteristics": "Currency Pair",
      Value: element?.currency_pair,
    },
  ].filter((item) => item.Value !== null && item.Value !== undefined);

  return { rowData };
}

export function processTopBarOverviewData(queryData: schemas.OBBjectEquityQuote) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  return {
    rowData: data.map((item) => {
      return {
        symbol: item.symbol,
        last_quote: item.last_price,
        prev_close: item.prev_close,
        day_change: item.change,
        day_change_percent: item.change_percent * 100,
        day_volume: item.volume,
      };
    }),
  };
}

export function processSingleBarOverviewData(queryData: schemas.OBBjectProWatchlist) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  return {
    rowData: data.map((item) => {
      return {
        symbol: item.symbol,
        last_quote: item.last_quote,
        prev_close: item.prev_close,
        day_change: item.day_change,
        day_change_percent: item.day_change_percent,
        day_volume: item.day_volume,
      };
    }),
  };
}

export function processShareStatisticsData(queryData: schemas.OBBjectShareStatistics) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const element = data?.[0] ?? (null as schemas.FMPShareStatisticsData);

  const rowData = Object.keys(element ?? {})
    ?.filter((key) => !["symbol", "date"].includes(key))
    ?.map((key) => {
      return {
        index: beautifySlug(key),
        value: element?.[key],
      };
    });

  return { rowData };
}

export function processRevenuePerData(
  queryData: schemas.OBBjectRevenueBusinessLine | schemas.OBBjectRevenueGeographic,
  widget: WidgetT,
) {
  if (!queryData) return { rowData: [], columnDefs: [] };

  let sortedData = queryData?.results;
  const dataKey = widget?.widgetId?.includes("bus_line")
    ? "business_line"
    : "geographic_segment";

  const interval = widget.storage?.params?.period || "annual";
  const chartView = widget.storage?.chartView?.enabled;

  if (interval === "annual") {
    sortedData = sortedData.sort((a: any, b: any) => b.fiscal_year - a.fiscal_year);
  }

  const { allKeys, ...newData } = sortedData.reduce(
    (acc, curr) => {
      const newDate = dayjs(curr.period_ending).year(curr.fiscal_year);
      const date =
        curr.fiscal_period !== "FY"
          ? newDate
              .quarter(Number.parseInt(curr.fiscal_period.replace("Q", ""), 10))
              .format("YYYY-MM-DD")
          : newDate.format("YYYY-MM-DD");

      if (!acc[date]) {
        acc[date] = {};
      }

      for (const key in curr[dataKey]) {
        const titleCase = key
          .replace(/\w\S*/g, (txt) =>
            `${txt.substring(0, 1).toUpperCase()}${txt
              .substring(1)
              .toLowerCase()}`.replace(/[.]/g, ""),
          )
          .trim()
          .replace("Index", "_Index");

        acc.allKeys.add(titleCase);

        acc[date][titleCase] = curr[dataKey][key];
      }

      return acc;
    },
    { allKeys: new Set<string>() } as { allKeys: Set<string> } & Record<string, any>,
  );

  const chartData = Object.entries(newData).map(([date, item]) => {
    const missingKeys = Array.from(allKeys)
      .filter((key) => !Object.keys(item).includes(key))
      .reduce((acc, key) => {
        acc[key] = null;
        return acc;
      }, {});

    return { date, ...item, ...missingKeys };
  });

  const rowData = chartView ? chartData : transposeData(chartData, {});

  const coldefs = getColumnDefs(
    rowData,
    {
      widgetId: widget.widgetId,
      external: widget?.external,
      data: {
        table: {
          transpose: !chartView,
        },
      },
    },
    0,
  );

  const columnDefs = ["annual", "ttm"].includes(interval)
    ? coldefs
    : getQuarterColumnDefs(rowData, coldefs);

  return { rowData, columnDefs };
}

export function processPriceTargetByAnalystData(
  data: schemas.OBBjectProPriceTargetByAnalyst,
) {
  const results = data?.results;
  if (!results?.length) return { rowData: [] };

  const rowData = results.map((item) => {
    const { analyst_data, ...rest } = item;
    return rest;
  });

  return { rowData };
}

export function processNewsData(
  queryData: schemas.OBBjectWorldNews | schemas.OBBjectCompanyNews,
) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const rowData = data?.map((result: schemas.BenzingaCompanyNewsData) => {
    const textHtml = result?.text ? result?.text : result?.teaser;
    const tickerRegex = /https:\/\/www\.benzinga\.com\/stock\/([A-Za-z0-9]+)/g;
    let match: any[];
    const symbolsFromTextHtml: string[] = [];
    while ((match = tickerRegex.exec(textHtml)) !== null) {
      symbolsFromTextHtml.push(match[1]);
    }
    const mergedSymbols = [
      ...(result?.stocks?.split(",")?.filter((s: string) => s !== "") ?? []),
      ...symbolsFromTextHtml,
    ];
    const uniqueSymbols = Array.from(new Set(mergedSymbols));

    const articleData = {
      ...result,
      channels: result?.channels?.split(",") ?? [],
      stocks: uniqueSymbols,
      tags: result?.tags?.split(",") ?? [],
    };

    return {
      date: result?.date,
      title: articleData?.title,
      description: articleData?.teaser,
      text: articleData?.text,
      stocks: articleData?.stocks
        .map((stock) => (stock.includes("$") ? `${stock.replace("$", "")}USD` : stock))
        .join(","),
    };
  });

  return { rowData };
}

export function processKeyMetricsData(queryData: schemas.OBBjectProKeyMetrics) {
  const result = queryData?.results?.[0];
  if (!result) return { rowData: [] };

  const element = {
    Beta: result?.beta,
    "Vol Avg": result?.avg_volume,
    "30D Avg Vol": result?.volume_avg_30,
    "Market Cap": result?.market_cap,
    Range: result?.day_low
      ? `${formatNumber(result?.day_low, 2)} - ${formatNumber(result?.day_high, 2)}`
      : null,
    "52-week High": result?.year_high,
    "52-week Low": result?.year_low,
    "Div Yield": result?.dividend_yield_ttm * 100,
    "P/E Ratio": result?.pe_ratio_ttm,
    "Net Asset Value": result?.net_asset_value,
    "Number of Holdings": result?.number_of_holdings,
    "Net Expense Ratio": result?.net_expense_ratio * 100,
    "Portfolio Turnover": result?.portfolio_turnover * 100,
  };

  const rowData = Object.entries(element)
    .filter(([_key, value]) => value)
    .map(([key, value]) => {
      return {
        "Key Metrics": key,
        Value: value,
      };
    });

  return { rowData };
}

export function processForwardTrendsData(
  queryData: schemas.OBBjectProEarningTrends,
  widget: WidgetT,
) {
  const data = queryData?.results as (
    | schemas.ProEarningTrends
    | schemas.ProRevenueTrends
  )[];

  if (!data) {
    return {
      rowData: [],
      numberOfAnalysts: 0,
      columnDefs: [],
      gridOptions: {},
    };
  }

  const period = (widget.storage?.params?.period || "quarter") as "annual" | "quarter";
  const chartView = widget.storage?.chartView?.enabled;
  const columnDefsFromJSON = getJsonColDefs(widget);

  const isQuarterly = period === "quarter";
  const { newData, numberOfAnalysts } = data.reduce(
    (acc, item) => {
      const historical_eps = item.historical_eps;
      const forward_trend: ForwardTrendsData[] = item.forward_sales ?? item.forward_eps;

      const newRows = [];

      const histKey = widget.widgetId === "earnings_trends" ? "eps" : "revenue";

      const period_endings: dayjs.Dayjs[] = [];
      for (const subItem of historical_eps) {
        if (!(subItem[`${histKey}_estimated`] && subItem[`${histKey}_actual`]))
          continue;

        const date = dayjs(subItem.date);
        if (!isQuarterly) {
          const index = newRows.findIndex(
            (row) => dayjs(row.date).year() === date.year(),
          );
          if (index !== -1) {
            newRows[index].estimated += subItem[`${histKey}_estimated`];
            newRows[index].actual += subItem[`${histKey}_actual`];
            continue;
          }
        }

        // makes sure we don't have forward data for the same period
        period_endings.push(date);

        newRows.push({
          date: subItem.date,
          estimated: subItem[`${histKey}_estimated`],
          actual: subItem[`${histKey}_actual`],
          forward: null,
        });
      }

      for (const subItem of forward_trend) {
        if (subItem.fiscal_period.startsWith(isQuarterly ? "FY" : "Q")) continue;

        let date = dayjs().year(subItem.fiscal_year);

        const quarter =
          isQuarterly && Number.parseInt(subItem.fiscal_period.slice(-1), 10);

        if (
          period_endings.some((d) => {
            if (isQuarterly) {
              return d.year() === date.year() && d.quarter() === quarter;
            }
            return d.year() === date.year();
          })
        ) {
          continue;
        }

        if (isQuarterly) {
          date = date.quarter(quarter);
        }

        acc.numberOfAnalysts += subItem.number_of_analysts;

        const newRow = {
          date: date.format("YYYY-MM-DD"),
          forward: subItem.mean,
          high: subItem.high_estimate,
          low: subItem.low_estimate,
          number_of_analysts: subItem.number_of_analysts,
        } as any;

        if (!chartView) {
          newRow.mean = subItem.mean;
        }

        newRows.push(newRow);
      }

      acc.newData.push(...newRows);

      return acc;
    },
    { newData: [] as any[], numberOfAnalysts: 0 },
  );

  const fakeWidget = {
    widgetId: widget.widgetId,
    data: {
      table: {
        transpose: !chartView,
        columnsDefs: columnDefsFromJSON.map((col) => {
          if (col.field === "forward") {
            col.hide = !chartView;
          }
          return col;
        }),
      },
    },
    storage: { reversed: chartView } as any,
  } as WidgetT;

  const tableData = getTableData(newData, fakeWidget, {
    period,
    ignoreUndefined: false,
  });

  let colDefs = getColumnDefs(tableData, fakeWidget, 3, false);

  if (isQuarterly && !chartView) {
    colDefs = getQuarterColumnDefs(tableData, colDefs);
  }

  return {
    rowData: tableData,
    columnDefs: colDefs,
    numberOfAnalysts,
    gridOptions: {
      rowHeight: 32,
      headerHeight: period === "quarter" && !chartView ? 22 : 32,
    },
  };
}

export const ConsensusTypes = {
  ebitda: "EBITDA",
  ebit: "EBIT",
  enterprise_value: "Enterprise Value",
  pretax_income: "Pretax Income",
  cash_flow_per_share: "Cash Flow Per Share",
};

export function processAnalystEstimatesData(
  queryData: schemas.OBBjectForwardEbitdaEstimates,
  widget: WidgetT,
) {
  const data = queryData?.results as schemas.IntrinioForwardEbitdaEstimatesData[];
  if (!data)
    return {
      rowData: [],
      numberOfAnalysts: 0,
      columnDefs: [],
      gridOptions: {},
    };

  const period = (widget.storage?.params?.fiscal_period || "quarter") as
    | "annual"
    | "quarter";
  const chartView = widget.storage?.chartView?.enabled;
  const columnDefsFromJSON = getJsonColDefs("analyst_estimates");

  const { newData, numberOfAnalysts } = data
    .filter(
      (item) =>
        (period === "annual" && item.fiscal_period !== "fq") || period === "quarter",
    )
    .reduce(
      (acc, item) => {
        const month = (period === "annual" ? 1 : item.calendar_period)
          .toString()
          .padStart(2, "0");

        const date = `${item.fiscal_year}-${month}-01`;
        acc.numberOfAnalysts += item.number_of_analysts;

        if (chartView) {
          const newRow = {
            date,
            [item.consensus_type]: item.mean,
            median: item.median,
            low_estimate: item.low_estimate,
            high_estimate: item.high_estimate,
            standard_deviation: item.standard_deviation,
            number_of_analysts: item.number_of_analysts,
          } as any;
          acc.newData.push(newRow);
        }

        if (!chartView && ConsensusTypes?.[item.consensus_type]) {
          const consType = ConsensusTypes?.[item.consensus_type];

          const row = acc.newData.find((r) => r.date === date);
          if (row) {
            row[consType] = item.mean;
          } else {
            acc.newData.push({ date, [consType]: item.mean });
          }
        }

        return acc;
      },
      { newData: [] as any[], numberOfAnalysts: 0 },
    );

  const fakeWidget = {
    widgetId: widget.widgetId,
    data: {
      table: {
        transpose: !chartView,
        columnsDefs: chartView ? columnDefsFromJSON : undefined,
      },
    },
    storage: { reversed: chartView } as WidgetT["storage"],
  } as WidgetT;

  const tableData = getTableData(newData, fakeWidget, {
    period,
    ignoreUndefined: false,
  });

  let colDefs = getColumnDefs(tableData, fakeWidget, 3, false);

  if (chartView) {
    for (const type of Object.keys(ConsensusTypes)) {
      const hasData = tableData.some((row) => row[type]);
      if (!hasData) {
        const index = colDefs.findIndex((col) => col.field === type);
        if (index !== -1) {
          colDefs.splice(index, 1);
        }
      }
    }
  }

  if (period === "quarter" && !chartView) {
    colDefs = getQuarterColumnDefs(tableData, colDefs);
  }

  return {
    rowData: tableData,
    columnDefs: colDefs,
    numberOfAnalysts,
    gridOptions: {
      rowHeight: 32,
      headerHeight: period === "quarter" && !chartView ? 22 : 32,
    },
  };
}

export function processEconomicOverviewData(queryData: schemas.OBBjectCountryProfile) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const rowData = data?.map((item) => ({
    country: item.country,
    population: item.population,
    gdp_usd: item.gdp_usd,
    gdp_qoq: item.gdp_qoq * 100,
    gdp_yoy: item.gdp_yoy * 100,
    cpi_yoy: item.cpi_yoy * 100,
    core_yoy: item.core_yoy * 100,
    retail_sales_yoy: item.retail_sales_yoy * 100,
    industrial_production_yoy: item.industrial_production_yoy * 100,
    policy_rate: item.policy_rate * 100,
    yield_10y: item.yield_10y * 100,
    govt_debt_gdp: item.govt_debt_gdp * 100,
    current_account_gdp: item.current_account_gdp * 100,
    jobless_rate: item.jobless_rate * 100,
  }));

  return { rowData };
}

export function processEconomicIndicatorsData(
  queryData: schemas.OBBjectEconomicIndicators,
) {
  const data = {
    extra: queryData?.extra?.results_metadata,
    results: queryData?.results,
  };
  if (!data?.results?.length) return { rowData: [] };

  const newData = data?.results
    ?.map((item) => {
      const extra = data?.extra?.[item.symbol];
      const isPercentage = [extra?.units, extra?.scale].includes("PERCENT");
      const multiplier = isPercentage ? 100 : extra?.multiplier || 1;

      return {
        date: item.date,
        units: extra?.units,
        indicator: item.symbol_root,
        full_indicator_name: getIndicatorDescription(item.symbol_root, isPercentage),
        value: item.value * multiplier,
        is_parent: item.is_parent,
      };
    })
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));

  const rowData = Object.values(
    newData?.reduce(
      (pivotData, item) => {
        if (!pivotData[item.indicator]) {
          pivotData[item.indicator] = {
            Index: item.full_indicator_name,
          };
        }

        pivotData[item.indicator][item.date] = item.value;

        return pivotData;
      },
      {} as Record<string, { [key: string]: any }>,
    ),
  );

  return { rowData };
}

export function processEconomicCalendarData(
  queryData: schemas.OBBjectEconomicCalendar,
  widget: WidgetT,
) {
  const data = queryData?.results;
  if (!data?.length) return { rowData: [] };

  const timezone = widget.storage?.timezone || "America/New_York";

  const rowData = data.map((item) => ({
    date: dayjs(item.date).tz(timezone).format("YYYY-MM-DD"),
    hours: dayjs(item.date).tz(timezone).format("hh:mm A"),
    country: item.country,
    impact: { Low: 1, Medium: 2, High: 3 }[item.importance] ?? "Low",
    event: item.event,
    eventMonth: dayjs(item.ReferenceDate).isValid()
      ? dayjs(item.ReferenceDate)?.tz(timezone).format("MMM")
      : "",
    actual: item.actual,
    previous: item.previous,
    consensus: item.consensus,
    forecast: item.forecast,
  }));

  return { rowData };
}

export function processCountryIndicatorsData(
  queryData: schemas.OBBjectEconomicIndicators,
) {
  const data = queryData?.results;
  if (!data) return { rowData: [] };

  const newData = data
    ?.filter((item) => item.is_parent)
    ?.map((item) => ({
      date: item.date,
      units: item.units,
      indicator: item.symbol_root,
      full_indicator_name: item.name,
      value: item.value,
      is_parent: item.is_parent,
    }));

  // Hack together a pivot by country
  const pivotData = newData?.reduce(
    (pivotData, item) => {
      if (!pivotData[item.indicator]) {
        const treePath = [item.indicator];
        pivotData[item.indicator] = {
          Index: item.indicator,
          indicator: item.indicator,
          full_indicator_name: item.full_indicator_name,
          parent: [item.indicator],
          units: item.units.replace("Mn.", "").replace("Thou.", ""),
        };
        if (typeof item.is_parent !== "boolean") {
          treePath.unshift(item.is_parent);
        }
        pivotData[item.indicator].parent = treePath;
      }

      let value = item.value;

      if (item.units.includes("%") && item.value) {
        value = item.value * 100;
      } else if (item.units.startsWith("Mn.") && item.value) {
        value = item.value * 1_000_000;
      } else if (item.units.startsWith("Thou.") && item.value) {
        value = item.value * 1_000;
      }

      pivotData[item.indicator][item.date] = value;

      return pivotData;
    },
    {} as Record<string, { parent: string[]; [key: string]: any }>,
  );

  const rowData = Object.values(pivotData).sort(
    (a, b) => b.parent.length - a.parent.length,
  );
  // sort by parent length

  return { rowData };
}

export const WidgetDataProcessors = {
  AgGridTable: processAgGridTableData,
  AnalystEstimates: processAnalystEstimatesData,
  CountryIndicators: processCountryIndicatorsData,
  EarningsTranscript: processEarningsTranscriptData,
  EconomicCalendar: processEconomicCalendarData,
  EconomicIndicators: processEconomicIndicatorsData,
  EconomicOverview: processEconomicOverviewData,
  ETFClassification: processETFClassificationData,
  ETFCharacteristics: processETFCharacteristicsData,
  ForwardTrends: processForwardTrendsData,
  KeyMetrics: processKeyMetricsData,
  News: processNewsData,
  RevenuePer: processRevenuePerData,
  ShareStatistics: processShareStatisticsData,
  SingleBarOverview: processSingleBarOverviewData,
  TopBarOverview: processTopBarOverviewData,
  PriceTargetByAnalyst: processPriceTargetByAnalystData,
} as const;
