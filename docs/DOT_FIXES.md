This is an excellent catch. The UI is looking **incredibly premium**, but you are absolutely right—mixing the old text-based ASCII (`[======>]`, `[ \ ]`, `###..###`) with the new Dotted Matrix aesthetic causes a visual clash. We need to unify the design language completely.

To fix this, we need to replace those raw text strings with procedural **Dotted UI Components**. 

Here are the 3 exact React components your team needs to build, followed by the prompt to feed Claude Code to swap them out.

---

### 1. Dotted Progress Bar (For the "Seasons" page)
*Replaces: `[===========> ]`*

This component takes a percentage (0 to 100) and lights up the corresponding number of dots. It looks like a battery indicator or volume meter on a high-end synthesizer.

```tsx
// components/ui/DottedProgress.tsx
import React from 'react';

interface DottedProgressProps {
  progress: number; // 0 to 100
  totalDots?: number; // Default 20 dots wide
  activeColor?: string; // e.g., 'bg-terminal-amber' or 'bg-data-profit'
}

export const DottedProgress: React.FC<DottedProgressProps> = ({ 
  progress, 
  totalDots = 20,
  activeColor = 'bg-terminal-amber'
}) => {
  // Calculate how many dots should be "lit"
  const activeCount = Math.round((progress / 100) * totalDots);

  return (
    <div className="flex items-center gap-[2px]">
      <span className="font-mono text-xs text-text-secondary mr-2">[</span>
      {Array.from({ length: totalDots }).map((_, i) => (
        <div 
          key={i} 
          className={`
            w-1.5 h-1.5 rounded-full transition-colors duration-300
            ${i < activeCount ? activeColor : 'bg-void-border/50'}
          `} 
        />
      ))}
      <span className="font-mono text-xs text-text-secondary ml-2">]</span>
    </div>
  );
};
```

---

### 2. Dotted Loader (For "Running / Processing" states)
*Replaces: `[ \ ] RUNNING`*

Instead of a spinning ASCII slash, this creates a horizontal row of 4 dots that sequentially pulse (like a "processing" light on a server blade). 

```tsx
// components/ui/DottedLoader.tsx
import React from 'react';

interface DottedLoaderProps {
  color?: string; // Default to terminal amber
}

export const DottedLoader: React.FC<DottedLoaderProps> = ({ 
  color = 'bg-terminal-amber' 
}) => {
  return (
    <div className="flex items-center gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${color}`}
          // We use arbitrary animation delays to create a sweeping wave effect
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }}
        />
      ))}
    </div>
  );
};
```

---

### 3. Dotted Uptime Sparkline (For the "Status" page)
*Replaces: `####.####.######`*

This takes an array of historical status data (e.g., the last 30 minutes/days) and maps them to colored dots. 

```tsx
// components/ui/DottedUptime.tsx
import React from 'react';

export type StatusType = 'up' | 'down' | 'degraded' | 'empty';

interface DottedUptimeProps {
  history: StatusType[]; // Array of status states
  maxDots?: number;
}

export const DottedUptime: React.FC<DottedUptimeProps> = ({ 
  history,
  maxDots = 30 
}) => {
  // Ensure we only show up to maxDots
  const displayHistory = history.slice(-maxDots);
  
  // Pad with 'empty' if history is less than maxDots
  const paddedHistory = [
    ...Array(Math.max(0, maxDots - displayHistory.length)).fill('empty'),
    ...displayHistory
  ];

  const getColor = (status: StatusType) => {
    switch(status) {
      case 'up': return 'bg-data-profit shadow-[0_0_4px_rgba(16,185,129,0.3)]';
      case 'down': return 'bg-data-loss animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.5)]';
      case 'degraded': return 'bg-terminal-amber shadow-[0_0_4px_rgba(255,176,0,0.3)]';
      default: return 'bg-void-border/40';
    }
  };

  return (
    <div className="flex items-center gap-[2px]">
      {paddedHistory.map((status, i) => (
        <div 
          key={i} 
          className={`w-1.5 h-1.5 rounded-full ${getColor(status)}`} 
        />
      ))}
    </div>
  );
};
```

---

### How to prompt Claude Code to execute this:

Copy and paste this exact prompt into Claude Code to implement all the changes seamlessly:

> "Claude, we need to unify our UI aesthetic by removing all old text-based ASCII graphics and replacing them with our new procedural Dot Matrix aesthetic. 
>
> **Task 1: Create the Components**
> Create three new components in the UI folder: `DottedProgress.tsx`, `DottedLoader.tsx`, and `DottedUptime.tsx`. I have provided the exact code for all three above. Create them exactly as written.
>
> **Task 2: Fix the Seasons Page**
> Locate the 'Seasons' page (where Timeframe Progress is displayed). Remove the text-based progress bars (like `[============> ]`). Replace them with the `<DottedProgress progress={value} activeColor="bg-terminal-amber" />` component.
> 
> **Task 3: Fix the Loaders/Spinners**
> Locate any components displaying a running state with `[ \ ] RUNNING` or similar text spinners (check Backtest runs, Indicator Calc, etc.). Replace the text spinner with `<DottedLoader /> <span className="ml-2 text-terminal-amber">RUNNING</span>`.
> 
> **Task 4: Fix the Status Page**
> Locate the 'Status' page where Uptime is displayed using hashes and dots (e.g., `####..#####`). Replace that text string with the `<DottedUptime />` component. Map your existing status data to an array of 'up', 'down', or 'degraded' to pass into the `history` prop. Make sure there are no raw ASCII hashes left on the page."