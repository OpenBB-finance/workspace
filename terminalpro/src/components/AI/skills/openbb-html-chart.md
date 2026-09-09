# Workspace chart colors skill

1. **Fix the outer wrapper first**: same rule as tables — apply the theme
background to the outermost element (`html`, `body`, `#root`), not just
an inner chart container. Reset `margin: 0` on `html`/`body`, wrapper
`width: 100%`, `min-height: 100%`.
2. **Use these exact colors** (sampled from the real Workspace UI):

Backgrounds:

- Light theme chart area: `#FFFFFF`
- Dark theme chart area: `#151518`
Axis labels / legend text:
- Light theme: `#191D1F`
- Dark theme: `#FFFFFF`
Gridlines (horizontal reference lines):
- Light theme: `#E8E8E9`
- Dark theme: `#515153`
Series/line color palette — identical in both themes, a fixed 10-color
cycle. Assign colors in this exact order; if there are more than 10
series, repeat the cycle from color 1:

1. `#5F8ED6` (blue)
2. `#F2A450` (orange)
3. `#5D9B5C` (green)
4. `#61BCDD` (cyan)
5. `#DECD43` (yellow)
6. `#8F6BC5` (purple)
7. `#B5B5B5` (gray)
8. `#B060A3` (magenta/pink)
9. `#846430` (brown/olive)
10. `#DD5F58` (red)

3. **Detect the active theme** (light/dark) from the workspace context
and apply the matching background/text/gridline set above — series colors
don't change between themes, only the chrome around them does.

4. **Legend**: small line swatch + label, same text color as axis labels,
wraps across multiple rows when there are many series — not a boxed/
bordered legend, no legend background fill.

## Output Format

- Chart background, axis text, and gridlines match the currently active
theme using only the colors listed above.
- Series use the fixed 10-color palette in order; once exhausted,
additional series can use randomly generated colors, unchanged across
themes.
- No white or unstyled space visible anywhere around the chart in dark
mode.