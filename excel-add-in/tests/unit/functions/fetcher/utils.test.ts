import packageJson from "~/../package.json";
import { VITE_ADDIN_BASE_URL } from "~/constants";
import {
  getHeaders,
  getProviderChoice,
  privateFunc,
} from "~/functions/fetcher/utils";
import { useAuthStore } from "~/store/auth";

// Tests
describe("getHeaders", () => {
  const TEST_VERSION = `1_${packageJson.version}.test`;

  test("noToken", () => {
    const token = "";
    const actual = getHeaders(token);
    const expected = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-OpenBB-Client": VITE_ADDIN_BASE_URL ?? "excel",
      "X-OpenBB-Client-Version": TEST_VERSION,
    };
    expect(actual).toEqual(expected);
  });

  test("testToken", () => {
    const token = "test_token";
    const actual = getHeaders(token);
    const expected = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-OpenBB-Client": VITE_ADDIN_BASE_URL ?? "excel",
      "X-OpenBB-Client-Version": TEST_VERSION,
    };
    expect(actual).toEqual(expected);
  });
});

describe("privateFunc", () => {
  test("failure.noToken", () => {
    const expected = "Sign in with Pro account.";
    jest.spyOn(useAuthStore, "getState").mockImplementation(() => ({
      user: {
        uuid: "",
        email: "",
        username: "",
        access_token: "",
        // @ts-expect-error - we don't need the profile
        profile: {
          api_sources: [],
        },
        expiration_date: "2021-09-01T00:00:00.000Z",
      },
      login: jest.fn(),
      logout: jest.fn(),
    }));
    expect(() => {
      privateFunc();
    }).toThrowError(expected);
  });

  test("failure.expiredToken", () => {
    const expected = "Sign in with Pro account.";
    jest.spyOn(useAuthStore, "getState").mockImplementation(() => ({
      user: {
        uuid: "",
        email: "",
        username: "",
        access_token: "testToken",
        // @ts-expect-error - we don't need the profile
        profile: {
          api_sources: [],
        },        
        expiration_date: "2021-09-01T00:00:00.000Z",
      },
      login: jest.fn(),
      logout: jest.fn(),
    }));
    expect(() => {
      privateFunc();
    }).toThrowError(expected);
  });

  test("success.validToken", () => {
    const expected = "testToken";
    jest.spyOn(useAuthStore, "getState").mockImplementation(() => ({
      user: {
        uuid: "",
        email: "",
        username: "",
        access_token: expected,
        // @ts-expect-error - we don't need the profile
        profile: {
          api_sources: [],
        },        
        expiration_date: "2100-09-01T00:00:00.000Z",
      },
      login: jest.fn(),
      logout: jest.fn(),
    }));
    expect(() => {
      privateFunc();
    }).not.toThrow();
  });
});

describe("getProviderChoice", () => {
  test("equity_fundamental_balance", async () => {
    const custom_function = "equity_fundamental_balance";
    const defaultProvider = "fmp";
    const result = await getProviderChoice(
      custom_function,
      defaultProvider,
    );
    expect(result).toBe("fmp");
  });

  test("other_custom_function without symbol", async () => {
    const custom_function = "other_custom_function";
    const defaultProvider = "fred";
    const result = await getProviderChoice(
      custom_function,
      defaultProvider,
    );
    expect(result).toBe(defaultProvider);
  });
});
