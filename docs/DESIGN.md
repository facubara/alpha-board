


Here is the definitive UI/UX and Brand Guideline for the **"High-Fidelity Terminal"** aesthetic. 

This document is formatted as a strict design system. You can feed this exact text directly into Claude Code, Cursor, or v0 to guarantee the AI generates components that perfectly match this highly specific aesthetic. 

---

# ALPHA-BOARD: The "High-Fidelity Terminal" Design System

## 1. Design Philosophy & Core Principles
*   **The Tool is a Machine:** We do not use friendly Web2 illustrations, rounded blobs, or soft gradients. The interface is a control panel for financial algorithms. 
*   **Mathematical Precision:** Every margin, padding, and border must align perfectly. In a monospace/terminal design, a 1-pixel misalignment destroys the illusion of computational perfection.
*   **Monochrome + 1 Phosphor:** The interface is strictly grayscale. Color is never used for decoration—it is exclusively used for data states (Profit/Loss) or the primary Call to Action (The Phosphor).
*   **Zero Rounded Corners:** Radiuses are either `0px` (sharp) or at most `2px` (`rounded-sm` in Tailwind) to simulate hardware bezels. Absolutely no `rounded-lg` or `rounded-full` (except for literal dot-matrix dots).

---

## 2. Color System (Tailwind Configuration)
Do not use default Tailwind colors. They are too saturated. Add this to your `tailwind.config.js`.

*   **Background (The Void):** We do not use pure `#000000` (it causes eye strain with high-contrast text). We use deep obsidian.
*   **The Phosphor (Accent):** We are using **Terminal Amber**. It feels like a high-end 1970s mainframe or Bloomberg terminal. It separates you from the cliché "Matrix Green" of amateur crypto sites.
*   **Data Colors:** Muted, mathematically precise Green and Red for PnL.

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      void: {
        DEFAULT: '#0A0A0A', // Main background
        surface: '#121212', // Card background
        border: '#27272A',  // UI borders (zinc-800)
        muted: '#18181B',   // Hover states (zinc-900)
      },
      terminal: {
        amber: '#FFB000',   // Primary CTA, active states, Logo phosphor
        amberMuted: 'rgba(255, 176, 0, 0.15)', // Amber glows/backgrounds
      },
      data: {
        profit: '#10B981',  // Muted Emerald (Do not use #00FF00)
        loss: '#F43F5E',    // Muted Rose (Do not use #FF0000)
        neutral: '#A1A1AA', // Zinc 400
      },
      text: {
        primary: '#E4E4E7', // Zinc 200 (Never use pure white #FFFFFF)
        secondary: '#A1A1AA', // Zinc 400
        tertiary: '#52525B', // Zinc 600
      }
    }
  }
}
```

---

## 3. Typography System
To mix ASCII and standard UI without causing visual chaos, we use a strict two-font system. 

*   **Data & Numbers (Monospace):** `Geist Mono` or `JetBrains Mono`. 
    *   *Usage:* All PnL, tables, tickers, timestamps, API keys, code snippets, and ASCII art.
    *   *Why:* Numbers must align vertically in tables. Monospace guarantees this.
*   **UI Text (Sans Serif):** `Geist Sans` or `Inter`. 
    *   *Usage:* Button labels, paragraph text, settings descriptions.
    *   *Why:* Reading a paragraph of monospace text causes eye strain. Sans-serif provides the "glue" that makes the app usable.

**Tailwind Typography Rules:**
*   Never use `font-bold` for monospace text. Use `font-medium` or `font-semibold`. Bold monospace bleeds pixels and looks muddy.
*   Use `tracking-tight` on large headers, and `tracking-widest` for uppercase micro-labels (e.g., `TEXT-XS TRACKING-WIDEST TEXT-TEXT-TERTIARY`).

---

## 4. The Structural Canvas: Dot Matrix
The dot matrix is your background. It is whisper-quiet. It provides the texture of blueprint paper or a CRT screen. 

**Implementation (Global Background):**
Add this to your root CSS. It creates a perfect 1px dot grid spaced 16px apart, blending seamlessly into the `#0A0A0A` void.

```css
@layer utilities {
  .bg-dot-matrix {
    background-image: radial-gradient(#27272A 1px, transparent 1px);
    background-size: 16px 16px;
    background-color: #0A0A0A;
  }
}
```
*Rule:* The dot matrix *only* lives on the absolute background. Do not put dot-matrix patterns inside cards or buttons. Cards must be solid `#121212` to block out the dots behind them.

---

## 5. The Ornamental Hero: ASCII Art
ASCII is chaotic, so it must be heavily contained. 

