import { fromOADate, toOADate } from "~/functions/fetcher/dates";
import excelDateToString from "~/functions/fetcher/dates";
import Moment from "moment";

describe("fromOADate", () => {
    test("case1", () => {
        const input = 43831;
        const expected = Moment(1577836800000).utc(false);
        const actual = fromOADate(input);
        expect(actual).toEqual(expected);
    });
});

describe("toOADate", () => {
    test("case1", () => {
        const input = Moment("2020-01-01");
        const expected = 43831;
        const actual = toOADate(input);
        expect(actual).toEqual(expected);
    });
});

describe("excelDateToString", () => {
    test("empty", () => {
        const input = "";
        const expected = "";
        const actual = excelDateToString(input);
        expect(actual).toEqual(expected);
    });

    test("badInput", () => {
        const input = "someBadInput";
        expect(() => {
            excelDateToString(input)
        }).toThrowError(`Invalid date -> '${input}'. Use YYYY-MM-DD format or Excel date.`);
    });

    test("case1", () => {
        const input = "43831";
        const expected = "2020-01-01";
        const actual = excelDateToString(input);
        expect(actual).toEqual(expected);
    });

    test("case2", () => {
        const input = "2020-01-01";
        const expected = "2020-01-01";
        const actual = excelDateToString(input);
        expect(actual).toEqual(expected);
    });
});