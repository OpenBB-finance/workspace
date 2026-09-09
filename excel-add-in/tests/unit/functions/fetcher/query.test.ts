import { generateQueryParams } from "~/functions/fetcher/query";

describe('generateQueryParams', () => {
    test('empty', () => {
        const input: any[] = [];
        const expected = ""
        const actual = generateQueryParams(input);
        expect(actual).toEqual(expected);
    });

    test('flatParams', () => {
        const input: any[] = [['symbol', 'AAPL']];
        const expected = "symbol=AAPL";
        const actual = generateQueryParams(input);
        expect(actual).toEqual(expected);
    });

    test('arrayParams', () => {
        const input: any[] = [['symbol', 'AAPL'], ['countries', ['some', 'country']]];
        const expected = "symbol=AAPL&countries=some&countries=country";
        const actual = generateQueryParams(input);
        expect(actual).toEqual(expected);
    });
});