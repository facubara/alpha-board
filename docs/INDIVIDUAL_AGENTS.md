This is the "Deep Dive" view. The user clicks an agent from the Marketplace, and this is where they decide whether to trust it with their money.

I will not sugar-coat this: **You have built an incredible analytics viewer, but you forgot to build a product.**

If I am a user who just clicked "RB Mean Reversion" from the Marketplace because I want to use it... **how do I turn it on?** 
There is no "Deploy", "Start", or "Follow" button anywhere on this screen. I am trapped in read-only mode. If this is an agent I *already* deployed, where is the "Pause" or "Terminate" button? 

Furthermore, you are leaking default Web2 UI components (like the unstyled "Save" text floating in the void on the Rules tab). 

Here is the brutal, expert-level UX/UI audit and the exact `.md` file to feed Claude to elevate this page from "data dump" to "Terminal Command Panel."

---

### The Audit: Critical UX Failures & Strengths

**Strengths:**
1.  **The Information Architecture:** Splitting this into Tabs (Overview, Trades, Reasoning, Chart, Rules) is perfect. It prevents cognitive overload.
2.  **The Candlestick Chart:** (Image 4) is absolutely beautiful. The buy/sell markers on the candles look highly professional.
3.  **The Stats Grid:** The 8-box grid on the Overview page is clean and easy to scan.

**Critical Failures:**
1.  **The Missing Core Loop (No CTA):** The header lacks a primary action button. The user cannot deploy, pause, or configure the bot's allocation from this screen.
2.  **The Lost Identity:** You built the brilliant `<DottedAvatar>` for the marketplace, but stripped it from the detail page. The agent has lost its "face".
3.  **Default UI Leakage:** 
    *   The active tab (`Overview`) is just a white underline. Where is our `terminal-amber`?
    *   On the `Rules` and `Config` tabs, the "Save" button is just raw text floating on the right. That is not a button.
4.  **Table Alignment Regression:** On the `Trades` tab, the numerical columns (Entry, Exit, Size) are centered. We established that numerical financial data must ALWAYS be right-aligned.
5.  **Overview Chart Color Logic:** The Realized PnL is `+$40.07`, but the line chart is drawn in `text-data-loss` (Red). If equity is up, the line should be green or amber.

---

### Implementation Instructions for Claude Code

Feed this exact file to Claude to execute the fixes.

```markdown
# ALPHA-BOARD: Agent Detail Page (`/agents/[id]`) UX/UI Polish

## Task 1: The Missing Core Action (CRITICAL)
The user has no way to deploy or manage this agent from its detail page.
1. In the very top header (where the Agent Name, Tags, and PnL live), we must add a Primary Action area.
2. Next to the Agent Name, re-integrate the `<DottedAvatar agentId={agent.id} gridSize={6} />` so the agent keeps its visual identity.
3. On the far right of the header (perhaps below or next to the PnL block), add the master CTA:
   * If the user HAS NOT deployed this agent: `<button className="bg-terminal-amber text-void font-mono text-sm px-6 py-2 hover:bg-yellow-400 transition-colors">[ DEPLOY AGENT ]</button>`
   * If the user HAS deployed this agent: Show two buttons: `[ PAUSE ]` (outline) and `[ TERMINATE ]` (red outline).

## Task 2: Fix Default UI Leaks (Tabs & Buttons)
Default Tailwind/Radix styles are overriding our terminal aesthetic.
1. **Tabs:** Update the `<TabsList>` or tab map. The active tab MUST use `border-b-2 border-terminal-amber text-terminal-amber`. Inactive tabs should be `text-text-secondary`.
2. **Invisible Buttons:** On the `Rules` and `Config` tabs, the 'Save' text is floating unstyled. Wrap it in a proper terminal button: `<button className="border border-void-border px-4 py-1 font-mono text-xs text-text-primary hover:text-terminal-amber hover:border-terminal-amber transition-colors">[ SAVE CONFIG ]</button>`.

## Task 3: Read-Only Styling for 'Rules'
On the `Rules` tab, the prompt looks like standard paragraph text. 
1. The 'Active Prompt' area must look like a code editor or raw log output. 
2. Wrap the text in a `<pre>` block or ensure `font-mono text-xs leading-relaxed text-text-secondary` is applied. 
3. *Logic Check:* If this is a public marketplace agent, the user shouldn't see a 'Save' button at all (they can't overwrite the creator's prompt). Only show 'Save' if it's the user's private agent.

## Task 4: Fix 'Trades' Table Alignment (Regression)
Numerical data is centered on the Trades tab. We must enforce quantitative alignment rules.
1. Go to the Trades table `<thead>` and `<tbody>`.
2. Ensure columns for `Entry`, `Exit`, `Size`, `PnL`, and `Dur` use `text-right` for BOTH the `<th>` and the `<td>`.
3. Stop Loss / Take Profit Tags: In the Exit column, the tiny 'SL' and 'TP' badges are hard to read. Style them explicitly: SL = `bg-data-loss/10 text-data-loss border border-data-loss/30`, TP = `bg-data-profit/10 text-data-profit border border-data-profit/30`.

## Task 5: Overview Chart Color Logic
On the `Overview` tab, the equity line chart is rendering in Red, despite the PnL being Positive (+$40.07). 
1. Update the chart component logic: `const chartColor = totalPnL >= 0 ? '#10B981' : '#F43F5E';` (or just default it to `#FFB000` Terminal Amber to represent general equity flow).
```

### UX Strategist Final Note

The "Reasoning" tab (Image 3) is a goldmine for building user trust. Seeing the LLM output `no oversold/overbought conditions... Holding` proves the AI is actually working. 

However, right now it's a massive wall of the word "Hold". 
*Micro-UX Idea for the future:* Add a toggle on that tab that says `[ Hide 'Hold' Events ]`. Users usually only care about reading the reasoning behind *why* an agent decided to execute a `[ LONG ]` or `[ SHORT ]`. Let them filter out the noise easily.