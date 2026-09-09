# Workspace table colors skill

1. **Fix the outer wrapper first**: Apply the theme background to the
outermost element (`html`, `body`, `#root`, or top-level container) — not
just to an inner card. Also reset `margin: 0` on `html`/`body`, and make
the wrapper `width: 100%`, `min-height: 100%`. Keep the wrapper's own
padding small (`8px 12px`) — the table should sit close to the widget's
edges, not float inside a large margin.

2. **Use these exact colors** (sampled from the real Workspace UI):

Light theme:

- Background (odd rows): `#FFFFFF`
- Alternating rows: `#F6F6F6`
- Header background: `#EBEBED`
- Text: `#191D1F`
Dark theme:
- Background (odd rows): `#1F1E23`
- Alternating rows: `#2A2A31`
- Header background: `#36363E`
- Text: `#FFFFFF`
- Outer wrapper background: `#151518`

3. **No borders**: the workspace table has no visible divider lines
between rows or columns. Rely only on the alternating row background for
separation — don't add border colors.

4. **Detect the active theme** (light/dark) from the workspace context
and apply the matching set above — never hardcode one theme.

5. **No in-content title**: OpenBB workspace already renders the widget's
`name` in its own title bar/chrome above the widget. Do not add an
`<h1>`/header element repeating that name inside the HTML — it shows up
twice. A short subtitle (e.g. "illustrative sample data") is fine on its
own, without repeating the title above it.

## Output Format

- Table matches the currently active theme using only the colors listed
above.
- No white or unstyled space visible anywhere around the table in dark
mode.
- No border lines between rows/columns.
- No title/heading duplicating the widget's own name inside the HTML
content.