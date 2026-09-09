import dayjs from "dayjs";
import dayjsBusinessDays from "dayjs-business-days2";
import moment from "moment-timezone";
import posthog from "posthog-js";
import { CFError } from "./errors";

dayjs.extend(dayjsBusinessDays);

const MINUTE_MILLISECONDS = 60 * 1000;
const DAY_MILLISECONDS = 86400000;
const MS_DAY_OFFSET = 25569;

const oaDateToTicks = (oaDate: number): number => {
  let ticks = (oaDate - MS_DAY_OFFSET) * DAY_MILLISECONDS;
  if (oaDate < 0) {
    const frac = (oaDate - Math.trunc(oaDate)) * DAY_MILLISECONDS;
    if (frac !== 0) {
      ticks -= frac * 2;
    }
  }
  return ticks;
};

const ticksToOADate = (ticks: number): number => {
  let oad = ticks / DAY_MILLISECONDS + MS_DAY_OFFSET;
  if (oad < 0) {
    const frac = oad - Math.trunc(oad);
    if (frac !== 0) {
      oad = Math.ceil(oad) - frac - 2;
    }
  }
  return oad;
};

/**
 * @description Takes an oaDate that is not in UTC and converts it to a UTC moment offset by a number of minutes
 *
 * @param {number} oaDate
 * @param {number} offsetToUtcInMinutes
 * @returns {moment.Moment}
 */
export const fromOADateOffsetToUtcByMinutes = (
  oaDate: number,
  offsetToUtcInMinutes: number,
): moment.Moment => {
  const offsetInTicks = offsetToUtcInMinutes * MINUTE_MILLISECONDS;
  const ticks = oaDateToTicks(oaDate);
  return moment(ticks + offsetInTicks).utc();
};

/**
 * @description Takes an oaDate that is not in UTC and converts it to a UTC moment offset by the specified timezone
 *
 * @param {number} oaDate
 * @param {string} timezone
 * @returns {moment.Moment}
 */
export const fromOADateOffsetToUtcByTimezone = (
  oaDate: number,
  timezone: string,
): moment.Moment => {
  if (!moment.tz.zone(timezone)) {
    throw CFError("Timezone provided is not available in moment-timezone.js");
  }
  const ticks = oaDateToTicks(oaDate);
  const offset = moment(ticks).tz(timezone).utcOffset() * MINUTE_MILLISECONDS;
  return moment.tz(ticks - offset, timezone).utc();
};

/**
 * @description Takes an oaDate that is in UTC and converts it to a UTC moment or takes an oaDate and an offset to UTC and converts it to a UTC moment. The offset can be an int representing the offset to UTC in minutes or a string indicating the timezone of the oaDate.
 *
 * @param {number} oaDate
 * @param {string|number|undefined} offset
 * @returns {moment.Moment}
 */
export const fromOADate = (
  oaDate: number,
  offset?: string | number,
): moment.Moment => {
  if (Number.isNaN(parseInt(oaDate.toString(), 10))) {
    throw new TypeError(
      "fromOADate requires an oaDate that is not null or undefined",
    );
  }

  /* no offset */
  if (!offset) {
    return fromOADateOffsetToUtcByMinutes(oaDate, 0);
  }

  /* timezone */
  const parsedOffset = parseInt(offset.toString(), 10);
  if (Number.isNaN(parsedOffset)) {
    return fromOADateOffsetToUtcByTimezone(oaDate, offset.toString());
  }

  /* minutes */
  return fromOADateOffsetToUtcByMinutes(oaDate, parsedOffset);
};

/**
 * @description Converts a moment to a UTC OLE automation date represented as a double
 *
 * @param {moment.Moment} momentObj
 * @returns {number}
 */
