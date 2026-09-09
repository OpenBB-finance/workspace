---
name: openbb-design
description: Create distinctive, production-grade frontend interfaces with high design quality for OpenBB Workspace. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics. Whenever we are changing UI we must use this skill (e.g., updating className of any component).
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# OpenBB Design Skill

Build production-grade UI for OpenBB Workspace - a professional financial data platform. Every interface must be functional, visually refined, and feel intentionally designed for power users working with financial data.

## Design Philosophy

### Context: OpenBB Workspace
- **Audience**: Quants, analysts, traders, financial professionals
- **Purpose**: Data visualization, analysis, decision-making
- **Tone**: Professional yet distinctive. Premium feel. Data-dense but not cluttered.
- **Aesthetic**: Dark-first, information-rich, precise typography, purposeful whitespace

### Before Designing, Consider:
1. **Purpose**: What financial workflow does this serve? What decisions does it enable?
2. **Data density**: Financial users want information, not empty space. Balance density with clarity.
3. **Hierarchy**: In data-heavy interfaces, visual hierarchy is critical. What's the primary insight?
4. **Consistency**: OpenBB has an established design system. Innovate within it, don't fight it.

### Design Principles for Financial Interfaces
- **Every pixel earns its place** - Remove decoration that doesn't aid comprehension
- **Data is the hero** - UI chrome should recede, data should pop
- **Precision over personality** - Clean lines, exact spacing, no sloppiness
- **Dark mode is default** - Easier on eyes during long analysis sessions
- **Performance is UX** - Financial users notice lag. Optimize render paths.

### AVOID Generic AI Aesthetics
- Hardcoded hex colors — use semantic tokens or Tailwind primitives
- Random font choices — use `var(--font-family)` or system typography classes
- Cookie-cutter card layouts with excessive padding
- Animations that slow down data consumption
- "Friendly" rounded everything — financial tools should feel sharp and precise
- Inconsistent spacing — use the Tailwind scale

## Before You Build - MANDATORY

1. **Search `src/components/ds/` first** - design system components
2. **Search `src/components/ui/` second** - additional UI primitives
3. **Only create new if nothing similar exists**

```bash
# Check for existing components
ls src/components/ds/atoms/
ls src/components/ds/molecules/
ls src/components/ds/dialogs/
ls src/components/ui/
```

## Available Components

### Design System (`~/components/ds/`)

**Atoms:**
- `Button` - primary actions, variants: primary, secondary, outlined, ghost, danger, warning
- `Input` - text input with label support
- `Select` - dropdown selection
- `EnhancedSelect` - rich select with icons, subtitles, tooltips
- `Checkbox` - boolean toggle with label
- `Switch` - on/off toggle
- `RadioGroup` - single selection from options
- `Label` - form labels
- `TextArea` - multiline text input
- `Avatar` - user/entity avatars
- `Tag` - labels/badges (colors: grey, success, warning, danger, brand, ruby, purple, yellow, dark-blue, burgundy)
- `DropdownMenu` - contextual menus
- `Popover` - floating content
- `CopyButton` - copy to clipboard
- `HintLabel` - helper text/hints
- `FontFamilyInput` - font selection
- `SpacingInput` - spacing value input

**Molecules:**
- `Form` - form wrapper with validation
- `Tabs` - tabbed navigation (variants: default, filled, filled_secondary)
- `ColorPicker` - color selection
- `SettingsMenu` - collapsible settings panel
- `ExportProgress` - export status indicator
- `ExpandableSection` - collapsible content section

**Dialogs:**
- `Dialog` - base modal
- `BaseDialog` - reusable dialog pattern
- `ConfirmDialog` - confirmation prompts

### UI Primitives (`~/components/ui/`)

- `Calendar` - date display/selection
- `DatePicker` - date input
- `SingleDatePicker` - single date selection
- `Drawer` - slide-out panel
- `Slider` - range input
- `ScrollArea` - custom scrollbar
- `Progress` - progress indicator
- `Resizable` - resizable panels
- `ContextMenu` - right-click menu
- `EdgeHoverZone` - edge interaction zones
- `input-otp` - OTP input

