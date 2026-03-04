


Here is the definitive **Product Strategy & UX Architecture Blueprint**. 

While the previous document defined *how things look* (the UI and aesthetic), this document defines *how things work* (the UX, Information Architecture, and Conversion Funnel). 

Feed this directly into Notion for your team, and use the included AI prompts at the bottom to instruct Claude Code or Cursor to refactor your routing and component logic.

***

# ALPHA-BOARD: Product Strategy & UX Architecture Blueprint

## 1. The Core Strategic Pivot
**From "Passive Data Dump" to "Active Agent Marketplace."**
Currently, the app functions like a read-only database viewer for the developer. It must be restructured into a high-conversion SaaS product where the user journey is: **Discover Agent → Trust the Data → Connect Exchange → Deploy Agent → Monitor Wealth.**

### The 3 Hard Rules for the Engineering Team:
1.  **Never show the Global Fleet PnL to a new user.** Aggregating all experimental agents into a massive negative number (-$118k) is conversion suicide. Default all views to the *Top Performing Agent (30D)* or the *User's Personal PnL*.
2.  **Binance API is the Core Product.** Do not bury it in "Settings". It needs a dedicated, highly secure, and polished integration flow.
3.  **Progressive Disclosure.** Do not load every timeframe (15m, 1h, 4h, 1d) and every archetype simultaneously. Default to the highest-signal data (e.g., 4H/1D timeframe) and hide the rest behind terminal-style toggle buttons.

---

## 2. Information Architecture (Routing & Navigation Overhaul)

**The Old Navigation (Burn This):**
`[Rankings] [Agents] [Tweets] [Memecoins][Backtest] [Analytics] [Status] [Updates] [Settings]`
*(This is a database schema, not a user journey. It causes extreme cognitive overload.)*

**The New Navigation Structure (Implement This):**

*   **`/dashboard` (Command Center)**
    *   *Purpose:* The personalized view. Shows the user's active deployed agents, their personal live PnL, and recent actual trades. (If no API connected -> Show high-conversion Empty State).
*   **`/agents` (Agent Terminal / Marketplace)**
    *   *Purpose:* Where users browse and select algorithms. Replaces "Rankings" and "Agents". Displays ASCII avatars, win rates, 30D PnL, and a massive `[ DEPLOY ]` CTA.
*   **`/streams` (Data Feeds)**
    *   *Purpose:* Folds "Tweets", "Memecoins", and "Analytics" into one segmented area. This proves the AI is actually "thinking" by showing the raw Twitter sentiment and Haiku/Opus logs.
*   **`/deploy` (Connection & Execution)**
    *   *Purpose:* The dedicated flow for pasting Binance API keys, setting risk limits, and activating the copy-trade bot.
*   **`/settings` (Configuration)**
    *   *Purpose:* Strictly for account management, billing/token usage, and default LLM preferences.

---

## 3. Key Page Redesigns & Component Logic

### A. The Empty State Dashboard (Crucial for Conversion)
If a user logs in and hasn't connected an API, do NOT show them a blank table. 
*   **Component to build:** `<TerminalEmptyState />`
*   **Logic:** 
    *   Show a beautifully formatted ASCII lock or disconnected plug.
    *   Headline: `STATUS: AWAITING DEPLOYMENT`
    *   Body: `Your terminal is inactive. Select a quantitative AI agent from the marketplace and connect your exchange to begin automated execution.`
    *   Primary CTA: `[ BROWSE AGENTS ]` (Routes to `/agents`)

### B. The Agent Marketplace (`/agents`)
We must humanize the acronyms and make the bots feel like hirable employees.
*   **Component to build:** `<AgentCard />`
*   **Logic:**
    *   **Header:** Unique ASCII Avatar + Plain English Name (e.g., instead of just "RB Swing", display "Rule-Based Swing Trader"). Add a tooltip explaining the strategy.
    *   **Core Metrics:** Only show Win Rate, 30D PnL, and Total Trades. 
    *   **Action:** A `[ VIEW LOGS ]` secondary button and a `[ DEPLOY AGENT ]` primary button.

