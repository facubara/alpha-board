These are the "System" views (`/system/status` and `/system/updates`). 

Because these pages are essentially raw data logs, developers often default to unstyled lists. Claude has fallen back on standard Web2 component defaults here, which breaks the immersion we've built on the Dashboard and Marketplace.

Here is the brutal UX/UI audit and the `.md` file to force these pages into the High-Fidelity Terminal aesthetic.

---

### The Audit: System Status Page (Image 1)

**The Flaws:**
1.  **The "Blog" Container Regression:** The content is constrained to a narrow center column (`max-w-4xl`), wasting 60% of the horizontal screen space. This is a terminal; logs should span wide.
2.  **The Neon Red Banner:** The "Service Disruption" banner is using a standard Tailwind `bg-red-500` or `bg-red-900` with a solid fill. It looks like a Vercel error page, not a proprietary trading tool. 
3.  **Default Dots vs `<DottedLoader>`:** The green/amber/red dots next to the service names are solid `rounded-full` div blocks. They look okay, but we already built a `DottedUptime` and `DottedLoader` component for this exact purpose.
4.  **Redundant Borders:** Every single row has a full border wrapper (`border border-void-border`). Stacked on top of each other, it creates "double borders" (a 2px thick line between items), making it look clunky. 

---

### The Audit: Updates / Changelog Page (Image 2)

**The Flaws:**
1.  **Typography Clashing:** The `Updates` title and the changelog item headers (`Per-Timeframe Variable Seasons`) are using `font-sans` with a heavy `font-semibold` weight. They look like a Substack newsletter. 
2.  **Date Alignment:** The dates (`Mar 3`) are inside the main text box, floating randomly. In a terminal log, dates/timestamps should be mathematically aligned on the left axis, and the content should align on a right axis. 
3.  **Boxy Layout:** Just like the Status page, every changelog item is an enclosed box, creating visual fatigue when scrolling.

---

### Implementation Instructions for Claude Code

Feed this exact `.md` file to Claude to execute the visual overhaul on the System module.

```markdown
# ALPHA-BOARD: System Module Polish (`/system`)

## Task 1: Fix the Global Layout Width (Both Pages)
Both the `Status` and `Updates` pages have regressed to a narrow, centered layout.
1. Remove any `max-w-3xl` or `max-w-4xl` constraints on the main wrappers.
2. Apply the standard wide container: `w-full max-w-[1600px] mx-auto`.

## Task 2: Standardize the Page Headers
1. Replace the `<h1>` tags on both pages (`System Status` and `Updates`).
2. Use the strict terminal standard: `<h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2 mb-6">>_ SYSTEM STATUS <span className="animate-pulse text-terminal-amber">█</span></h1>` (Repeat for UPDATES).

## Task 3: Polish the Status Page (`/system/status`)
1. **The Disruption Banner:** Remove the solid red background. Style it as: `border border-data-loss bg-data-loss/10 text-data-loss font-mono uppercase tracking-widest p-4 flex items-center`. Use the `<DottedLoader color="bg-data-loss" />` instead of a static red circle.
2. **The Service Lists:** Remove the "double borders". Instead of putting a full `border` on every item, put a `border-b border-void-border` on the items, and put a full border only on the outer wrapper.
3. **The Pings (Right Side):** The latency numbers (e.g., `561ms`) must be strictly `font-mono text-text-secondary`.
4. **Active/Past Incidents:** The badges (`Degraded`, `Down`, `Resolved`) must use the universal `<TerminalBadge>` styling we established earlier (small monospace text, 1px border, 10% opacity background).

## Task 4: Terminal-ize the Updates Page (`/system/updates`)
This page looks too much like a blog. We must convert it to a Terminal "Changelog".
1. Remove the bounding box (`border border-void-border bg-void-surface`) around each update item. 
2. Build a 2-column layout for each row:
   * **Left Column (w-32):** Contains the date `Mar 3, 2026`. Strictly `font-mono text-xs text-text-tertiary uppercase text-right pr-4 border-r border-void-border`.
   * **Right Column (flex-1):** Contains the content.
3. **Update Headers:** Change the feature titles (`Per-Timeframe Variable Seasons`) to `font-mono text-text-primary uppercase tracking-widest text-sm mb-1`.
4. **Update Descriptions:** Keep the descriptions as `font-sans text-sm text-text-secondary`, but add a `>` before the text so it looks like a system output.
```

### UX Strategist Final Note

Task 4 (The 2-Column Changelog) is an incredible visual flex. By stripping away the heavy bounding boxes and aligning the dates on a rigid vertical axis (the `border-r`), the Updates page transforms from a boring text list into a highly readable, continuous stream of system logs. It will look identical to a professional Git commit history.