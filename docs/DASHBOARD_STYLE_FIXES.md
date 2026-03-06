# ALPHA-BOARD: Dashboard Functional Audit & Action Plan

## 1. The Missing Deployment Loop (Adding Agents)
**The Problem:** The user has capacity (e.g., "10/10" or "2/5" Fleet Capacity), but there is no contextual CTA to fill that capacity. They shouldn't have to hunt through the global navigation to find the marketplace.
**The Solution:** 
*   Add a prominent header row directly above the "ACTIVE AGENT ROSTER" table.
*   Include a primary action button: `[ + DEPLOY NEW AGENT ]`.
*   Clicking this button routes the user directly to `/agents` (The Marketplace).

## 2. The Missing Control Loop (Removing/Pausing Agents)
**The Problem:** In the Roster table, the far-right column only says `[ VIEW ]`. If an agent is losing money (e.g., the `Hybrid Momentum` agent is down -$107.00), the user must be able to kill it instantly from this screen.
**The Solution:** 
Replace the single `[ VIEW ]` text with a quick-action group.
*   `[ PAUSE ]` (Temporarily halts trading, keeps the agent in the roster. Status changes to amber `PAUSED`).
*   `[ TERMINATE ]` (Permanently fires the agent, closes open positions, removes from roster).
*   `[ SETTINGS ]` or `[ VIEW ]` (Takes them to the deep-dive analytics page for that bot).

## 3. The "Panic Button" (Mandatory Fintech Safety)
**The Problem:** In algorithmic trading, if a Black Swan event happens (e.g., Binance goes down, or Bitcoin drops 20% in an hour), a user with 10 active bots will panic. They cannot click `[ TERMINATE ]` 10 individual times.
**The Solution:**
*   Add a Global Kill Switch in the top right of the `ACTIVE DEPLOYMENTS` card.
*   Button text: `[ HALT ALL TRADING ]` (Styled in `text-data-loss` / red).

## 4. The Missing "Risk Allocation" Column
**The Problem:** The roster shows Win Rate and PnL, but it does *not* show how much money the agent is allowed to trade. Is "Momentum Alpha" trading $10 or $10,000? 
**The Solution:**
*   Add an `ALLOCATION` or `POSITION SIZE` column to the Roster table (e.g., `5% of Portfolio` or `$500 Max`).

---

## 5. Execution Prompts for Claude Code

Pass these tasks to Claude to implement the functional UI upgrades:

> "Claude, the `/dashboard` looks visually excellent, but it lacks user control mechanisms. We need to implement the following functional UI updates:
> 
> **Task 1: Add the Deployment CTA**
> Above the 'ACTIVE AGENT ROSTER' table (and below the 3 top cards), add a Flexbox header. On the left, keep the title '>> ACTIVE AGENT ROSTER'. On the right, add a button: `<a href="/agents" className="font-mono text-xs border border-terminal-amber text-terminal-amber px-3 py-1 hover:bg-terminal-amber hover:text-void transition-colors">[ + DEPLOY NEW AGENT ]</a>`.
> 
> **Task 2: Upgrade the Actions Column**
> In the Active Agent Roster table, the far-right 'Actions' column currently just says `[ VIEW ]`. Refactor this into a flex row of three distinct actions for every row:
> `<button className="text-text-secondary hover:text-terminal-amber mr-3">[ PAUSE ]</button>`
> `<button className="text-text-secondary hover:text-data-loss mr-3">[ TERMINATE ]</button>`
> `<a href="/agents/id" className="text-text-secondary hover:text-text-primary">[ VIEW ]</a>`
> 
> **Task 3: Add the Global Panic Button**
> Inside the top 'ACTIVE DEPLOYMENTS' card, align a new button to the top right of that specific card.
> Button text: `[ HALT ALL ]`. 
> Styling: `text-xs font-mono text-data-loss border border-data-loss px-2 py-1 hover:bg-data-loss hover:text-void transition-colors`.
> 
> **Task 4: Add the Allocation Column**
> In the Active Agent Roster table, insert a new column between 'Status' and 'Trades' called 'ALLOCATION'. Fill it with mock data for now (e.g., '10% PTF' or '$500 LIMIT') in `text-text-secondary`."


User 12:29 PM
i agree with all the changes but also i might add what do you think about visualization wise? because the number of agents/trades can be very big and it just makes it scroll forever. dont sugar coat

You are 100% right to call this out. I will not sugar-coat it: **Stacking two vertically expanding data tables on top of each other is a time-bomb.** 

Infinite scrolling is for Twitter feeds, not high-frequency trading terminals. 

If a user deploys 15 agents and makes 300 trades a day, your current layout pushes the "Recent Executions" completely off the screen. The user has to scroll past a wall of text just to see if their bots are buying or selling right now. In a volatile market, that friction is unacceptable.

