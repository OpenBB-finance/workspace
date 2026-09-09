import { describe, expect, it } from "vitest";
import { USER_AGENT_BACKEND } from "~/lib/constants";
import { getHeaders } from "~/lib/utils/fetch";

describe("fetch utils", () => {
  it("should return correct headers with token", () => {
    const token = "test-token";
    const headers = getHeaders(token);

    expect(headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT_BACKEND,
      Authorization: `Bearer ${token}`,
    });
  });
});
