# Alpha Board — Design System

**Version:** 1.0
**Last Updated:** 2026-02-05
**Creative Direction:** E-Ink Aesthetic

---

## Philosophy

Alpha Board rejects the visual noise of typical crypto dashboards—neon gradients, glowing charts, and aggressive color schemes that scream "gambling app." Instead, we embrace the **calm authority of e-ink displays**: monochrome palettes, deliberate typography, and information density that respects the user's intelligence.

This is a tool for serious analysis, not entertainment. The interface should feel like reading a well-typeset research report on a Kindle—focused, distraction-free, and effortlessly scannable.

### Core Principles

1. **Content is the interface.** No decorative elements. Every pixel serves data.
2. **Calm over chaos.** Muted tones reduce cognitive load during extended sessions.
3. **Density over sprawl.** More information per viewport, less scrolling.
4. **Typography carries meaning.** Type weight, spacing, and alignment do the heavy lifting—not color.
5. **Restraint is confidence.** A monochrome palette signals expertise, not amateurism.

---

## Color System

### The Ink Palette

We use a deliberately constrained monochrome palette inspired by e-ink displays. Color is reserved exclusively for semantic meaning (bullish/bearish signals).

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKGROUND LAYERS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  bg-base        #0A0A0A    ████████  Deep black, the canvas     │
│  bg-surface     #141414    ████████  Cards, panels, modals      │
│  bg-elevated    #1C1C1C    ████████  Hover states, dropdowns    │
│  bg-muted       #262626    ████████  Disabled, subtle fills     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  FOREGROUND / TEXT                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  text-primary   #E8E8E8    ████████  Primary content            │
│  text-secondary #A0A0A0    ████████  Supporting text, labels    │
│  text-muted     #6B6B6B    ████████  Timestamps, metadata       │
│  text-ghost     #404040    ████████  Placeholders, hints        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  BORDERS & DIVIDERS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  border-default #262626    ████████  Table borders, cards       │
│  border-subtle  #1C1C1C    ████████  Row dividers               │
│  border-strong  #404040    ████████  Focus rings, emphasis      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Semantic Colors (Sparingly Used)

Color is a **signal**, not decoration. We use only two semantic hues—and even these are desaturated to maintain the e-ink aesthetic.

```
┌─────────────────────────────────────────────────────────────────┐
│  BULLISH (Used for positive signals, gains)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  bullish-strong  #22C55E   ████████  Score bars, +PnL           │
│  bullish-muted   #166534   ████████  Chip backgrounds           │
│  bullish-subtle  #14532D   ████████  Subtle fills               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  BEARISH (Used for negative signals, losses)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  bearish-strong  #EF4444   ████████  Score bars, -PnL           │
│  bearish-muted   #991B1B   ████████  Chip backgrounds           │
│  bearish-subtle  #7F1D1D   ████████  Subtle fills               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  NEUTRAL                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  neutral-strong  #FBBF24   ████████  Caution, neutral signals   │
│  neutral-muted   #92400E   ████████  Chip backgrounds           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Color Usage Rules

| Context | Color | Notes |
|---------|-------|-------|
| Bullish score (0.6-1.0) | `bullish-strong` | Green tones |
| Bearish score (0.0-0.4) | `bearish-strong` | Red tones |
| Neutral score (0.4-0.6) | `text-secondary` | Gray, no color |
| Positive PnL | `bullish-strong` | +12.5% |
| Negative PnL | `bearish-strong` | -3.2% |
| Confidence % | `text-secondary` | Always gray |
| Rank number | `text-primary` | White |
| Symbol name | `text-primary` | White, monospace |
| Timestamp | `text-muted` | Gray |
| Hover state | `bg-elevated` | Subtle lift |
| Selected row | `border-strong` | Border, not fill |

---

## Typography

### Font Stack

```css
--font-sans: "Geist", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "Geist Mono", "JetBrains Mono", "SF Mono", monospace;
```

**Geist** is our primary typeface—designed by Vercel, optimized for interfaces, with excellent legibility at small sizes. The monospace variant maintains the same visual weight, crucial for data tables.

### Type Scale

We use a compact type scale optimized for information density. Base size is 14px.

```
┌────────────────────────────────────────────────────────────────┐
│  SCALE                                                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  text-xs     11px / 1.5   Timestamps, metadata, footnotes      │
│  text-sm     12px / 1.5   Table cells, secondary labels        │
│  text-base   14px / 1.5   Body text, primary UI                │
│  text-lg     16px / 1.4   Section headers, emphasis            │
│  text-xl     20px / 1.3   Page titles                          │
│  text-2xl    24px / 1.2   Hero numbers (PnL, main score)       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Typography Rules