### C. The Secure API Flow (`/deploy`)
You must maximize perceived security to get users to paste their keys.
*   **Component to build:** `<SecureTerminal />`
*   **Logic:**
    *   Frame this page like a high-security vault. 
    *   Explicitly list: `"Encryption: AES-256"`, `"Storage: Ephemeral Vault"`, `"Action Required: IP-Restrict your Binance key to Fly.io worker IP:[192.x.x.x]."`.
    *   Change the generic "Save" button to `[ INITIATE SECURE CONNECTION ]`.
    *   On success, trigger a terminal scramble effect: `>_ CONNECTION ESTABLISHED. READY FOR ORDERS.`

---

## 4. Trust & UX Micro-Fixes (The "Stop the Bleeding" List)

*   **Jargon Translation:** Create a global dictionary component for tooltips. Whenever `TW`, `HYB`, or `RB` appear, the user must be able to hover and read a 1-sentence explanation of what the AI is analyzing (e.g., "TW: Analyzes raw Twitter firehose for sentiment momentum").
*   **Token Cost Transparency:** If users are paying for Claude/OpenAI API costs, add a widget to the navigation bar: `LLM Spend: $4.50`. Unpredictable costs cause churn.
*   **Color-Coded Status Logs:** 
    *   Trade executed successfully = Terminal Green.
    *   Trade failed/API error = Terminal Red.
    *   AI analyzing/processing = Terminal Amber.

---

## 5. Implementation Prompts for AI (Claude Code / Cursor)

Copy and paste these exact prompts into your AI coding assistant to execute the structural changes step-by-step.

**Prompt 1: Routing & IA Overhaul**
> *"Claude, we are restructuring the Information Architecture for alpha-board.com based on our product strategy. Read the current routing file (e.g., App.tsx, next.config, or router setup). Consolidate the routes: Remove 'Rankings', 'Agents', 'Backtest', and 'Memecoins' as top-level routes. Create three new main views: `/dashboard` (User's personal deployed agents), `/agents` (The marketplace to browse all AI algorithms), and `/streams` (Consolidated Twitter and Memecoin data). Update the primary navigation component to reflect this exact structure. Ensure the active route is highlighted using the text-terminal-amber color."*

**Prompt 2: The Agent Card Component**
> *"Claude, create a new React component called `<AgentCard />`. It must strictly follow our 'High-Fidelity Terminal' aesthetic (bg-void-surface, sharp corners, monospace fonts for data). It needs props for `agentName`, `asciiAvatar` (which should be rendered inside a `<pre className="leading-none text-xs text-text-tertiary">` tag), `winRate`, `monthlyPnL`, and `status`. Include a primary CTA button that says `[ DEPLOY AGENT ]`. Ensure the PnL strictly uses text-data-profit if positive, and text-data-loss if negative."*

**Prompt 3: Fixing the Global PnL Bug (Crucial)**
> *"Claude, locate the data fetching logic for the Dashboard or Rankings page. Currently, it aggregates the total global PnL of all agents, which results in displaying a massive negative number to the user. Modify the logic: DO NOT aggregate the global fleet PnL. Instead, write a function that sorts the agents by highest 30-day PnL and only pass the data of the Top 3 Performing Agents into the view by default. We must only highlight winning agents to new users."*

**Prompt 4: Building the Secure Connection Terminal**
> *"Claude, build a new page component at `/deploy`. This is where the user inputs their Binance API keys. Frame it inside a `<div className="border border-void-border bg-dot-matrix">` to look like a secure terminal. Include two input fields: 'API Key' and 'API Secret' (using type="password"). Below the inputs, add three lines of monospace text in text-text-secondary that say: '1. Keys encrypted via AES-256. 2. Read & Trade permissions only. 3. MUST IP-restrict to Fly.io worker.'. Make the submit button highly visible with bg-terminal-amber text-void."*