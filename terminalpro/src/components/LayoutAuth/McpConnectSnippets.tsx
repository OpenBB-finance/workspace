import { memo } from "react";
import { CopyButton } from "~/components/ds/atoms/CopyButton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";

/** Stable server name used across every client snippet. */
export const MCP_SERVER_NAME = "openbb";

/**
 * Codex won't accept the bearer token inline, so it's exported to the shell
 * first and Codex reads it from this env var.
 */
export const CODEX_TOKEN_ENV_VAR = "OBB_MCP_TOKEN";

export interface McpConnectSnippet {
  value: string;
  label: string;
  /** Ready-to-paste config with the endpoint and token baked in. */
  text: string;
}

/**
 * Builds the per-client connection snippets with the bearer token already
 * injected. The token is only available right after creation, so these are
 * only meaningful for a freshly created token.
 */
export function buildMcpConnectSnippets(
  endpoint: string,
  token: string,
): McpConnectSnippet[] {
  return [
    {
      value: "prompt",
      label: "Prompt",
      text: `Connect to my MCP server named "${MCP_SERVER_NAME}" at ${endpoint} using streamable HTTP transport. On every request, send the HTTP header "Authorization: Bearer ${token}".`,
    },
    {
      value: "json",
      label: ".mcp.json",
      text: [
        "{",
        '  "mcpServers": {',
        `    "${MCP_SERVER_NAME}": {`,
        '      "type": "http",',
        `      "url": "${endpoint}",`,
        '      "headers": {',
        `        "Authorization": "Bearer ${token}"`,
        "      }",
        "    }",
        "  }",
        "}",
      ].join("\n"),
    },
    {
      value: "claude",
      label: "Claude Code",
      text: `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      value: "codex",
      label: "Codex",
      text: `export ${CODEX_TOKEN_ENV_VAR}='${token}' && codex mcp add ${MCP_SERVER_NAME} --url ${endpoint} --bearer-token-env-var ${CODEX_TOKEN_ENV_VAR} && codex mcp list`,
    },
  ];
}

export interface McpConnectSnippetsProps {
  endpoint: string;
  token: string;
}

export const McpConnectSnippets = memo(
  ({ endpoint, token }: McpConnectSnippetsProps) => {
    const snippets = buildMcpConnectSnippets(endpoint, token);

    return (
      <div data-testid="mcp-connect-snippets" className="flex flex-col gap-1.5">
        <Tabs defaultValue={snippets[0].value} variant="filled_secondary">
          <TabsList>
            {snippets.map((snippet) => (
              <TabsTrigger key={snippet.value} value={snippet.value}>
                {snippet.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {snippets.map((snippet) => (
            <TabsContent key={snippet.value} value={snippet.value} className="mt-2">
              <div className="overflow-hidden rounded-md border border-general-border-secondary bg-general-bg-secondary">
                <div className="flex items-center justify-between border-b border-general-border-secondary py-1 pr-1 pl-3">
                  <span className="font-mono body-xs-regular text-ds-text-caption">
                    {snippet.label}
                  </span>
                  <CopyButton
                    text={snippet.text}
                    variant="ghost"
                    size="xs"
                    aria-label={`Copy ${snippet.label}`}
                  />
                </div>
                <div className="max-h-64 overflow-auto px-3 py-2.5">
                  <div className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-ds-text-body">
                    {snippet.text}
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  },
);
McpConnectSnippets.displayName = "McpConnectSnippets";