| Element | Size | Weight | Font | Color |
|---------|------|--------|------|-------|
| Page title | `text-xl` | 600 | Sans | `text-primary` |
| Section header | `text-lg` | 500 | Sans | `text-primary` |
| Table header | `text-sm` | 500 | Sans | `text-secondary` |
| Table cell (text) | `text-sm` | 400 | Sans | `text-primary` |
| Table cell (number) | `text-sm` | 500 | Mono | `text-primary` |
| Symbol name | `text-sm` | 600 | Mono | `text-primary` |
| Score value | `text-sm` | 600 | Mono | Semantic |
| Confidence % | `text-sm` | 400 | Mono | `text-secondary` |
| Rank | `text-sm` | 600 | Mono | `text-primary` |
| Timestamp | `text-xs` | 400 | Mono | `text-muted` |
| Button | `text-sm` | 500 | Sans | `text-primary` |
| Chip/Badge | `text-xs` | 500 | Sans | Varies |

### Monospace for Data

All numerical data and symbols use monospace to ensure:
- Vertical alignment in tables
- Easy scanning of columns
- Professional, terminal-like aesthetic

```
Good:  BTCUSDT   0.847   76%   #1
       ETHUSDT   0.723   82%   #2

Bad:   BTCUSDT   0.847   76%   #1
       ETHUSDT   0.723   82%   #2
       ↑ Variable-width causes misalignment
```

---

## Spacing System

We use a 4px base unit for precise control over density.

```
--space-0:   0px
--space-1:   4px      Tight gaps, icon margins
--space-2:   8px      Standard gap, table cell padding
--space-3:   12px     Card padding (compact)
--space-4:   16px     Section spacing
--space-6:   24px     Card padding (comfortable)
--space-8:   32px     Page margins
--space-12:  48px     Section breaks
```

### Table Density

Tables are the primary UI component. We optimize for scanning:

