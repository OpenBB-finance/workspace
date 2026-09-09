import { ArrowLeftIcon, SizeIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import DraggableCard from "~/components/DraggableCard";
import { NEWS } from "~/seeds/randomSeed";

const CUSTOMIZE_LINKS = {
  "Set API keys": "/settings/api-keys",
  "Select data sources": "/settings/data-sources",
  "Customize settings": "/settings/customize",
  "Flag rules": "/settings/flag-rules",
};

const INFORMATION_LINKS = {
  "Workspace Documentation": "/docs",
  Support: "/support",
  "Terms of Service": "/terms",
  "Check for updates": "/updates",
  "Fill out a survey": "/survey",
};

const ASSET_CLASSES = [
  {
    name: "Stocks",
    description:
      "Access historical pricing data, options, sector and industry, and overall due diligence",
  },
  {
    name: "Crypto",
    description:
      "Dive into onchain data, tokenomics, circulation supply, nfts and more",
  },
  {
    name: "ETF",
    description:
      "Exchange traded funds. Historical pricing, compare holdings and screening",
  },
  {
    name: "Economy",
    description: "Economic data, GDP, inflation, unemployment, and more",
  },
  {
    name: "Forex",
    description: "Forex data, currency pairs, historical pricing, and more",
  },
  {
    name: "Futures",
    description: "Commodities, bonds, index",
  },
  {
    name: "Alternative",
    description: "Alternative data, news, social media, and more",
  },
];

const OTHER_ASSETS = [
  {
    name: "Econometrics",
    description:
      "Statistical and quantitative methods for relationships between datasets",
  },
  {
    name: "Forecast",
    description: "Forecasting models for time series data",
  },
  {
    name: "Portfolio",
    description:
      "Perform portfolio optimization and look at portfolio performance and attribution",
  },
];

export default function Explore() {
  const [selectedAssetClass, setSelectedAssetClass] = useState<null | string>(null);

  return (
    <>
      <div
        className={clsx("flex justify-between mt-2", {
          "mb-2": selectedAssetClass,
        })}
      >
        <div>
          {selectedAssetClass && (
            <button
              onClick={() => setSelectedAssetClass(null)}
              className="flex items-center gap-2 text-[#0088CC] hover:underline uppercase text-sm"
            >
              <ArrowLeftIcon /> Go back to explore
            </button>
          )}
        </div>
      </div>
      {selectedAssetClass ? (
        <div>
          <div className="flex gap-5">
            <p className="uppercase tracking-widest font-bold text-lg w-40">
              {selectedAssetClass}
            </p>
            {ASSET_CLASSES.map((asset, idx) => {
              if (asset.name === selectedAssetClass) {
                return null;
              }
              return (
                <button
                  key={idx}
                  className="text-[#0088CC] hover:underline uppercase text-sm"
                  onClick={() => setSelectedAssetClass(asset.name)}
                >
                  {asset.name}
                </button>
              );
            })}
            {OTHER_ASSETS.map((asset, idx) => {
              if (asset.name === selectedAssetClass) {
                return null;
              }
              return (
                <button
                  key={idx}
                  className="text-[#0088CC] hover:underline uppercase text-sm"
                  onClick={() => setSelectedAssetClass(asset.name)}
                >
                  {asset.name}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-5 mt-4">
            <DraggableCard
              title="News"
              tooltipMessage="Find all the financial news that you may need"
            >
              <div className="flex flex-col gap-2 text-xs">
                {NEWS.map((news) => (
                  <div className="flex gap-2" key={news.title}>
                    <img
                      src={news.image}
                      alt=""
                      className="object-cover w-[50px] h-[36px]"
                    />
                    <div>
                      <p className="font-bold text-[#0088CC]">{news.title}</p>
                      <p className="text-[#808080]">
                        {news.source} - {news.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </DraggableCard>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <div className="col-span-2 rounded h-[264px] overflow-hidden bg-[#CCEEFF] shadow-xs">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/HLead2WTnIs"
                title="YouTube video player"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              />
            </div>
            <div className="col-span-2 flex gap-5 flex-col">
              <div className="bg-[#CCEEFF] rounded h-1/3 p-2.5 flex flex-col shadow-xs">
                <p className="text-xs font-bold">Customize your OpenBB experience</p>
                <ul className="flex justify-between text-xs mt-auto">
                  {Object.keys(CUSTOMIZE_LINKS).map((link, idx) => {
                    return (
                      <li key={idx}>
                        <Link
                          to={CUSTOMIZE_LINKS[link]}
                          className="text-[#0088CC] hover:underline"
                        >
                          {link}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="bg-white dark:bg-[#151518] rounded h-2/3 p-2.5 shadow-xs">
                <p className="text-xs font-bold">Information, guides and support</p>
                <ul className="flex flex-col text-xs mt-3 justify-between gap-2">
                  {Object.keys(INFORMATION_LINKS).map((link, idx) => {
                    return (
                      <li key={idx}>
                        <Link
                          to={INFORMATION_LINKS[link]}
                          className="text-[#0088CC] hover:underline"
                        >
                          {link}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
          <p className="uppercase tracking-widest font-bold my-5 text-lg">
            ASSET CLASSES
          </p>
          <div className="grid grid-cols-4 gap-5">
            {ASSET_CLASSES.map((asset, idx) => {
              return (
                <button
                  onClick={() => setSelectedAssetClass(asset.name)}
                  key={idx}
                  className="col-span-1 rounded h-[92px] overflow-hidden bg-white dark:bg-[#151518] p-2.5 shadow-xs cursor-pointer group flex flex-col text-left relative"
                >
                  <span className="absolute top-2.5 right-2.5 text-light-500">
                    <SizeIcon className="w-4 h-4" />
                  </span>
                  <p className="text-xs font-bold uppercase text-[#0088CC] mb-2 group-hover:underline">
                    {asset.name}
                  </p>
                  <p className="text-xs">{asset.description}</p>
                </button>
              );
            })}
          </div>
          <p className="uppercase tracking-widest font-bold my-5 text-lg">OTHERS</p>
          <div className="grid grid-cols-4 gap-5">
            {OTHER_ASSETS.map((asset, idx) => {
              return (
                <button
                  onClick={() => setSelectedAssetClass(asset.name)}
                  key={idx}
                  className="col-span-1 rounded h-[92px] overflow-hidden bg-white dark:bg-[#151518] p-2.5 shadow-xs cursor-pointer group flex flex-col text-left relative"
                >
                  <span className="absolute top-2.5 right-2.5 text-light-500">
                    <SizeIcon className="w-4 h-4" />
                  </span>
                  <p className="text-xs font-bold uppercase text-[#0088CC] mb-2 group-hover:underline">
                    {asset.name}
                  </p>
                  <p className="text-xs">{asset.description}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
