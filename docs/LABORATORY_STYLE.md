This is the `Laboratory` module. It is the engine room of the platform, where users backtest strategies and analyze raw historical performance. 

Because this section is data-heavy, the design must prioritize **legibility, grid alignment, and interaction feedback.** Currently, it feels a bit unpolished, with several UI components defaulting to generic Web2 styles that break the strict "High-Fidelity Terminal" aesthetic we established.

Here is the brutal UX/UI audit and the exact `.md` file to feed Claude to fix it.

---

### The Audit: Strengths & Weaknesses

**1. Backtester (`/laboratory/backtest` - Image 1)**
*   **The Flaw (Select Inputs):** The dropdown menus for Strategy, Timeframe, and Symbol look like default HTML `<select>` elements from 2010. They have bulky grey backgrounds and standard arrows.
*   **The Flaw (The Run Button):** The `[ Run Backtest ]` button is a massive, solid yellow block spanning two columns. It looks like a "Buy Now" button on an e-commerce site, not a terminal execution command.
*   **The Flaw (Date Inputs):** The Start Date and End Date inputs are using native browser date pickers (you can see the tiny default calendar icons). These are notoriously difficult to style consistently across browsers.

**2. Analytics (`/laboratory/analytics` - Image 2)**
*   **The Flaw (Red Overload):** A `-83.81%` Max Drawdown and a cumulative PnL chart plunging into the abyss is a harsh reality of backtesting. However, painting the entire page in solid `bg-data-loss` (bright red) for the bar charts creates severe visual fatigue. The bar charts should use a slightly muted red or outline style to reduce the "screaming" effect.
*   **The Flaw (Typography):** The page header `Analytics` and the sub-header `Manual Processing` (on Image 3) are using the banned `font-sans`.
*   **The Flaw (Tab Styling):** The `Overview | Performance | Symbols | Costs` tabs are using a generic Web2 solid background (`bg-void-surface`) instead of the sleek `border-b-2 border-terminal-amber` terminal styling we use elsewhere.

**3. Processing (`/laboratory/processing` - Image 3)**
*   **The Flaw (Buttons):** The "Run All" and individual "Run" buttons are virtually invisible. They are dark grey (`bg-void-surface` or `bg-void-muted`) on a black background. They lack any call-to-action visibility.
*   **The Flaw (Badges):** The `completed` badges in the Recent Runs table are using generic green boxes. They need to use the universal `<TerminalBadge>` component.
*   **The Flaw (Progress Bars):** The progress bars in the table are thin, solid lines. They should be `<DottedProgress>` components.

---

### Implementation Instructions for Claude Code

Feed this exact `.md` file to Claude to execute the visual overhaul on the Laboratory module.

```markdown
# ALPHA-BOARD: Laboratory Module Polish (`/laboratory`)

## Task 1: Unify Typography (All Pages)
The main `<h1>` headers are violating the `claude.md` typography rules.
1. Force update the headers for `Backtest`, `Analytics`, and `Manual Processing`.
2. Classes MUST BE: `font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2 mb-6 inline-flex items-center`.
3. Add the blinking cursor: `>_ BACKTEST <span className="animate-pulse text-terminal-amber ml-2">█</span>`.

## Task 2: Polish the Backtester Form (`/laboratory/backtest`)
The input forms look like default HTML. We must "terminal-ize" them.
1. **Dropdowns (`<select>`):** Remove default styling (`appearance-none`). Style them as: `bg-transparent border-b border-void-border text-text-primary font-mono text-sm focus:outline-none focus:border-terminal-amber pb-1 w-full`. (Add a custom SVG chevron if necessary).
2. **Date Inputs:** Apply the exact same transparent, bottom-border styling to the `<input type="date">` fields. 
3. **The Execution Button:** Change the massive yellow block to a precise terminal command: `<button className="font-mono text-sm uppercase tracking-widest border border-terminal-amber text-terminal-amber hover:bg-terminal-amber hover:text-void transition-colors px-6 py-2 mt-auto">[ INITIALIZE BACKTEST ]</button>`. Ensure it aligns neatly with the bottom of the input fields.

## Task 3: Refine Analytics Visuals (`/laboratory/analytics`)
The data visualization needs to feel less "screaming red" and more "analytical."
1. **Tabs:** Fix the inner navigation tabs (`Overview`, `Performance`, etc.). Remove any solid backgrounds. Use `text-text-secondary font-mono text-xs uppercase px-4 py-2 hover:text-text-primary`. For the active tab, add `text-terminal-amber border-b-2 border-terminal-amber`.
2. **Bar Charts:** If the PnL is negative, the bar charts should use a muted loss color to prevent eye strain. Change the fill from `bg-data-loss` (bright red) to `bg-data-loss/50 border border-data-loss`.
3. **Grid Alignment:** In the `Avg PnL by Archetype` charts, ensure the text labels (e.g., `TW Narrative`) are perfectly right-aligned against a vertical axis, and the bars grow to the left/right from a strict center zero-line.

## Task 4: Fix Processing UX (`/laboratory/processing`)
The action buttons are invisible and components are inconsistent.
1. **Buttons:** Update the `[ Run All ]` and `[ Run ]` buttons. They need to look actionable. Use `<button className="font-mono text-xs uppercase border border-void-border text-text-secondary hover:text-terminal-amber hover:border-terminal-amber transition-colors px-4 py-1">[ EXECUTE ]</button>`.
2. **Badges:** In the 'Recent Runs' table, replace the generic green `completed` tags with our universal `<TerminalBadge>`: `font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border text-data-profit border-data-profit/30 bg-data-profit/10`.
3. **Progress Bars:** In the table, replace the solid linear progress lines with the `<DottedProgress>` component we use on the Seasons page.
```

### UX Strategist Final Note

The Backtester form (Task 2) is the most critical fix here. When a quant trader sets parameters for a backtest, they are performing a highly technical action. By stripping away the bulky Web2 dropdowns and replacing them with sleek, transparent, underline-style inputs (`border-b`), the form transforms into something that looks like a command-line configuration file.