```
┌────────────────────────────────────────────────────────────────┐
│  COMPACT TABLE (Rankings)                                      │
├────────────────────────────────────────────────────────────────┤
│  Row height:        40px                                       │
│  Cell padding:      8px horizontal, 0 vertical                 │
│  Header padding:    8px horizontal, 12px vertical              │
│  Border:            1px bottom, border-subtle                  │
│  Hover:             bg-elevated                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Components

### Score Bar

The signature element of Alpha Board. A horizontal bar visualizing the bullish score (0–1).

```
┌─────────────────────────────────────────────────────────────────┐
│  ANATOMY                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  └──────────────────────────────────────────────────────────┘  │
│   ↑ Track (bg-muted)            ↑ Fill (semantic color)        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SPECIFICATIONS                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Width:           100px (fixed in tables)                       │
│  Height:          6px                                           │
│  Border radius:   3px (full round)                              │
│  Track color:     bg-muted (#262626)                            │
│  Fill color:      Based on score:                               │
│                   0.0-0.4 → bearish-strong                      │
│                   0.4-0.6 → text-muted (gray)                   │
│                   0.6-1.0 → bullish-strong                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Highlight Chips

Small badges showing key signals. Maximum 4 per symbol.

```
┌─────────────────────────────────────────────────────────────────┐
│  CHIP VARIANTS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bullish:     bg: bullish-subtle    text: bullish-strong        │
│               ┌─────────────────┐                               │
│               │ RSI Oversold    │                               │
│               └─────────────────┘                               │
│                                                                 │
│  Bearish:     bg: bearish-subtle    text: bearish-strong        │
│               ┌─────────────────┐                               │
│               │ MACD Bearish    │                               │
│               └─────────────────┘                               │
│                                                                 │
│  Neutral:     bg: bg-muted          text: text-secondary        │
│               ┌─────────────────┐                               │
│               │ EMA Neutral     │                               │
│               └─────────────────┘                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SPECIFICATIONS                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Padding:         4px 8px                                       │
│  Font:            text-xs, weight 500                           │
│  Border radius:   4px                                           │
│  Max width:       None (text truncation if needed)              │
│  Gap between:     4px                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Timeframe Selector

Tab-style selector for switching between timeframes. No network request—purely client-side state.

```
┌─────────────────────────────────────────────────────────────────┐
│  VISUAL                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│  │15m │ │30m │ │ 1h │ │ 4h │ │ 1d │ │ 1w │                     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                     │
│            ↑ Selected: bg-surface, border-strong                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SPECIFICATIONS                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Container:       Inline flex, gap: 4px                         │
│  Button padding:  8px 12px                                      │
│  Font:            text-sm, weight 500, mono                     │
│  Default:         bg: transparent, text: text-secondary         │
│  Hover:           bg: bg-elevated, text: text-primary           │
│  Selected:        bg: bg-surface, border: border-strong         │
│                   text: text-primary                            │
│  Border radius:   6px                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tables

The primary data display component. Designed for density and scannability.

```
┌─────────────────────────────────────────────────────────────────┐
│  RANKINGS TABLE                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  #   Symbol      Score           Confidence    Highlights       │
│  ─────────────────────────────────────────────────────────────  │
│  1   BTCUSDT     ████████░░ .847    76%       RSI Strong        │
│  2   ETHUSDT     ███████░░░ .723    82%       MACD Cross        │
│  3   SOLUSDT     ██████░░░░ .651    71%       Volume Surge      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  COLUMN ALIGNMENT                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Rank:          Right-aligned, 48px width                       │
│  Symbol:        Left-aligned, 120px min-width                   │
│  Score:         Left-aligned (bar + number), 160px              │
│  Confidence:    Right-aligned, 80px                             │
│  Highlights:    Left-aligned, flex-grow                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Expandable Row

Rows expand on click to reveal indicator breakdown.

```
┌─────────────────────────────────────────────────────────────────┐
│  COLLAPSED                                                      │
├─────────────────────────────────────────────────────────────────┤
│  1   BTCUSDT     ████████░░ .847    76%       RSI Strong   ▸    │
├─────────────────────────────────────────────────────────────────┤
│  EXPANDED                                                       │
├─────────────────────────────────────────────────────────────────┤
│  1   BTCUSDT     ████████░░ .847    76%       RSI Strong   ▾    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  RSI (14)        ████████░░  +0.72   Oversold bounce       │ │
│  │  MACD            ██████░░░░  +0.45   Histogram rising      │ │
│  │  Stochastic      █████░░░░░  +0.38   Bullish crossover     │ │
│  │  ADX             ███░░░░░░░  +0.21   Weak trend            │ │
│  │  OBV             ████████░░  +0.68   Accumulation          │ │
│  │  Bollinger       ██████░░░░  +0.42   Lower band touch      │ │
│  │  EMA (20)        █████████░  +0.81   Price above EMA       │ │
│  │  EMA (50)        ████████░░  +0.71   Price above EMA       │ │
│  │  EMA (200)       ███████░░░  +0.62   Price above EMA       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Motion & Interaction

E-ink displays have no animation. We embrace this constraint with minimal, purposeful motion.

### Transitions

```css
/* Default transition for all interactive elements */
--transition-fast: 100ms ease-out;

/* Use for: hover states, focus rings, color changes */
transition: background-color var(--transition-fast),
            border-color var(--transition-fast),
            color var(--transition-fast);
```

### What Animates

| Element | Animation | Duration |
|---------|-----------|----------|
| Hover states | Instant color change | 100ms |
| Focus rings | Instant border change | 100ms |
| Row expansion | Height + fade | 150ms |
| Tab switch | None (instant) | 0ms |
| Page transitions | None | 0ms |

### What Doesn't Animate

- Score bars (no fill animation)
- Data updates (instant replacement)
- Loading states (use skeleton, not spinner)
- Page loads (no fade-in)

---

## Iconography

Minimal icon usage. When needed, use:

- **Lucide Icons** — Simple, consistent stroke weight
- **Size:** 16px (default), 14px (in tables)
- **Stroke:** 1.5px
- **Color:** `text-secondary` (default), `text-primary` (interactive)

### Icon Usage

| Context | Icon | Notes |
|---------|------|-------|
| Sort ascending | `chevron-up` | Table headers |
| Sort descending | `chevron-down` | Table headers |
| Expand row | `chevron-right` | Rotates 90° when expanded |
| External link | `arrow-up-right` | Rare, for documentation links |
| Search | `search` | Input prefix |
| Close | `x` | Modals, filters |

---

## Layout

### Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (sticky, 56px)                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Alpha Board                        Rankings │ Agents      │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT (flexible, centered, max-width: 1200px)           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Page Title                          Last updated: 2m ago │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Timeframe Selector                                  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                     │  │  │
│  │  │                   Data Table                        │  │  │
│  │  │                                                     │  │  │
│  │  │                                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```
--breakpoint-sm:   640px     Mobile landscape
--breakpoint-md:   768px     Tablet portrait
--breakpoint-lg:   1024px    Tablet landscape
--breakpoint-xl:   1280px    Desktop
```

### Mobile Adaptations

| Element | Desktop | Mobile |
|---------|---------|--------|
| Table columns | All visible | Hide highlights, collapse score |
| Timeframe selector | Horizontal tabs | Horizontal scroll or dropdown |
| Font size | 14px base | 14px (no change) |
| Row height | 40px | 48px (touch target) |
| Padding | 32px page margin | 16px page margin |

---

## Accessibility

### Contrast Ratios

All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text):

