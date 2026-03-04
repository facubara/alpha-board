


Here is the complete, ready-to-use `AVATAR.md` file. You can drop this directly into your repository's documentation or feed it straight to Claude Code / Cursor. 

It contains the strategic reasoning, the exact CSS/Tailwind specifications, the React component architecture, and the execution prompts.

***

```markdown
# ALPHA-BOARD: Dotted Matrix Avatar System (AVATAR.md)

## 1. Strategic Rationale
We are deprecating ASCII avatars in favor of **Minimalist Dotted Matrix Avatars** (Procedural Identicons). 

*   **Why:** ASCII leans too heavily into the "basement hacker/meme" trope and is visually chaotic.
*   **The Goal:** Dotted matrices look like institutional quant processors, neural networks, or hardware chips. They scale perfectly, align mathematically with our monospace grid, and allow for sophisticated micro-animations (state changes) that ASCII cannot support.

---

## 2. Design Specifications

The avatar is a deterministic grid of square nodes based on the Agent's unique string identifier (e.g., "RB-SWING"). 

*   **Shape:** `rounded-full`. The nodes are perfect circles to match the dot-matrix background texture of the site.
*   **Grid Layout:** Default is a 6x6 or 8x8 matrix.
*   **Spacing:** A strict `2px` gap between nodes.
*   **Color System:**
    *   **Container Background:** `bg-void-surface` (#121212)
    *   **Container Border:** `border border-void-border` (#27272A)
    *   **Inactive Node:** `bg-void-border` (Subtle, structurally visible)
    *   **Active Node (Idle):** `bg-terminal-amber` (High contrast, representing the "logic" of the bot)
    *   **Active Node (Executing):** `bg-data-profit` (Flashes green when a trade occurs)

---

## 3. State Machine & Animation Rules

Because these are DOM elements (not static images), we map the Agent's operational status directly to the Avatar's animation state:

1.  **`status="idle"`**: The active nodes glow static Amber.
2.  **`status="processing"`**: (When the bot is reading Twitter or pinging the LLM). The active nodes trigger `animate-pulse` to simulate "thinking".
3.  **`status="executing"`**: (When making a trade). The active nodes flash to `bg-data-profit` (Terminal Green) to signify a successful backend action.

---

## 4. React Component Implementation

Create a new file at `components/ui/DottedAvatar.tsx` (or `.jsx`).

```tsx
import React, { useMemo } from 'react';

// Deterministic hashing function to turn an Agent Name into a boolean grid pattern
const generateDotPattern = (seed: string, gridSize: number): boolean[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const totalDots = gridSize * gridSize;
  const pattern: boolean[] =[];
  
  for (let i = 0; i < totalDots; i++) {
    // Generate a pseudo-random boolean based on the hash and index
    // The bitwise operation ensures the same seed always produces the exact same pattern
    const isActive = ((hash >> (i % 16)) & 1) === 1;
    pattern.push(isActive);
  }
  
  return pattern;
};

export interface DottedAvatarProps {
  agentId: string; // The string used to generate the unique pattern
  gridSize?: number; // Default 6
  status?: 'idle' | 'processing' | 'executing' | 'error';
  className?: string;
}

export const DottedAvatar: React.FC<DottedAvatarProps> = ({ 
  agentId, 
  gridSize = 6,
  status = 'idle',
  className = ''
}) => {
  const pattern = useMemo(() => generateDotPattern(agentId, gridSize), [agentId, gridSize]);

  // Determine active color based on current agent status
  const getActiveColor = () => {
    switch (status) {
      case 'executing': return 'bg-data-profit shadow-[0_0_8px_rgba(16,185,129,0.4)]';
      case 'error': return 'bg-data-loss shadow-[0_0_8px_rgba(244,63,94,0.4)]';
      default: return 'bg-terminal-amber shadow-[0_0_6px_rgba(255,176,0,0.2)]';
    }
  };

  return (
    <div className={`inline-flex p-1 border border-void-border bg-void-surface ${className}`}>
      <div 
        className="grid gap-[2px]" 
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {pattern.map((isActive, index) => (
          <div
            key={`${agentId}-${index}`}
            className={`
              w-1.5 h-1.5 rounded-full transition-colors duration-300
              ${isActive ? getActiveColor() : 'bg-void-border/50'}
              ${status === 'processing' && isActive ? 'animate-pulse' : ''}
            `}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 5. Usage Examples in UI

### In the Agent Marketplace Card (`/agents`)
```tsx
<div className="flex items-center space-x-4 border border-void-border bg-void-surface p-4">
  <DottedAvatar 
    agentId="RB-SWING-4H" 
    gridSize={6} 
    status="idle" 
  />
  <div>
    <h3 className="font-mono text-sm text-text-primary uppercase tracking-widest">
      RB-SWING-4H
    </h3>
    <p className="font-sans text-xs text-text-tertiary">
      Rule-Based Momentum
    </p>
  </div>
</div>
```

### In the Live Trade Feed (`/dashboard`)
When an agent is actively taking a trade, pass the `executing` status to flash the avatar green.
```tsx
<DottedAvatar agentId={trade.agentId} gridSize={4} status={trade.isExecuting ? 'executing' : 'idle'} />
```

---

## 6. Execution Prompts for Claude Code / Cursor

**Prompt 1: Create the Component**
> "Claude, read the `AVATAR.md` file. I need you to create a new component `DottedAvatar.tsx` in our components directory. Copy the exact code block provided in section 4 of the markdown file. Ensure there are no TypeScript errors and that it uses the custom Tailwind colors (`bg-void-border`, `bg-terminal-amber`, `bg-data-profit`) defined in our `tailwind.config.js`."

**Prompt 2: Deprecate ASCII and Implement Avatars**
> "Claude, search the codebase for any files rendering ASCII art for the AI Agents (e.g., `<pre>` tags containing agent faces or icons). Delete the ASCII implementations. Replace them by importing and using the new `<DottedAvatar />` component. Pass the Agent's unique name or ID as the `agentId` prop so it generates a deterministic pattern. By default, set the `gridSize` to 6."

**Prompt 3: Wire Up Live Status (If applicable)**
> "Claude, on the `/dashboard` or trade feed view, locate where we display active trades. Update the `<DottedAvatar />` component's `status` prop dynamically. If the agent is currently analyzing (e.g., status is 'processing' or 'analyzing'), pass `status="processing"`. If a trade just executed in the last 5 seconds, pass `status="executing"`. Otherwise, default to 'idle'."
```