**Rules for ASCII:**
1.  **Strict Container:** ASCII art must be wrapped in a `<pre>` tag. 
2.  **Line Height:** The CSS for the ASCII container MUST have `line-height: 1` or `leading-none`. If you use standard line height, the ASCII will break and look like scrambled garbage.
3.  **Use Cases:** 
    *   **Agent Avatars:** A 5x5 or 8x8 character ASCII block representing the AI. 
    *   **Empty States:** If a user hasn't connected Binance, show a large ASCII `[ ! ]` or a disconnected lock.
4.  **Coloring:** ASCII art should generally be `text-text-tertiary` (`#52525B`), but you can highlight *one or two specific characters* in `text-terminal-amber` to make it look like a functioning machine.

---

## 6. The Logo Brand Mark
**Concept: The Terminal Command**
Do not use a generic icon. The logo is purely typographic and heavily reliant on the monospace font. 

*   **Text:** `>_ ALPHABOARD`
*   **Styling:** 
    *   The `>_` is `text-terminal-amber font-mono font-bold animate-pulse` (the blinking cursor).
    *   `ALPHA` is `text-text-primary font-sans font-bold tracking-tighter`.
    *   `BOARD` is `text-text-secondary font-sans font-light`.

---

## 7. Component Architecture (For Claude Code / Cursor)

Tell your AI assistant to follow these exact structural rules when generating React components:

**Panels & Cards:**
```tsx
// Raw, flat, sharply defined. No drop shadows.
<div className="bg-void-surface border border-void-border rounded-none p-4">
  {/* Content */}
</div>
```

**Primary Buttons (The Phosphor Action):**
```tsx
// High contrast, terminal aesthetic
<button className="bg-terminal-amber text-void hover:bg-yellow-400 font-mono text-sm uppercase tracking-wider px-4 py-2 transition-colors">
  [ Connect Binance ]
</button>
```

**Secondary Buttons (System Actions):**
```tsx
// Blends into the terminal
<button className="bg-transparent border border-void-border text-text-primary hover:bg-void-muted hover:border-text-tertiary font-mono text-sm px-4 py-2 transition-all">
  Deploy Agent
</button>
```

**Data Tables (The Core UX):**
*   Headers must be `text-xs uppercase tracking-widest text-text-tertiary font-sans border-b border-void-border pb-2`.
*   Data cells must be `font-mono text-sm text-text-primary`.
*   Hover states on rows should be a subtle `hover:bg-void-muted`.

---

## 8. Motion & Microinteractions (The CRT Effect)

Because the UI is stark and monochrome, motion is how you prove the product is "alive" and executing trades.

**1. The Blinking Cursor (Always on):**
Any active input field, or the main logo, should have a `█` character that pulses.
*Tailwind:* `animate-pulse text-terminal-amber`

**2. The Data Scramble (On Load):**
When the Trade Feed updates, or when a user clicks an Agent, the numbers shouldn't just "appear". 
*Implementation Idea for the Dev Team:* Build a React hook `useScrambleText` that loops through random characters (`#`, `@`, `%`, `0`, `1`) for 200ms before settling on the actual PnL or trade data. This is the ultimate "Hacker/Quant" dopamine hit.

**3. Progress/Loading States:**
Never use a spinning circle. Use a monospace text loader that updates state:
`[ - ] Initializing...` -> `[ \ ] Connecting API...` -> `[ | ] Fetching PnL...` -> `[ / ] Complete.`

---

## 9. How to Prompt Claude Code with this Document

When you open Claude Code in your terminal, paste this exact prompt to initialize the redesign:

> *"Claude, I am redesigning the UI for alpha-board.com. We are adopting a 'High-Fidelity Terminal' aesthetic (Dot matrix structure, ASCII ornamentation, strict monochrome + amber phosphor, brutalist sharp edges). I have provided the complete Design System guidelines above.*
> 
> *Task 1: Update `tailwind.config.js` with the custom colors provided in the system.*
> *Task 2: Add the `.bg-dot-matrix` class to our global CSS.*
> *Task 3: Refactor the primary layout shell (`App.tsx` or `Layout.tsx`) to use the `.bg-dot-matrix` background, forcing all child cards to use `bg-void-surface` with sharp `rounded-none` borders.*
> *Task 4: Refactor all buttons to match the exact Primary/Secondary component specs provided in the guidelines.*
> 
> *Do not use any rounded corners > 2px. Do not use any drop shadows. Ensure all data (numbers, PnL) uses `font-mono`. Output the exact code."*