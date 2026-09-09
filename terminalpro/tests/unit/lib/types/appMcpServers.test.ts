import { describe, expect, it, vi } from "vitest";
import { backendTemplateSchema } from "~/lib/types/app";

vi.mock("../constants", () => ({
  AG_CHART_TYPES: ["line", "bar", "area", "scatter", "pie", "histogram"] as const,
}));

const template = (authType?: string) => ({
  name: "Demo",
  tabs: {},
  mcpServers: [
    {
      name: "Demo MCP",
      url: "https://example.com/mcp",
      ...(authType ? { authType } : {}),
    },
  ],
});

describe("backendTemplateSchema mcpServers.authType", () => {
  it("accepts an absent authType (default OAuth)", () => {
    const result = backendTemplateSchema.safeParse(template());
    expect(result.success).toBe(true);
  });

  it.each(["oauth", "token"])("accepts authType %s", (authType) => {
    const result = backendTemplateSchema.safeParse(template(authType));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mcpServers?.[0].authType).toBe(authType);
    }
  });

  it("rejects an unknown authType", () => {
    const result = backendTemplateSchema.safeParse(template("basic"));
    expect(result.success).toBe(false);
  });
});
