import * as utils from "~/functions/fetcher/utils";
import * as OBB from "~/functions/functions";
import { useAuthStore } from "~/store/auth";
import {
  checkExpected,
  customSerializer,
  getPlatformAccessToken,
} from "./utils";

describe("smokeTests", () => {
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

  describe("OBB.GET", () => {
    const mockArray = [
      ["date", "open", "high", "low", "close", "volume"],
      ["2024-01-02", 2.0, 2.1, 1.9, 2.0, 100],
      ["2024-01-03", 2.1, 2.2, 2.0, 2.1, 200],
    ];
    test("Empty", async () => {
      const array = [];
      const received = await OBB.get(array, null, null);
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received: received, min_rows: 0, min_columns: 0 });
    });
    test("Full", async () => {
      const received = await OBB.get(mockArray, null, null);
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received: received, min_rows: 3, min_columns: 6 });
    });
    test("Partial", async () => {
      const received = await OBB.get(
        mockArray,
        [[2, "2024-01-03"]] as any[],
        [["close"], ["volume"]] as any[],
      );
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received: received, min_rows: 2, min_columns: 2 });
    });
  });

  describe("OBB.EQUITY.PRICE.HISTORICAL", () => {
    test("1 symbol", async () => {
      const received = await OBB.equity_price_historical(
        "AAPL",
        null,
        null,
        null,
      );
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received });
    });
    test("2+ symbols", async () => {
      const received = await OBB.equity_price_historical(
        "AAPL,MSFT,META,GOOGL",
        null,
        null,
        null,
      );
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received });
    });
    test("dates + provider", async () => {
      const received = await OBB.equity_price_historical(
        "TSLA",
        null,
        "2024-01-01",
        "2024-01-10",
      );
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received });
    });
  });

  describe("OBB.EQUITY.FUNDAMENTAL.BALANCE", () => {
    test("1 symbol", async () => {
      const received = await OBB.equity_fundamental_balance("NVDA", null, null);
      expect(privateFuncMock).toBeCalledTimes(1);
      checkExpected({ received });
    });
  });
});