## Color System — Two-Layer Architecture

The color system has two layers defined across `src/components/ds/colors.ts` (primitives) and `src/styles/tokens.css` (semantic tokens). Tailwind exposes both via `tailwind.config.ts`.

### Layer 0: Primitive Colors (static, theme-independent)

Primitives are raw color values. They do NOT change between light/dark mode. Use them when you need a fixed color regardless of theme (e.g., forced-light contexts like login pages).

```
base-0 (#FFFFFF), base-100 (#0C0C0E)
main-50 (#33BBFF), main-100 (#0088CC), main-200 (#006699)
dark-50..dark-900  (dark neutrals)
light-50..light-900 (light neutrals)
error-50, error-100, error-200
success-50, success-100, success-200
warning-50, warning-100, warning-200
informative-50, informative-100, informative-200
extra-{grey,pink,turquoise,burgundy,coral,yellow,orange,red,purple,green,blue}-{50,100,200}
```

Tailwind usage: `bg-light-100`, `text-dark-500`, `border-error-100`, `text-main-100`

### Layer 1: Semantic Tokens (theme-aware, auto-switch light/dark)

Semantic tokens resolve to different primitives based on the active theme. **Use these by default** — they handle dark mode automatically, eliminating the need for `dark:` prefixes.

Defined in `src/styles/tokens.css`, exposed as Tailwind classes in `tailwind.config.ts`.

#### General / Structure
```
bg-general-bg-primary         — main background (white / dark-900)
bg-general-bg-primary-hover   — hover state
bg-general-bg-primary-disabled
bg-general-bg-secondary       — secondary bg (light-100 / dark-800)
bg-general-bg-secondary-hover
bg-general-bg-secondary-disabled
border-general-border-primary  — primary borders
border-general-border-secondary — subtle borders
border-general-border-disabled
text-general-label             — primary label text
text-general-label-hover       — hover label text
text-general-label-disabled    — disabled label text
```

#### Surface
```
bg-surface-page    — page background (light-50 / base-100)
bg-surface-header  — header areas
bg-surface-divider — dividers/separators (use for hr, border dividers)
bg-surface-layer   — overlay/backdrop (semi-transparent)
bg-surface-card    — card backgrounds
```

#### Text
```
text-ds-text-heading   — headings, primary text (darkest)
text-ds-text-subtitle  — subtitles, secondary emphasis
text-ds-text-body      — body text, icons
text-ds-text-caption   — captions, placeholders, labels (lightest)
```

#### Buttons
```
bg-btn-primary-bg, hover, disabled / text-btn-primary-label, disabled
bg-btn-secondary-bg, hover, disabled / border-btn-secondary-border
border-btn-outlined-border, hover, disabled / text-btn-outlined-label, disabled
bg-btn-ghost-bg-hover / text-btn-ghost-label, disabled
bg-btn-destructive-bg, hover, disabled / text-btn-destructive-label, disabled
bg-btn-warning-bg, hover, disabled / text-btn-warning-label, disabled
```

#### Alerts
```
text-alert-success, text-alert-warning, text-alert-error, text-alert-informative
```

#### Links
```
text-link-color — themed link color (main-100 light / main-50 dark)
```

#### Inputs
```
bg-input-field-bg, bg-input-field-bg-hover, bg-input-field-bg-disabled
```

#### Dropdowns
```
bg-dropdown-bg, border-dropdown-border
```

#### Tabs
```
bg-tab-bg-primary, bg-tab-bg-secondary, bg-tab-group-bg
border-tab-border, text-tab-action-active
```

#### Tags
```
bg-tag-{color}-bg / text-tag-{color}-label
Colors: pink, blue, green, red, yellow, orange, coral, burgundy, grey, turquoise, purple
```

#### Tables
```
bg-table-header-bg, bg-table-cell-bg, bg-table-cell-bg-hover
```

#### Other
```
bg-tooltip-bg, bg-toggle-bg, bg-toggle-bg-disabled
bg-scrollbar-track, bg-scrollbar-handle, bg-scrollbar-handle-hover
```

