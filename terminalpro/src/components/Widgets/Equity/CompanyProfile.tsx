import { useMemo } from "react";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useEquityFundamentalOverview, useEtfInfo } from "~/lib/api/sdkComponents";
import type {
  FMPCompanyOverviewData as CompanyOverview,
  IntrinioEtfInfoData as IntrinioEtfInfo,
} from "~/lib/api/sdkSchemas";
import type { Ticker } from "~/lib/state/app";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function CompanyProfile() {
  const widget = useWidgetContext()?.widget;

  const category = widget.data?.mainTicker?.category ?? "equity";

  const useQueryFn = category === "etf" ? useEtfInfo : useEquityFundamentalOverview;

  const {
    data: queryData,
    isLoading,
    error,
    dataUpdatedAt,
  } = useQueryFn(
    {
      queryParams: {
        // @ts-expect-error
        provider: category === "etf" ? "intrinio" : "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const element = useMemo(() => {
    if (category === "etf") return queryData?.results?.[0] as IntrinioEtfInfo;
    return queryData?.results as unknown as CompanyOverview;
  }, [queryData, category]);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={element}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
      loading={isLoading}
      error={error || !element}
    >
      <SetLoadingOnResize>
        {category === "equity" ? (
          <EquityProfile element={element as CompanyOverview} />
        ) : (
          <EtfProfile
            element={element as IntrinioEtfInfo}
            mainTicker={widget.data?.mainTicker}
          />
        )}
      </SetLoadingOnResize>
    </DraggableCard>
  );
}

export function EquityProfile({ element }: { element: CompanyOverview }) {
  const memoizedElement = useMemo(() => {
    if (!element) return null;
    return (
      <>
        <div className="space-y-1 _widget-content">
          <p className="font-bold">{element?.company_name}</p>
          <p>{element?.address}</p>
          <div className="">
            <a
              href={`tel:${element?.phone}`}
              target="_blank"
              rel="noreferrer noopener"
              className="obb-hyper-link"
            >
              {element?.phone}
            </a>
            {", "}
            <a
              href={element?.website}
              target="_blank"
              rel="noreferrer noopener"
              className="obb-hyper-link"
            >
              {element?.website}
            </a>
          </div>
          <div className="flex gap-1">
            <p>
              Sector: <span className="font-medium">{element?.sector}</span>,
            </p>
            <p>
              Industry: <span className="font-medium">{element?.industry}</span>
            </p>
          </div>
          <p>
            Full time employees:{" "}
            <span className="font-medium">{element?.full_time_employees}</span>
          </p>
          <div className="flex gap-1">
            <p>
              CIK: <span className="font-medium">{element?.cik}</span>,
            </p>
            <p>
              ISIN: <span className="font-medium">{element?.isin}</span>,
            </p>
            <p>
              CUSIP: <span className="font-medium">{element?.cusip}</span>
            </p>
          </div>
          <div className="flex gap-1">
            <p>
              Exchange:{" "}
              <span className="font-medium">{element?.exchange_short_name}</span>,
            </p>
            <p>
              IPO Date: <span className="font-medium">{element?.ipo_date}</span>
            </p>
          </div>
        </div>
        <div className="obb-divider my-2.5" />
        <p className="mb-2 font-bold">Description</p>
        <p
          className="text-xs"
          style={{
            lineHeight: "1.2rem",
          }}
        >
          {element?.description}
        </p>
      </>
    );
  }, [Object.keys(element ?? {})]);

  return memoizedElement;
}

export function EtfProfile({
  element,
  mainTicker,
}: {
  element: IntrinioEtfInfo;
  mainTicker: Ticker;
}) {
  const memoizedElement = useMemo(() => {
    if (!element) return null;
    return (
      <>
        <div className="space-y-1 _widget-content">
          <p className="font-bold">{element?.name}</p>
          <p>
            Primary Benchmark: {element?.index_name} ({element?.index_symbol})
          </p>
          <p>Domicile: {element?.specific_country}</p>
          <div className="flex gap-1">
            <p>
              Sector:<span className="font-medium"> {element?.sector || "N/A"}</span>
            </p>
            {", "}
            <p>
              Industry:{" "}
              <span className="font-medium">{element?.industry || "N/A"}</span>
            </p>
          </div>
          <div className="flex gap-1">
            {element?.issuer && (
              <p>
                Issuer: <span className="font-medium">{element?.issuer}</span>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <p>
              ISIN: <span className="font-medium">{element?.isin}</span>,
            </p>
            <p>
              CUSIP: <span className="font-medium">{mainTicker?.cusip}</span>
            </p>
          </div>
          {element?.website && (
            <div className="">
              <a
                href={element?.website}
                target="_blank"
                rel="noreferrer noopener"
                className="obb-hyper-link"
              >
                {element?.website}
              </a>
            </div>
          )}
          <div className="flex gap-1">
            <p>
              Exchange: <span className="font-medium">{element?.exchange}</span>,
            </p>
            <p>
              Inception Date:{" "}
              <span className="font-medium">{element?.inception_date}</span>
            </p>
          </div>
        </div>
        <div className="obb-divider my-2.5" />
        <p className="mb-2 font-bold">Description</p>
        <p
          className="text-xs"
          style={{
            lineHeight: "1.2rem",
          }}
        >
          {element?.description}
        </p>
      </>
    );
  }, [Object.keys(element ?? {})]);

  return memoizedElement;
}
