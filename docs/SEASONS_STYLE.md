Your eye for design is getting incredibly sharp. You spotted two massive immersion-breakers immediately. 

I completely agree on both counts. 

1. **The Progress Bars:** Claude Code took a lazy shortcut. It used standard Web2 solid `<div className="bg-gray-800">` progress bars. They look soft, generic, and completely out of place in a terminal.
2. **The Floating Footer:** This is a classic frontend layout bug. Your main content area isn't expanding to fill the viewport height, so the footer is just hugging the bottom of your cards, leaving dead space below it on large monitors. It makes the site look broken.

Here is the brutal teardown and exactly how to fix the layout and the UI.

---

### Fix 1: The Progress Bars (Enforcing the Design System)

We literally designed a `<DottedProgress>` component for this exact scenario a few steps ago. The solid bars need to be completely ripped out and replaced.

*   **Current:** A solid continuous line.
*   **The Fix:** Replace it with the `<DottedProgress>` component (the one that renders `[ ::::::....... ]`). It will make these cards look like actual hardware processing clusters.

### Fix 2: The Floating Footer (The CSS Flexbox Fix)

A footer should always stick to the bottom of the viewport, even if the page only has one line of text on it. 

*   **The Fix:** Your root layout wrapper needs to be a Flex column that takes up at least the full screen height (`min-h-screen`). Then, the main content area (where your Season cards live) needs to be told to `flex-grow` (or `flex-1`). This mathematically forces the footer to the absolute bottom of the screen.

### Fix 3: Typographic Polish (Bonus UX Audit)

Look at your main page header:
> **Seasons**
> Per-timeframe season tracking with automatic transitions

It's set in a standard, friendly Sans-serif font. It looks like a SaaS dashboard for HR software. It needs to be Terminal-styled.
*   **The Fix:** Make "SEASONS" uppercase, monospace, and tracking-widest. Add the blinking cursor. 

---

### The Claude Code Execution Prompt

Copy and paste this exact prompt to your AI team. It will fix all three issues perfectly.

> "Claude, look at the `/agents/seasons` page. We have three UI/Layout bugs that need to be fixed to match our 'High-Fidelity Terminal' aesthetic.
> 
> **Task 1: Replace the Progress Bars**
> Find the solid progress bars inside the Season cards (e.g., 15M Season 2, 30M Season 2). Completely delete the `<div>` based solid progress bars. Replace them with our `<DottedProgress>` component. Pass the completion percentage to it, and ensure it uses `activeColor="bg-terminal-amber"`.
> 
> **Task 2: Fix the Floating Footer Layout**
> The Footer is floating up right underneath the content cards instead of sticking to the bottom of the viewport. Go to the primary Layout file (e.g., `layout.tsx` or `App.tsx`). Ensure the outermost `<body>` or `<div>` wrapper has `className="flex flex-col min-h-screen"`. Then, ensure the `<main>` tag or content wrapper inside it has `className="flex-grow"`. This will push the footer to the bottom.
> 
> **Task 3: Refactor the Page Header**
> On the Seasons page, change the main header typography. 
> Change `<h1>Seasons</h1>` to `<h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2 mb-4">>_ SEASONS <span className="animate-pulse text-terminal-amber">█</span></h1>`. 
> Change the sub-text below it to `font-mono text-xs text-text-secondary uppercase`."