| Combination | Ratio | Pass |
|-------------|-------|------|
| `text-primary` on `bg-base` | 14.5:1 | AAA |
| `text-secondary` on `bg-base` | 8.5:1 | AAA |
| `text-muted` on `bg-base` | 5.2:1 | AA |
| `bullish-strong` on `bg-base` | 8.1:1 | AAA |
| `bearish-strong` on `bg-base` | 5.4:1 | AA |

### Focus States

```css
/* Focus ring for all interactive elements */
:focus-visible {
  outline: 2px solid var(--border-strong);
  outline-offset: 2px;
}
```

### Screen Reader Considerations

- Score bars have `aria-label` with numeric value
- Expandable rows use `aria-expanded`
- Timeframe selector uses proper `role="tablist"`
- Sort direction announced via `aria-sort`

---

## Implementation: CSS Variables

```css
:root {
  /* Background */
  --bg-base: #0A0A0A;
  --bg-surface: #141414;
  --bg-elevated: #1C1C1C;
  --bg-muted: #262626;

  /* Foreground */
  --text-primary: #E8E8E8;
  --text-secondary: #A0A0A0;
  --text-muted: #6B6B6B;
  --text-ghost: #404040;

  /* Borders */
  --border-default: #262626;
  --border-subtle: #1C1C1C;
  --border-strong: #404040;

  /* Semantic: Bullish */
  --bullish-strong: #22C55E;
  --bullish-muted: #166534;
  --bullish-subtle: #14532D;

  /* Semantic: Bearish */
  --bearish-strong: #EF4444;
  --bearish-muted: #991B1B;
  --bearish-subtle: #7F1D1D;

  /* Semantic: Neutral */
  --neutral-strong: #FBBF24;
  --neutral-muted: #92400E;

  /* Typography */
  --font-sans: "Geist", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", "SF Mono", monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Transitions */
  --transition-fast: 100ms ease-out;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;
}
```

---

## Do's and Don'ts

### Do

- Use monospace for all numbers and symbols
- Keep tables dense—40px row height maximum
- Let the data breathe through whitespace, not color
- Use semantic colors only for bullish/bearish signals
- Make every element keyboard-accessible
- Test at 100% and 125% zoom levels

### Don't

- Add gradients, glows, or shadows
- Use color for decoration
- Animate data changes (instant updates only)
- Use icons where text suffices
- Add loading spinners (use skeletons)
- Exceed 4 highlight chips per row

---

## References & Inspiration

- [E-ink display characteristics](https://en.wikipedia.org/wiki/E_Ink)
- [Linear](https://linear.app) — Monochrome UI, density
- [Vercel Dashboard](https://vercel.com) — Geist typography, minimal color
- [Bloomberg Terminal](https://www.bloomberg.com/professional/solution/bloomberg-terminal/) — Information density, monospace
- [Kindle Paperwhite](https://www.amazon.com/kindle) — E-ink aesthetic

---

*This design system is a living document. Update as the product evolves.*
