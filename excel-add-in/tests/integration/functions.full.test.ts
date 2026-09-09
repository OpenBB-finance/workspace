import * as utils from "~/functions/fetcher/utils";
import * as OBB from "~/functions/functions";
import { checkExpected, customSerializer, getPlatformAccessToken } from "./utils";
import { useAuthStore } from "~/store/auth";

// We pass null for unused arguments to mimic Excel's behavior

describe("fullTests", () => {

  let privateFuncMock;
  let mockUseAuthStore;
  let accessToken;

  beforeAll(async () => {
    expect.addSnapshotSerializer(customSerializer(1));
    privateFuncMock = jest.spyOn(utils, "privateFunc");
    accessToken = await getPlatformAccessToken();
  }, 10000); // Timeout of 10 seconds

  beforeEach(() => {
    privateFuncMock = jest.spyOn(utils, "privateFunc");
    privateFuncMock.mockImplementation(() => {
      return accessToken;
    });
    
    mockUseAuthStore = jest.spyOn(useAuthStore, "getState");
    mockUseAuthStore.mockImplementation(() => ({
      user: {
        uuid: "",
        email: "",
        username: "",
        access_token: accessToken,
        expiration_date: "2100-09-01T00:00:00.000Z",
      },
      login: jest.fn(),
      logout: jest.fn(),
    }));
  });

  afterEach(() => {
    privateFuncMock.mockRestore();
    mockUseAuthStore.mockRestore();
  });

  describe('OBB.CURRENCY.PRICE.HISTORICAL', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.currency_price_historical("EURUSD",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.currency_price_historical("EURUSD","2023-01-01","2023-12-31",null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.CURRENCY.SNAPSHOTS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.currency_snapshots(null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.currency_snapshots("USD,XAU","indirect","EUR,JPY,GBP")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.DERIVATIVES.OPTIONS.CHAINS', () => {
      test('Example 0 [intrinio]', async () => {
        const received = await OBB.derivatives_options_chains("AAPL",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [intrinio]', async () => {
        const received = await OBB.derivatives_options_chains("AAPL","2023-01-25",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.ECONOMY.COUNTRY_PROFILE', () => {
      test('Example 0 [econdb]', async () => {
        const received = await OBB.economy_country_profile("united_kingdom",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [econdb]', async () => {
        const received = await OBB.economy_country_profile("united_states,jp",false,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.ECONOMY.INDICATORS', () => {
      test('Example 0 [econdb]', async () => {
        const received = await OBB.economy_indicators("PCOCO",null,null,null,null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [econdb]', async () => {
        const received = await OBB.economy_indicators("CPI","united_states,jp",null,null,null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 2 [econdb]', async () => {
        const received = await OBB.economy_indicators("main","eu",null,null,null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.COMPARE.PEERS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_compare_peers("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.ESTIMATES.CONSENSUS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_estimates_consensus("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.ESTIMATES.FORWARD_EBITDA', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_estimates_forward_ebitda("AAPL,MSFT","quarter",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.BALANCE', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_balance("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.CASH', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_cash("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.FILINGS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_filings(null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.equity_fundamental_filings(null,null,100)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.HISTORICAL_EPS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_historical_eps("AAPL",null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.HISTORICAL_SPLITS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_historical_splits("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.INCOME', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_income("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.MANAGEMENT', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_management("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.METRICS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_metrics("AAPL",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.OVERVIEW', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_overview("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.RATIOS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_ratios("AAPL",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.REVENUE_PER_GEOGRAPHY', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_revenue_per_geography("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.equity_fundamental_revenue_per_geography("AAPL","annual","flat")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.REVENUE_PER_SEGMENT', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_revenue_per_segment("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.equity_fundamental_revenue_per_segment("AAPL","annual","flat")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.FUNDAMENTAL.TRANSCRIPT', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_fundamental_transcript("AAPL",2020)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.OWNERSHIP.INSIDER_TRADING', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_ownership_insider_trading("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.OWNERSHIP.INSTITUTIONAL', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_ownership_institutional("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.OWNERSHIP.MAJOR_HOLDERS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_ownership_major_holders("AAPL",null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
      test('Example 1 [fmp]', async () => {
        const received = await OBB.equity_ownership_major_holders("AAPL",null,0)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.OWNERSHIP.SHARE_STATISTICS', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_ownership_share_statistics("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.PRICE.HISTORICAL', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_price_historical("AAPL",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.PRICE.PERFORMANCE', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_price_performance("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.PRICE.QUOTE', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_price_quote("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.EQUITY.PROFILE', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.equity_profile("AAPL")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.FIXEDINCOME.GOVERNMENT.YIELD_CURVE', () => {
      test('Example 0 [econdb]', async () => {
        const received = await OBB.fixedincome_government_yield_curve("2023-05-01",null,"united_kingdom")
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
  describe('OBB.INDEX.MARKET', () => {
      test('Example 0 [fmp]', async () => {
        const received = await OBB.index_market("^IBEX",null,null,null)
        expect(privateFuncMock).toBeCalledTimes(1);
        checkExpected({received});
      });
  });
});