export const toOADate = (momentObj: moment.Moment): number => {
  const milliseconds = momentObj.valueOf();
  return ticksToOADate(milliseconds);
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isNumber(value: any): boolean {
  return (
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !isNaN(Number(value))
  );
}

/**
 * @description Converts an Excel date to a string
 *
 * @param {string | undefined | null} excelDate
 * @returns {string | string[][]}
 */
export default function excelDateToString(
  excelDate: string | undefined | null,
): string {
  if (excelDate == null || excelDate === undefined || excelDate === "") {
    return "";
  }

  try {
    if (isNumber(excelDate)) {
      return fromOADate(parseInt(excelDate)).format("YYYY-MM-DD");
    }

    const date = moment(excelDate.replaceAll("/", "-"), moment.ISO_8601).format(
      "YYYY-MM-DD",
    );
    if (date === "Invalid date") {
      throw CFError("Invalid date");
    }
    return date;
  } catch (e) {
    throw CFError(
      `Invalid date -> '${excelDate}'. Use YYYY-MM-DD format or Excel date.`,
    );
  }
}

/**
 * @description Checks if a date is expired
 *
 * @param {string | null} expiration
 * @returns {boolean}
 */
export function isExpired(expiration: string | null | undefined): boolean {
  if (!expiration) return true;
  try {
    const date = new Date(expiration);
    return date < new Date();
  } catch (error) {
    console.error(error);
    return true;
  }
}

/**
 * Returns datetime format information from the system
 *
 * @param {string} prop Options: longDatePattern, shortDatePattern, dateSeparator, longTimePattern, timeSeparator
 * @returns {Promise<string>}
 */
async function getDateInfo(prop: string): Promise<string> {
  try {
    let systemInfo = "";

    await Excel.run(async (context) => {
      context.application.cultureInfo.datetimeFormat.load([prop]);
      await context.sync();
      systemInfo = context.application.cultureInfo.datetimeFormat[prop];
    });

    // Check if the systemInfo contains only 'm', 'd', 'y' or separators like '/', '.', '-'
    // If not it's likely a locale date format that Office.js doesn't support
    const validPattern = /^[mdy/.-]*$/i;
    if (!validPattern.test(systemInfo)) {
      throw new Error(`Date format contains invalid characters: ${systemInfo}`);
    }

    return systemInfo;
  } catch (error) {
    posthog.capture("date_info_error", { error_message: error.message });
    console.warn("Error fetching date info:", error);
    return "m/d/yyyy";
  }
}

let SHORT_DATE_PATTERN: string;

Office.onReady(async () => {
  SHORT_DATE_PATTERN = await getDateInfo("shortDatePattern");
});

export function getShortDatePattern(): string | undefined {
  return SHORT_DATE_PATTERN;
}

type DateModifier<T = number> = {
  mod: "+" | "-";
  amt: T;
  unit: Extract<dayjs.ManipulateType, "h" | "d" | "w" | "M" | "Q" | "y"> | "b";
};
const dateModRegex = new RegExp(
  /(?:\$(currentDate)(?<mod>[+-]))(?<amt>(\d+))(?<unit>([bhdwmyq]))/i,
);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
/* eslint-disable @typescript-eslint/no-explicit-any */
function isDate(value: any): boolean {
  return datePattern.test(value?.toString()) && dayjs(value).isValid();
}

export type DateModifierValue =
  `$currentDate${DateModifier["mod"]}${DateModifier["amt"]}${DateModifier["unit"]}`;

function modFunction(date: dayjs.Dayjs, dateModifier: DateModifier<string>) {
  const { mod, amt, unit } = dateModifier;
  const num = Number(amt);
  if (unit === "b") {
    return mod === "+"
      ? date.businessDaysAdd(num)
      : date.businessDaysSubtract(num);
  }
  return mod === "+" ? date.add(num, unit) : date.subtract(num, unit);
}

export function currentDateModifier(value: DateModifierValue | string) {
  // If it's a regular date string (YYYY-MM-DD), return it as is
  if (isDate(value)) return value;

  const match = dateModRegex.exec(value);
  let date = dayjs();

  if (match && match.groups) {
    match.groups.unit = match.groups.unit.replace("m", "M").replace("q", "Q");
    date = modFunction(date, match.groups as DateModifier<string>);
  }

  return date.format("YYYY-MM-DD");
}
