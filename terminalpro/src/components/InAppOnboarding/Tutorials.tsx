import { useMemo, useState } from "react";
import { DialogVideo } from "~/routes/appHome";
import SearchResultsNotFound from "../General/SearchResultsNotFound";

export const TUTORIALS = [
  {
    label: "10x Your Workflow With AI",
    videoUrl:
      "https://openbb-cms.directus.app/assets/c81011bb-e64c-4e86-b00c-f0e26ebe6966",
    thumbnail: "/assets/images/home/covers/10xyourworkflowwithai.webp",
  },
  {
    label: "Bring in Your Data",
    videoUrl:
      "https://openbb-cms.directus.app/assets/f5c43d89-3701-44b1-a0af-cb06a4fba027",
    thumbnail: "/assets/images/home/covers/bringinyourdata.webp",
  },
  {
    label: "Overlay Time Series From Multiple Asset Classes",
    videoUrl:
      "https://openbb-cms.directus.app/assets/4eb0f651-778d-45b7-8e08-ce593dc02bfd",
    thumbnail:
      "/assets/images/home/covers/overlaytimeseriesfrommultipleassetclasses.webp",
  },
  {
    label: "Build Your Own Charts From Raw Data",
    videoUrl:
      "https://openbb-cms.directus.app/assets/0a0f80ed-f03a-4d4c-a90a-0063e401a72a",
    thumbnail: "/assets/images/home/covers/buildyourownchartsfromrawdata.webp",
  },
  {
    label: "Create Your Own Custom Reports",
    videoUrl:
      "https://openbb-cms.directus.app/assets/471107ae-1365-4325-89b9-d31c5d166d41",
    thumbnail: "/assets/images/home/covers/createyourowncustomreport.webp",
  },
  {
    label: "Layouts and Watchlist",
    videoUrl:
      "https://openbb-cms.directus.app/assets/d638af42-12bb-4d9c-a0ef-4c31d556f0a9",
    thumbnail: "/assets/images/home/covers/layoutsandwatchlist.webp",
  },
  {
    label: "Custom Backend",
    videoUrl:
      "https://openbb-cms.directus.app/assets/ae649e18-f21c-4745-8da2-4be03d5d4fea",
    thumbnail: "/assets/images/home/covers/cover_cbackend.webp",
  },
  {
    label: "Custom Copilots",
    videoUrl:
      "https://openbb-cms.directus.app/assets/fcbd145a-7657-441c-abf1-2ed50980356c",
    thumbnail: "/assets/images/home/covers/customcopilots.webp",
  },
];

export default function Tutorials() {
  const [globalFilter] = useState("");
  const tutorialsFiltered = useMemo(() => {
    return TUTORIALS.filter((tutorial) =>
      tutorial.label.toLowerCase().includes(globalFilter.toLowerCase()),
    );
  }, [globalFilter]);
  return (
    <div className="flex flex-col gap-2.5 mt-6 dark:bg-dark-850 rounded-lg bg-light-50 p-4 text-xs">
      <p className="text-sm font-bold">Tutorials</p>
      <div className="grid grid-cols-3 grid-rows-2 gap-6">
        {tutorialsFiltered.length === 0 && (
          <SearchResultsNotFound
            icon={true}
            firstMessage="No tutorials found"
            secondMessage="Try searching for something else"
          />
        )}
        {tutorialsFiltered.map((tutorial) => (
          <div className="flex flex-col items-start" key={tutorial.label}>
            <DialogVideo videoUrl={tutorial.videoUrl} thumbnail={tutorial.thumbnail} />
            <p className="mt-1 text-left text-light-600 dark:text-light-400 min-h-[3em]">
              {tutorial.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
