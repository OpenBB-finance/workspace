import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "~/lib/utils/apiError";

const FALLBACK = "Something went wrong.";

/** AxiosError carrying a FastAPI-shaped body, as the real client would produce. */
function axiosErrorWith(data: unknown, message = "Request failed"): AxiosError {
  const error = new AxiosError(message);
  error.response = {
    data,
    status: 400,
    statusText: "Bad Request",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe("apiErrorMessage", () => {
  it("prefers the backend's FastAPI `detail`", () => {
    const error = axiosErrorWith({ detail: "Vendor name already taken" });
    expect(apiErrorMessage(error, FALLBACK)).toBe("Vendor name already taken");
  });

  it("falls back to the axios message when the body has no `detail`", () => {
    const error = axiosErrorWith({ error: "nope" }, "Request failed with status 500");
    expect(apiErrorMessage(error, FALLBACK)).toBe("Request failed with status 500");
  });

  it("falls back to the axios message when `detail` is an empty string", () => {
    const error = axiosErrorWith({ detail: "" }, "Request failed with status 422");
    expect(apiErrorMessage(error, FALLBACK)).toBe("Request failed with status 422");
  });

  it("handles a network error with no response at all", () => {
    const error = new AxiosError("Network Error");
    expect(apiErrorMessage(error, FALLBACK)).toBe("Network Error");
  });

  it("uses a plain Error's message", () => {
    const error = new Error("Cannot submit: automated checks have not passed.");
    expect(apiErrorMessage(error, FALLBACK)).toBe(
      "Cannot submit: automated checks have not passed.",
    );
  });

  it("uses the fallback for a message-less Error", () => {
    expect(apiErrorMessage(new Error(""), FALLBACK)).toBe(FALLBACK);
  });

  it("uses the fallback for a non-Error throw", () => {
    expect(apiErrorMessage("just a string", FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage({ detail: "not an axios error" }, FALLBACK)).toBe(FALLBACK);
  });
});
