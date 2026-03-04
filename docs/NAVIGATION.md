# ALPHA-BOARD: Routing & Navigation IA Overhaul

## 1. Authentication Redirection Logic
**Goal:** Authenticated users should never see the marketing Landing Page.
**Action:** Implement a middleware or layout-level redirect. 
*   If `isAuthenticated === true` AND `pathname === '/'`, immediately redirect the user to `/dashboard` (or `/agents` if dashboard isn't built yet).
*   Change the login CTA text on the unauthenticated landing page from "Sign In" to `[ INITIALIZE TERMINAL ]`.

## 2. Global Header Reorganization
**Goal:** Reduce cognitive overload by consolidating 11 top-level links into 5 core modules.
**Action:** Refactor the `<Navbar>` component for authenticated users. Replace the current mapping with the following structure:

*   **Dashboard** (Routes to `/dashboard` - Contains user PnL and active agents)
*   **Marketplace** (Routes to `/agents` - We will use in-page tabs later to show Rankings and Seasons here)
*   **Data Streams** (Routes to `/streams` - Combines Tweets and Memecoins)
*   **Laboratory** (Routes to `/backtest` - Combines Analytics and Processing)
*   **System** (Routes to `/status` - Combines Status and Updates)

## 3. Utility Nav (Right Side)
**Action:** On the far right of the Navbar, keep `Settings`. Change the "Sign Out" button to say `[ DISCONNECT ]` and ensure it triggers the logout function, then redirects the user back to `/` (which will now show the Landing Page since they are logged out). Ensure all text uses `font-mono text-sm`.

Strategic Summary
By forcing the redirect, you ensure your app feels like a "secure vault" that you enter, rather than just a webpage you scroll down. By condensing the navigation, you guide the user through a logical funnel: Check my Dashboard -> Find an Agent (Marketplace) -> Research it (Laboratory) -> Deploy it.

You are 100% right to push back on this. If the user intent for viewing "Tweets" (sentiment analysis) is completely different from viewing "Memecoins" (volume/price action) or "Coin Rankings" (market cap/momentum), forcing them onto the exact same screen will create a chaotic, unusable UI. 

However, we **cannot** put them all back in the global header. 

The "tasteful" way to solve this in enterprise Fintech and IDEs (like VS Code or Bloomberg) is **Dual-Level Navigation (Global Domains + Local Tabs).**

Here is exactly how to architect it so it remains perfectly organized but gives every feature its own dedicated, uncrowded space.

---

### The Solution: Domains & Tabs

You will have **5 Top-Level Domains** in your main header. When a user clicks one, they are taken to a layout that features a **sleek, monospace Tab Bar** to switch between the separate features instantly.

#### 1. `[ TERMINAL ]` (Your personal command center)
*   **Tabs:** `Dashboard` | `Live Trade Feed` | `Deploy`

#### 2. `[ AGENTS ]` (The AI Algorithms)
*   **Tabs:** `Marketplace` | `Leaderboard (Agent Rankings)` | `Seasons`

#### 3. `[ RADAR ]` or `[ FEEDS ]` (The Market Data)
*(This solves your exact problem. It groups the raw data, but keeps the views separate).*
*   **Tabs:** `Coin Rankings` | `Memecoin Scanner` | `Twitter Firehose`

#### 4. `[ LABORATORY ]` (The Math)
*   **Tabs:** `Backtester` | `Deep Analytics` | `Processing Logs`

#### 5. `[ SYSTEM ]` (The Infrastructure)
*   **Tabs:** `Network Status` | `Patch Updates`

---

### The Visual Execution (How it looks)

This is what the user sees when they click `[ RADAR ]` in the top navigation and navigate to the Memecoins page. Notice how the global header stays perfectly clean, and the local tabs do the heavy lifting.

```text
================================================================================
>_ ALPHABOARD       Terminal   Agents   [ Radar ]   Laboratory   System        
================================================================================

  [ COIN RANKINGS ]    [ MEMECOIN SCANNER ]    [ TWITTER FIREHOSE ]
  ----------------     ....................    ....................

>> FETCHING LIVE MEMECOIN VOLUME... [ OK ]

[ TICKER ]   [ PRICE ]    [ 24H VOL ]    [ SENTIMENT ]    [ AGENT ACTION ]
$WIF         $2.14        $412M          BULLISH          BUY (RB-SWING)
$PEPE        $0.0008      $890M          NEUTRAL          HOLD
$DOGE        $0.14        $1.2B          BEARISH          SHORT (TW-NARR)
```

**Why this is the perfect UX:**
1.  **Zero Clutter:** The global header never wraps to two lines or overwhelms the user.
2.  **Contextual Focus:** When I am looking at Market Data (`RADAR`), I only see tabs relevant to Market Data. I am not distracted by "Backtest" or "Status".
3.  **Terminal Aesthetic:** A text-based tab bar with an underline (`border-b-2 border-terminal-amber`) looks exactly like a command-line interface or a professional trading desk.

---

### Implementation Instructions for Claude Code

To build this tastefully, you need to create a reusable `<TerminalTabs>` component and update the routing structure. Feed this to Claude:

```markdown
# ALPHA-BOARD: Dual-Level Navigation Architecture

## 1. Global Header Refactor
Update the global `<Navbar>` to only contain 5 core routes:
1. `Terminal` (`/dashboard`)
2. `Agents` (`/agents/marketplace`)
3. `Radar` (`/radar/coins`)
4. `Laboratory` (`/lab/backtest`)
5. `System` (`/system/status`)

## 2. Create the `<TerminalTabs />` Component
Create a new UI component in `components/terminal/TerminalTabs.tsx`. 
*   It should accept an array of objects: `{ label: string, href: string, isActive: boolean }`.
*   Style the container as a flex row with a bottom border: `border-b border-void-border`.
*   Style inactive tabs as: `text-text-secondary font-mono text-xs uppercase tracking-widest px-4 py-2 hover:text-text-primary`.
*   Style active tabs as: `text-terminal-amber font-mono text-xs uppercase tracking-widest px-4 py-2 border-b-2 border-terminal-amber`.

## 3. Implement the Radar Layout
Create a layout wrapper for the `/radar` route group. 
*   Insert the `<TerminalTabs>` component at the top of this layout.
*   Pass it three tabs: 'Coin Rankings' (`/radar/coins`), 'Memecoins' (`/radar/memecoins`), and 'Tweets' (`/radar/tweets`).
*   Move the existing Memecoin, Tweet, and Coin Ranking page components into these new sub-routes.
```

By doing this, you keep the **exact same functionality** and **separate pages** you already built, but you upgrade the UX from a "weekend project" to a "million-dollar SaaS platform."