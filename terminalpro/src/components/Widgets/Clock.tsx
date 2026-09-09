import { useEffect, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import SearchResultsNotFound from "../General/SearchResultsNotFound";

import NewAdvancedSelect from "../NewAdvancedSelect";
import { useWidgetContext } from "../Widget.context";

const timezones = [
  {
    city: "Midway",
    countryRegion: "MIDWAY ISLANDS - PACIFIC",
    gmt: "GMT-11:00",
    name: "Samoa Standard Time",
    code: "Pacific/Midway",
  },
  {
    city: "Honolulu",
    countryRegion: "HAWAII - AMERICA",
    gmt: "GMT-10:00",
    name: "Hawaii-Aleutian Standard Time",
    code: "Pacific/Honolulu",
  },
  {
    city: "Anchorage",
    countryRegion: "ALASKA - AMERICA",
    gmt: "GMT-9:00",
    name: "Alaska Standard Time",
    code: "America/Anchorage",
  },
  {
    city: "Los Angeles",
    countryRegion: "CALIFORNIA - AMERICA",
    gmt: "GMT-8:00",
    name: "Pacific Standard Time",
    code: "America/Los_Angeles",
  },
  {
    city: "Denver",
    countryRegion: "COLORADO - AMERICA",
    gmt: "GMT-7:00",
    name: "Mountain Standard Time",
    code: "America/Denver",
  },
  {
    city: "Chicago",
    countryRegion: "ILLINOIS - AMERICA",
    gmt: "GMT-6:00",
    name: "Central Standard Time",
    code: "America/Chicago",
  },
  {
    city: "New York",
    countryRegion: "NEW YORK - AMERICA",
    gmt: "GMT-5:00",
    name: "Eastern Standard Time",
    code: "America/New_York",
  },
  {
    city: "Buenos Aires",
    countryRegion: "ARGENTINA - AMERICA",
    gmt: "GMT-3:00",
    name: "Argentina Time",
    code: "America/Argentina/Buenos_Aires",
  },
  {
    city: "Sao Paulo",
    countryRegion: "BRAZIL - AMERICA",
    gmt: "GMT-3:00",
    name: "Brasília time",
    code: "America/Sao_Paulo",
  },
  {
    city: "London",
    countryRegion: "ENGLAND - EUROPE",
    gmt: "GMT+0:00",
    name: "Greenwich Mean Time",
    code: "Europe/London",
  },
  {
    city: "Paris",
    countryRegion: "FRANCE - EUROPE",
    gmt: "GMT+1:00",
    name: "Central European Time",
    code: "Europe/Paris",
  },
  {
    city: "Istanbul",
    countryRegion: "TURKEY - EUROPE",
    gmt: "GMT+3:00",
    name: "Eastern European Time",
    code: "Europe/Istanbul",
  },
  {
    city: "Dubai",
    countryRegion: "UNITED ARAB EMIRATES - ASIA",
    gmt: "GMT+4:00",
    name: "United Arab Emirates Standard Time",
    code: "Asia/Dubai",
  },
  {
    city: "Karachi",
    countryRegion: "PAKISTAN - ASIA",
    gmt: "GMT+5:00",
    name: "Pakistan Standard Time",
    code: "Asia/Karachi",
  },
  {
    city: "Kolkata",
    countryRegion: "INDIA - ASIA",
    gmt: "GMT+5:30",
    name: "Indian Standard Time",
    code: "Asia/Kolkata",
  },
  {
    city: "Shanghai",
    countryRegion: "CHINA - ASIA",
    gmt: "GMT+8:00",
    name: "China Standard Time",
    code: "Asia/Shanghai",
  },
  {
    city: "Tokyo",
    countryRegion: "JAPAN - ASIA",
    gmt: "GMT+9:00",
    name: "Japan Standard Time",
    code: "Asia/Tokyo",
  },
  {
    city: "Sydney",
    countryRegion: "NEW SOUTH WALES - AUSTRALIA",
    gmt: "GMT+10:00",
    name: "Australian Eastern Standard Time",
    code: "Australia/Sydney",
  },
  {
    city: "Auckland",
    countryRegion: "NEW ZEALAND - PACIFIC",
    gmt: "GMT+12:00",
    name: "New Zealand Standard Time",
    code: "Pacific/Auckland",
  },
];

export default function ClockWidget() {
  const { widget, updateWidget } = useWidgetContext();

  return (
    <DraggableCard
      extraClassName="flex flex-col divide-y divide-surface-divider"
      elementNextToTitle={
        <NewAdvancedSelect
          selected={widget?.storage?.timezones ?? []}
          values={timezones.map((timezone) => ({
            label: timezone.city,
            value: timezone.code,
            extraInfo: {
              rightOfDescription: timezone.gmt,
              description: timezone.countryRegion,
            },
          }))}
          label="Timezones"
          onSelect={(value) => {
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                timezones: value as string[],
              },
            }));
          }}
        />
      }
    >
      {!widget?.storage?.timezones ||
        (widget?.storage?.timezones?.length === 0 && (
          <SearchResultsNotFound
            icon={true}
            firstMessage="No timezones added yet"
            secondMessage="Add a timezone to see the time"
          />
        ))}
      {widget?.storage?.timezones?.map((timezone) => {
        const timezoneObject = timezones.find((t) => t.code === timezone);
        if (!timezoneObject) return null;
        return (
          <div
            className="flex justify-between py-1 first:pt-0 last:pb-0 _widget-content"
            key={timezone}
          >
            <div className="flex flex-col gap-1">
              <span className="font-bold">{timezoneObject.city}</span>
              <span className="text-2xs uppercase tracking-wide text-light-400 dark:text-[#6D6E74]">
                {timezoneObject.countryRegion}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-bold">
                <ClockTime timezone={timezoneObject.code} />
              </span>
              <span className="inline-flex gap-1 text-2xs text-light-400 dark:text-[#6D6E74]">
                <span>{timezoneObject.name}</span>
                <span>|</span>
                <span>{timezoneObject.gmt}</span>
              </span>
            </div>
          </div>
        );
      })}
    </DraggableCard>
  );
}

function ClockTime({ timezone }: { timezone: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000 * 60);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <span>
      {new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(time)}
    </span>
  );
}
