import { useOf } from "@storybook/addon-docs/blocks";
import type { ReactNode } from "react";

interface TokenGroup {
  group: string;
  tokens: string[];
}

function TokenSwatch({ token }: { token: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 4,
          background: `var(${token})`,
          border: "1px solid rgba(128,128,128,0.2)",
          flexShrink: 0,
        }}
      />
      <code style={{ fontSize: 12 }}>{token}</code>
    </div>
  );
}

export function TokenSection(): ReactNode {
  let semanticTokens: TokenGroup[] | undefined;

  try {
    const resolved = useOf("meta");
    if (resolved.type === "meta") {
      semanticTokens = resolved.preparedMeta?.parameters?.semanticTokens;
    }
  } catch {
    return null;
  }

  if (!semanticTokens?.length) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <h2>Semantic Tokens</h2>
      <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
        CSS custom properties used by this component. Toggle the theme to see both modes.
      </p>
      {semanticTokens.map(({ group, tokens }) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{group}</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "0 24px",
            }}
          >
            {tokens.map((t) => (
              <TokenSwatch key={t} token={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
