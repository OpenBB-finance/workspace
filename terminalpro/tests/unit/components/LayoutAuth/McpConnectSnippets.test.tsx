import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildMcpConnectSnippets,
  CODEX_TOKEN_ENV_VAR,
  MCP_SERVER_NAME,
  McpConnectSnippets,
} from "~/components/LayoutAuth/McpConnectSnippets";

const ENDPOINT = "https://backend.test/mcp";
const TOKEN = "obb_mcp_created123_secret";

describe("buildMcpConnectSnippets", () => {
  it("returns one snippet per supported client", () => {
    const snippets = buildMcpConnectSnippets(ENDPOINT, TOKEN);
    expect(snippets.map((snippet) => snippet.label)).toEqual([
      "Prompt",
      ".mcp.json",
      "Claude Code",
      "Codex",
    ]);
  });

  it("bakes the endpoint and bearer token into every snippet", () => {
    const snippets = buildMcpConnectSnippets(ENDPOINT, TOKEN);
    for (const snippet of snippets) {
      expect(snippet.text).toContain(ENDPOINT);
      expect(snippet.text).toContain(TOKEN);
      expect(snippet.text).toContain(MCP_SERVER_NAME);
    }
  });

  it("uses an Authorization: Bearer header for the json and claude snippets", () => {
    const snippets = buildMcpConnectSnippets(ENDPOINT, TOKEN);
    const json = snippets.find((snippet) => snippet.value === "json");
    const claude = snippets.find((snippet) => snippet.value === "claude");
    expect(json?.text).toContain(`"Authorization": "Bearer ${TOKEN}"`);
    expect(claude?.text).toContain(`Authorization: Bearer ${TOKEN}`);
  });

  it("exports the codex token to the shell, since Codex has no inline-token flag", () => {
    const codex = buildMcpConnectSnippets(ENDPOINT, TOKEN).find(
      (snippet) => snippet.value === "codex",
    );
    expect(codex?.text).toBe(
      `export ${CODEX_TOKEN_ENV_VAR}='${TOKEN}' && codex mcp add ${MCP_SERVER_NAME} --url ${ENDPOINT} --bearer-token-env-var ${CODEX_TOKEN_ENV_VAR} && codex mcp list`,
    );
  });

  it("produces valid JSON for the .mcp.json snippet", () => {
    const json = buildMcpConnectSnippets(ENDPOINT, TOKEN).find(
      (snippet) => snippet.value === "json",
    );
    const parsed = JSON.parse(json?.text ?? "");
    expect(parsed.mcpServers[MCP_SERVER_NAME]).toEqual({
      type: "http",
      url: ENDPOINT,
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("spells out the bearer auth header in the natural-language prompt", () => {
    const prompt = buildMcpConnectSnippets(ENDPOINT, TOKEN).find(
      (snippet) => snippet.value === "prompt",
    );
    expect(prompt?.text).toContain(ENDPOINT);
    expect(prompt?.text).toContain(`Authorization: Bearer ${TOKEN}`);
  });
});

describe("McpConnectSnippets", () => {
  it("renders client tabs with the default snippet baked in", () => {
    render(<McpConnectSnippets endpoint={ENDPOINT} token={TOKEN} />);

    expect(screen.getByRole("tab", { name: "Prompt" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: ".mcp.json" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Codex" })).toBeInTheDocument();

    // Prompt is the default tab; Radix only mounts the active panel.
    const panel = screen.getByTestId("mcp-connect-snippets");
    expect(panel.textContent).toContain(ENDPOINT);
    expect(panel.textContent).toContain(`Authorization: Bearer ${TOKEN}`);
  });
});
