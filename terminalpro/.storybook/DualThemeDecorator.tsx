import type { Decorator } from "storybook";

const panelBase: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  minHeight: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: "1rem",
  alignSelf: "flex-start",
};

export const DualThemeDecorator: Decorator = (Story, context) => (
  <div
    style={{
      display: "flex",
      width: "100%",
      minHeight: "100vh",
    }}
  >
    {/* Light panel */}
    <div
      style={{
        ...panelBase,
        background: "var(--general-bg-primary)",
        color: "var(--general-label)",
        borderRight: "1px solid var(--general-border-primary)",
      }}
    >
      <span data-a11y-ignore style={labelStyle}>Light</span>
      <Story {...context} />
    </div>

    {/* Dark panel */}
    <div
      className="dark"
      style={{
        ...panelBase,
        background: "var(--general-bg-primary)",
        color: "var(--general-label)",
      }}
    >
      <span data-a11y-ignore style={labelStyle}>Dark</span>
      <Story {...context} />
    </div>
  </div>
);
