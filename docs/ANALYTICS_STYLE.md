This is a data-heavy section, which means the margin for error in visual design is zero. When you display thousands of trades and metrics, bad alignment and chaotic colors don't just look ugly—they cause physical eye strain.

I will be exceptionally thorough and completely blunt. You have massive regressions here regarding alignment, chart styling, and component consistency. 

Here is the full UX/UI audit of the `Analytics` tabs, followed by the exact `.md` file to force Claude to fix them.

---

### The Audit: Critical Flaws

#### 1. The Typography Regression (All Images)
Look at the page header: `>_ ANALYTICS █`. 
The blinking cursor is back to being a massive, disproportionate yellow rectangle that stretches above and below the text. This happens because Claude is fighting the `line-height` of the `<h1>`. 

#### 2. The Spaghetti Chart (Image 2 - Performance Tab)
Look at the `CUMULATIVE PNL BY ARCHETYPE` chart. This is what we call a "Spaghetti Chart." 
It uses 10 different bright, neon Web2 colors (purple, bright blue, cyan). A terminal should never look like a rainbow. In fintech, if you have 10 lines, you use variations of your primary brand color (amber) or muted greys, and only use bright colors for the specific line the user is hovering over. 

#### 3. Unstyled Filter Pills (Image 2 - Performance Tab)
Look at the Archetype and Timeframe filters (`[All] Momentum Mean Reversion...`). 
The active state `[All]` is a bright white/grey box. It looks like a default Bootstrap or Web2 pill. This is completely inconsistent with the sleek, underline-style filters we built for the Marketplace (`Agent Arena`). 

#### 4. Screaming Red Bar Charts (Image 1 vs Image 2)
On Image 1 (`Overview`), the horizontal bar charts (`Avg PnL by Archetype`) are filled with solid, blinding red (`bg-data-loss`). 
But on Image 2 (`Performance`), the `LONG VS SHORT` bar chart uses a darker, muted red. 
*The Flaw:* Inconsistency. The muted red in Image 2 is much better for eye strain. Image 1 is screaming at the user.

#### 5. Total Table Alignment Failure (Images 3 & 4)
This is the most critical functional failure. Claude has completely ignored the mathematical alignment rules for financial tables.
*   **Image 3 (Symbols):** Look at the `Total PnL`, `Avg PnL`, and `Fees` columns. The headers are centered, and the data is centered. Because the numbers have different lengths (e.g., `$-5.31` vs `$-37.37`), the decimals zig-zag down the screen. It is impossible to scan cleanly.
*   **Image 4 (Costs):** Look at the `By Archetype` table at the bottom. The `Total Tokens` and `Total Cost` columns are **left-aligned**! Financial numbers should NEVER be left-aligned. The `$4.3017` and `$3.3414` are floating in the middle of nowhere. Furthermore, header alignment doesn't match data alignment (centered headers above left-aligned data).

---

### Implementation Instructions for Claude Code

Feed this strict mandate to Claude. It leaves no room for creative interpretation.

```markdown
# ALPHA-BOARD: Analytics Deep Dive Polish

## Task 1: Fix the Giant Cursor (Global)
The `█` cursor in the `>_ ANALYTICS` header is disproportionate.
1. Locate the header component.
2. Replace the cursor span with exactly this: `<span className="inline-block w-3 h-4 bg-terminal-amber animate-pulse ml-2 align-baseline transform translate-y-0.5"></span>` (Do not use the text character `█`, use a block `div` or `span` with explicit width/height to force it to be a perfect rectangle).

## Task 2: Fix Table Alignments (CRITICAL)
You have violated strict quantitative alignment rules on the `Symbols` and `Costs` tabs. All numerical data MUST be right-aligned, and headers must match data alignment.
1. **Symbols Tab:** For `Trades`, `Win%`, `Total PnL`, `Avg PnL`, `PF`, `Avg Duration`, `L/S`, and `Fees` — set BOTH the `<th>` and `<td>` to `text-right` (with a `pr-4` for padding if needed). Remove all `text-center` classes.
2. **Costs Tab (Tokens Table):** For `Input Tokens`, `Output Tokens`, and `Cost` — set BOTH `<th>` and `<td>` to `text-right`. 
3. **Costs Tab (Archetype Table):** For `Total Tokens`, `Total Cost`, `Cost/Trade`, and `ROI` — set BOTH `<th>` and `<td>` to `text-right`. 

## Task 3: Unify Filter Components (Performance Tab)
The filters for `Archetype` and `Timeframe` are using generic Web2 pill stylings.
1. Replace the pill styling with the exact styling used on the `Agent Arena` page.
2. Active state: `text-terminal-amber border-b border-terminal-amber pb-1`.
3. Inactive state: `text-text-tertiary hover:text-text-primary transition-colors pb-1`.
4. Remove any `bg-white` or solid `bg-void-surface` backgrounds from these toggle options.

## Task 4: Fix Bar Chart Colors (Overview Tab)
The horizontal bar charts (`Avg PnL by Archetype`, etc.) are using solid red fills, causing eye strain.
1. Change the bar fill color. If using Tailwind classes on standard divs, use `bg-data-loss/20 border border-data-loss`. If using a charting library, pass the equivalent hex with opacity (e.g., `#F43F5E` at 20% opacity with a solid 1px border).

## Task 5: Mute the Spaghetti Chart (Performance Tab)
The `CUMULATIVE PNL BY ARCHETYPE` chart uses too many bright neon colors.
1. Update the color palette array for this specific chart. 
2. Instead of neon pinks, blues, and greens, use a monochromatic terminal palette: varying shades of `zinc-400`, `zinc-500`, `zinc-600`. 
3. Only use a bright color (like `terminal-amber`) for the specific line the user is currently hovering over (if the charting library supports active tooltip highlighting). If not, keep the colors muted and distinguished by slight shade/dash variations, avoiding a rainbow effect.
```

### UX Strategist Final Word

The difference between a table with centered decimals and a table with right-aligned decimals is the difference between an amateur developer and a Wall Street quant. 

Once Task 2 is completed, scroll down that `Symbols` tab again. The decimal points will form a flawless vertical line. Your brain will process the difference between `$-5.31` and `$-37.37` in milliseconds instead of having to "read" the number. That is the true power of a terminal UI.