### Brand Variables (white-label theming)
```css
--brand-main    /* Primary accent — backward compat, prefer semantic tokens */
--brand-lighter /* Lighter variant */
--brand-darker  /* Darker variant */
```
Tailwind: `text-brand-main`, `bg-brand-lighter`
Runtime override: `src/utils/colorUtils.ts` updates `--color-main-*` and `--brand-*` vars.

## Styling Rules

### Semantic Tokens First, `dark:` Rarely Needed

**Default approach** — use semantic tokens. They handle light/dark automatically:
```tsx
// GOOD: semantic tokens — no dark: prefix needed
<div className="bg-general-bg-primary text-general-label border-general-border-primary" />
<p className="text-ds-text-body" />
<button className="bg-btn-primary-bg text-btn-primary-label hover:bg-btn-primary-bg-hover" />
<hr className="border-surface-divider" />
```

**Only use `dark:` when** the component needs different structural behavior per theme (rare), or when using primitives in a theme-aware context:
```tsx
// OK: SpecialTooltip uses primitives because it's a non-DS component
<div className="bg-light-50 dark:bg-dark-500" />
```

### Forced-Light Contexts (login, register, onboarding)

Some pages render always-light (white card on dark bg). **Semantic tokens break here** because they resolve to dark-mode values when root is dark. Use **static primitive classes** instead:
```tsx
// BAD: semantic tokens change with theme — invisible text in dark mode
className="!text-ds-text-heading !border-general-border-secondary"

// GOOD: primitives are always the same color
className="!text-light-850 !border-light-100 !placeholder-light-500"
```

Primitive equivalents of common light-mode semantic tokens:
| Semantic token | Light-mode primitive |
|---|---|
| `general-border-secondary` | `light-100` |
| `ds-text-heading` | `light-850` |
| `ds-text-subtitle` | `light-750` |
| `ds-text-body` | `light-600` |
| `ds-text-caption` | `light-500` |
| `general-bg-primary-hover` | `light-100` |

### Class Names
```tsx
import { cn } from "~/components/ds/utils";

// Always use cn() for conditional classes
<div className={cn(
  "base-classes",
  { "conditional-class": condition }
)} />
```

### Typography Classes
```
body-xs-regular, body-xs-medium, body-xs-semibold
body-sm-regular, body-sm-medium, body-sm-semibold
body-base-regular, body-base-medium, body-base-semibold
body-lg-regular, body-lg-medium, body-lg-semibold
title-xs, title-sm, title-base, title-lg, title-xl
subtitle-xs, subtitle-sm, subtitle-base
```

### No Inline Styles
Use Tailwind only. Never use `style={{}}`.

### Existing CSS Utilities (from `index.css`)
Prefer these established patterns over creating new ones:
```
obb-btn, obb-btn-blue, obb-btn-secondary, obb-btn-tertiary, obb-btn-ghost, obb-btn-outlined
obb-icon-btn, obb-icon-btn-v2, obb-small-navbar-btn
obb-dropdown-container, obb-dropdown-item
obb-navigation-item, obb-navigation-item-active
obb-modal, obb-modal-overlay, obb-modal-close, obb-modal-title
obb-label, obb-hyper-link, obb-divider, obb-divider-vertical
obb-card, obb-code, obb-floating-actions
obb-minimal-input, obb-small-input, obb-new-input
obb-parameter, obb-tag, obb-page-container
```

## Icons

```tsx
import Icon from "~/components/Icon";

<Icon id="icon-name" className="w-4 h-4" />
```

- Default size: `w-4 h-4`
- Check `Icon.types.ts` for available IDs
- Use `className` to override size
- Icons use `currentColor` for theming

### Adding New Icons

When user pastes SVG content and wants to add a new icon, **Claude handles everything automatically:**

1. **Check for duplicates:**
   - Read `src/components/Icon.types.ts` and check if icon ID already exists
   - Search for similar names (e.g., if adding "settings-02", check for "settings", "settings-01")
   - If duplicate/similar exists, ask user if they want to proceed or use existing

