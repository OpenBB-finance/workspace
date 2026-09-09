import { describe, expect, it } from "vitest";
import {
  describeCronExpression,
  getMillisecondsUntilNextCron,
  getNextCronDate,
  getPreviousCronDate,
  isValidCronExpression,
  resolveCronRefetchInterval,
} from "~/lib/utils/cronSchedule";

describe("cronSchedule", () => {
  it("validates standard five-field cron expressions", () => {
    expect(isValidCronExpression("*/5 * * * *")).toBe(true);
    expect(isValidCronExpression("0 8 * * 1-5")).toBe(true);
    expect(isValidCronExpression("30 9 * JAN MON")).toBe(true);
    expect(isValidCronExpression("0 0 31 2 *")).toBe(true);
    expect(isValidCronExpression("*/30 * * * * *")).toBe(true);
    expect(isValidCronExpression("0 0 0 1 1 * 2027")).toBe(true);

    expect(isValidCronExpression("*/0 * * * *")).toBe(false);
    expect(isValidCronExpression("*/5x * * * *")).toBe(false);
    expect(isValidCronExpression("* * *")).toBe(false);
    expect(isValidCronExpression("1abc * * * *")).toBe(false);
    expect(isValidCronExpression("61 * * * *")).toBe(false);
  });

  it("returns the next matching cron boundary", () => {
    const nextDate = getNextCronDate("*/15 * * * *", new Date(2026, 4, 12, 10, 7, 30));

    expect(nextDate?.getFullYear()).toBe(2026);
    expect(nextDate?.getMonth()).toBe(4);
    expect(nextDate?.getDate()).toBe(12);
    expect(nextDate?.getHours()).toBe(10);
    expect(nextDate?.getMinutes()).toBe(15);
  });

  it("returns the previous matching cron boundary", () => {
    const previousDate = getPreviousCronDate(
      "0 10 * * 1-5",
      new Date(2026, 4, 14, 15, 0, 0),
    );

    expect(previousDate?.getFullYear()).toBe(2026);
    expect(previousDate?.getMonth()).toBe(4);
    expect(previousDate?.getDate()).toBe(14);
    expect(previousDate?.getHours()).toBe(10);
    expect(previousDate?.getMinutes()).toBe(0);
  });

  it("supports weekday names and day-of-week ranges", () => {
    const nextDate = getNextCronDate("0 8 * * MON-FRI", new Date(2026, 4, 9, 12, 0, 0));

    expect(nextDate?.getFullYear()).toBe(2026);
    expect(nextDate?.getMonth()).toBe(4);
    expect(nextDate?.getDate()).toBe(11);
    expect(nextDate?.getHours()).toBe(8);
    expect(nextDate?.getMinutes()).toBe(0);
  });

  it("converts the next cron boundary to milliseconds", () => {
    const interval = getMillisecondsUntilNextCron(
      "*/5 * * * *",
      new Date(2026, 4, 12, 10, 3, 0).getTime(),
    );

    expect(interval).toBe(2 * 60 * 1000);
  });

  it("describes common cron expressions with human-readable text", () => {
    expect(describeCronExpression("*/1 * * * *")).toBe("Every minute");
    expect(describeCronExpression("*/5 * * * *")).toBe("Every 5 minutes");
    expect(describeCronExpression("0 * * * *")).toBe("Every hour");
    expect(describeCronExpression("15 * * * *")).toBe("At 15 minutes past the hour");
    expect(describeCronExpression("0 10 * * *")).toBe("At 10:00AM");
    expect(describeCronExpression("0 13 * * *")).toBe("At 1:00PM");
    expect(describeCronExpression("0 8 * * MON-FRI")).toBe(
      "At 8:00AM, Monday through Friday",
    );
    expect(describeCronExpression("0 9 * * MON,WED,FRI")).toBe(
      "At 9:00AM, only on Monday, Wednesday, and Friday",
    );
    expect(describeCronExpression("0 0 1 * *")).toBe(
      "At 12:00AM, on day 1 of the month",
    );
  });

  it("returns null/false for invalid cron expressions", () => {
    expect(describeCronExpression("not a cron")).toBeNull();
    expect(getNextCronDate("not a cron")).toBeNull();
    expect(getPreviousCronDate("not a cron")).toBeNull();
    expect(getMillisecondsUntilNextCron("not a cron")).toBe(false);
  });

  it("resolves refetch intervals for each supported input shape", () => {
    expect(resolveCronRefetchInterval(5000, false)).toBe(5000);
    expect(resolveCronRefetchInterval(false, 10_000)).toBe(false);
    expect(resolveCronRefetchInterval(null, 10_000)).toBe(10_000);
    expect(resolveCronRefetchInterval(undefined, 10_000)).toBe(10_000);
    expect(resolveCronRefetchInterval("   ", 10_000)).toBe(false);

    const passthrough = () => 1234;
    expect(resolveCronRefetchInterval(passthrough, false)).toBe(passthrough);

    const cronInterval = resolveCronRefetchInterval("*/5 * * * *", false);
    expect(typeof cronInterval).toBe("function");
  });
});
