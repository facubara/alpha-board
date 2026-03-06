# ALPHA-BOARD: The Dashboard (User Command Center)

## 1. Strategic Purpose
This page (`/dashboard`) is the default authenticated route. It replaces the global "Agent Arena" (which is now just the `/agents` marketplace) as the home screen. 
*   **The Problem:** Currently, users log in and see the entire platform's experimental data.
*   **The Solution:** The Dashboard is a *personalized* view. It only shows what the *current user* has deployed, their personal API connection status, and their personal PnL.

## 2. Layout Architecture
The page is divided into 3 horizontal zones, adhering strictly to the 'High-Fidelity Terminal' aesthetic (wide container, sharp borders, monospace data).

### Zone A: System Status & PnL (Top Row)
A 3-column CSS grid displaying the highest-level metrics.

*   **Card 1: `EXCHANGE UPLINK`**
    *   *State (Disconnected):* An amber `[ ! ]` ASCII warning. Text: `BINANCE API: OFFLINE`. A CTA button: `[ CONFIGURE CONNECTION ]`.
    *   *State (Connected):* A pulsing green dot. Text: `BINANCE SPOT: SECURE`. Subtext: `LATENCY: 14ms`.
*   **Card 2: `ACTIVE DEPLOYMENTS`**
    *   Displays a massive monospace integer representing how many agents the user is currently running (e.g., `2`). Subtext: `FLEET CAPACITY: 2/5`.
*   **Card 3: `24H REALIZED PNL`**
    *   Displays the user's personal daily profit. E.g., `+$142.50`. Must use `text-data-profit` or `text-data-loss` colors dynamically.

### Zone B: The Active Agent Roster (Middle Row)
This is where the user manages the bots they have actually "hired" from the marketplace. 

*   **If Empty (Zero Deployments):** 
    *   A massive dashed-border dropzone (`border-dashed border-void-border`). 
    *   Center text: `SYSTEM IDLE. NO AGENTS ASSIGNED.` 
    *   A primary CTA button: `[ BROWSE AGENT MARKETPLACE ]` (Routes to `/agents`).
*   **If Active (1+ Deployments):**
    *   A clean, wide table listing *only* their running agents.
    *   Columns: `AGENT` (Includes the `<DottedAvatar>`), `TIMEFRAME`, `STATUS` (Pulsing Amber text: `EXECUTING`), `TODAY'S TRADES`, `7D PNL`, and an `[ ACTIONS ]` dropdown (Pause, Terminate, View Logs).

### Zone C: Live Personal Execution Feed (Bottom Row)
A scrolling, real-time log of every action *their specific agents* are taking on their connected exchange.

*   This is a modified version of the "Trade Feed" component, but filtered to show only the user's trades. 
*   Layout: A standard `border-void-border` container. 
*   Header: `>> RECENT EXECUTIONS (LAST 24H)`.
*   Data: Date/Time | Symbol | Side (LONG/SHORT) | Agent Name | Entry Price | Realized PnL.

---

## 3. UI Implementation Details for Claude

**Typography:** 
*   All headers (e.g., "SYSTEM STATUS", "ACTIVE DEPLOYMENTS") must be `font-mono text-xs text-text-tertiary uppercase tracking-widest`.
*   All massive numbers (PnL, Agent Count) must be `font-mono text-4xl text-text-primary font-medium`.

**Colors:**
*   Strictly use `bg-void-surface` for all card backgrounds.
*   Strictly use `border-void-border` for all structural dividers. 
*   Use `text-data-profit` (#10B981) for positive numbers and `text-data-loss` (#F43F5E) for negative numbers.

---

## 4. Execution Prompt for Claude Code

> "Claude, read the `DASHBOARD_V1.md` file. I need you to build the new User Command Center at `/dashboard`. 
> 
> **Step 1:** Create the page layout using a `max-w-[1600px] w-full mx-auto` container so it utilizes the full monitor width. 
> 
> **Step 2:** Build 'Zone A'. Create a 3-column CSS grid (`grid-cols-1 md:grid-cols-3 gap-6`). Implement Card 1 (Exchange Uplink), Card 2 (Active Deployments), and Card 3 (24H PnL) exactly as described in the markdown. Hardcode mock data for now (e.g., 'API: OFFLINE', '0 Agents', '$0.00 PnL') so we can see the layout.
> 
> **Step 3:** Build 'Zone B'. Below the top grid, create the 'Empty State' for the Active Agent Roster. It should be a large, padded div with a dashed border, containing the text 'SYSTEM IDLE. NO AGENTS ASSIGNED.' and a CTA button that links to `/agents`.
> 
> **Step 4:** Build 'Zone C'. Below the empty state, create a wide data table titled '>> RECENT EXECUTIONS'. Populate it with 3 rows of mock trade data (e.g., BTC/USDT Longs and Shorts) just to establish the visual architecture. Ensure it uses our monospace font for all tabular data.
> 
> **Step 5:** Ensure this new `/dashboard` route is set as the default destination when a user logs in, and update the global `<Navbar>` so the 'Terminal' link points here."