A professional dashboard should ideally fit entirely within the viewport (`100vh`), requiring **zero page-level scrolling**. 

Here is the brutal layout teardown, the visualization strategy, and the exact `.md` file to give to Claude to fix it.

---

### The 3 Core Fixes for "Infinite Scroll"

#### 1. The Pro-Trader Layout (Side-by-Side)
You are currently using 100% of the horizontal width for the Agent Table, and 100% for the Trade Table underneath it. **Stop wasting horizontal space.** 
Split the screen below the top cards. 
*   **Left Column (60% width):** Active Agent Roster.
*   **Right Column (40% width):** Live Execution Feed.

#### 2. Internal Scroll Containers (The Terminal Rule)
The tables themselves must be constrained. 
Set a strict `max-height` (e.g., `400px` or `500px`) on the table bodies and apply `overflow-y-auto`. Hide the default browser scrollbars. This creates **isolated terminal panels**. The global page never scrolls; only the data inside the panels scrolls.

#### 3. Data Visualization (The Visual Anchor)
You need to visualize the *aggregate performance*. Reading 15 rows of `$40.00`, `-$12.00`, `$105.00` requires math. Human brains process shapes instantly. 
*   **The Fix:** We need an **Aggregate 24H Fleet PnL Chart** spanning the top of the dashboard (just below the 3 summary cards). A sleek, terminal-styled area chart (green/red fill under an amber line) instantly answers: "Am I making money today?"

---

### Implementation Instructions for Claude Code

Feed this exact prompt to Claude to restructure the layout from a "Blog" to a "Bloomberg Terminal".

```markdown
# ALPHA-BOARD: Dashboard Layout & Visualization Overhaul

## The Problem
The current `/dashboard` stacks infinitely expanding tables vertically, breaking the 'Command Center' UX. We need to introduce a visual chart anchor, split the tables horizontally, and enforce strict internal scrolling.

## Task 1: Insert the Aggregate Fleet Chart
Below the Top 3 Summary Cards, but above the data tables, insert a new container for Data Visualization.
*   **Container:** `w-full h-48 border border-void-border bg-void-surface mb-6 p-4 flex flex-col`.
*   **Header:** `<span className="font-mono text-xs text-text-tertiary uppercase tracking-widest">>_ AGGREGATE FLEET PNL (24H)</span>`.
*   **Placeholder/Implementation:** Use `recharts` or `lightweight-charts` to render a simple Area Chart. 
    *   *Styling Rules:* Background must be transparent. The line must be `text-terminal-amber`. The fill underneath should be a very faint gradient of `rgba(255,176,0, 0.1)`. Hide all grids except subtle horizontal lines in `border-void-border`. Hide the X/Y axis lines, but keep the monospace ticker labels.

## Task 2: Implement the Split-Pane Terminal Layout
Below the new Chart, change the layout from a single-column stack to a 2-column CSS Grid.
*   **Grid Wrapper:** `<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">`
*   **Left Pane (Agent Roster):** `<div className="lg:col-span-7 flex flex-col">`. Move the 'ACTIVE AGENT ROSTER' table inside here.
*   **Right Pane (Execution Feed):** `<div className="lg:col-span-5 flex flex-col">`. Move the 'RECENT EXECUTIONS' table inside here.

## Task 3: Enforce Internal Panel Scrolling (No Page Scroll)
We must prevent the page from scrolling infinitely. The tables must scroll *internally*.
*   On both the Agent Roster `<tbody>` (or its immediate wrapper div) and the Executions `<tbody>`, apply these exact Tailwind classes: `max-h-[500px] overflow-y-auto`.
*   **Crucial UX Polish:** Add a custom scrollbar class to your global CSS (or use Tailwind utilities) to ensure these internal scrolling panels do NOT show chunky default browser scrollbars. Use a thin, 2px `#27272A` (zinc-800) scrollbar track, with a `#52525B` (zinc-600) thumb.

## Task 4: Condense Table Data for the Split Layout
Because the tables are now side-by-side, they have less horizontal room.
*   **Executions Table (Right Pane):** Simplify it. Drop the 'Agent' full name (maybe just use the Dotted Avatar + Acronym), and drop the 'Type' column. We only need Time, Symbol, Side, Price, and PnL.
*   **Agent Table (Left Pane):** Ensure the columns are tightly padded (`px-2` instead of `px-4`) so the new Action buttons (Pause/Terminate) fit cleanly without wrapping.
```

### UX Strategist Note:
Once Claude executes this, your dashboard will feel like **Mission Control**. 
1. Top Row: High-level numbers (Status, Total Agents, Total PnL).
2. Second Row: The visual heartbeat (The PnL Chart).
3. Bottom Row (Split): The Managers (Left) and The Actions (Right). 

This layout can handle 2 agents or 2,000 agents without ever breaking the page structure.