2. **Optimize with SVGO:**
   ```bash
   # Save pasted SVG to temp file, optimize, output to stdout
   echo '<svg>...</svg>' | bunx svgo --input - --output - --multipass
   ```

3. **Convert to symbol format:**
   - Remove `<?xml>` declaration and `<!DOCTYPE>` if present
   - Remove `xmlns` and `xmlns:xlink` attributes (sprite already has them)
   - Replace `<svg ...>` with `<symbol id="icon-id" ...>`
   - Replace `</svg>` with `</symbol>`
   - Keep `viewBox` attribute (add `viewBox="0 0 24 24"` if missing)
   - Remove `width` and `height` attributes
   - Replace hardcoded colors with `currentColor` for theming

4. **Insert into sprite (at the BEGINNING):**
   - Edit `public/assets/icons/sprite.svg`
   - Insert the `<symbol>` right after `<defs>` tag (beginning of icons)

5. **Regenerate types:**
   ```bash
   bun run update-icons
   ```

6. **Confirm to user:**
   ```tsx
   // New icon available:
   <Icon id="new-icon-id" />
   ```

**Example transformation:**
```xml
<!-- Input SVG (pasted by user) -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path stroke="#000" d="M12 2L2 7l10 5"/>
</svg>

<!-- Output symbol (after SVGO + conversion) -->
<symbol id="my-icon" viewBox="0 0 24 24" fill="none">
  <path stroke="currentColor" d="M12 2L2 7l10 5"/>
</symbol>
```

## Motion & Interaction

- **Restrained animations** - Financial users prioritize speed over delight
- **Functional motion only** - Loading states, transitions between views, feedback
- **No gratuitous effects** - Skip page load animations, hover wobbles, etc.
- **Instant feedback** - Buttons, inputs should respond immediately
- **Use CSS transitions** - Prefer `transition` over JS animations for performance

```tsx
// Good: subtle, functional
className="transition-colors duration-150"

// Avoid: slow, distracting
className="animate-bounce duration-1000"
```

## Data Display Patterns

- **Tables**: Use proper alignment (numbers right-aligned, text left-aligned)
- **Numbers**: Monospace font, consistent decimal places, thousand separators
- **Charts**: Let TradingView/charting library handle chart rendering
- **Loading**: Skeleton loaders that match data shape, not spinners
- **Empty states**: Actionable, not just "No data"

## Component Patterns

```tsx
// Always use forwardRef for ref forwarding
const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>((props, ref) => {
  // ...
});

// Use CVA for variant management
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
});

// Use Radix primitives as base
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Always use ~ imports
import { Button } from "~/components/ds/atoms/Button";
```

## Quick Audit Checklist

When reviewing UI:

- [ ] **Hierarchy clear?** - Can user identify primary/secondary actions?
- [ ] **Spacing consistent?** - Using Tailwind spacing scale?
- [ ] **Typography appropriate?** - Using defined typography classes?
- [ ] **Colors correct?** - Using semantic tokens (not hardcoded hex)?
- [ ] **Dark mode works?** - Semantic tokens handle it, or `dark:` for primitives?
- [ ] **Forced-light contexts?** - Using primitives, not semantic tokens?
- [ ] **Loading states?** - Handling async operations?
- [ ] **Empty states?** - What shows when no data?
- [ ] **Error states?** - How are errors displayed?

## Import Convention

```tsx
// ALWAYS use ~ imports
import { Button } from "~/components/ds/atoms/Button";
import { Dialog } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import { cn } from "~/components/ds/utils";

// NEVER use relative imports
import { Button } from "../../../components/ds/atoms/Button"; // BAD
```

## Key Files Reference

- `src/components/ds/` - design system
- `src/components/ds/colors.ts` - primitive color palette
- `src/styles/tokens.css` - semantic tokens (light/dark definitions)
- `tailwind.config.ts` - Tailwind color config (exposes both layers)
- `src/utils/colorUtils.ts` - runtime brand color application
- `src/components/ds/utils/cn.ts` - class utility
- `src/components/Icon.tsx` - icon component
- `src/components/Icon.types.ts` - icon type definitions
- `public/assets/icons/sprite.svg` - icon sprite
