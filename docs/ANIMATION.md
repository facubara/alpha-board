This is the ultimate combination. By fusing the **Interactive Matrix Grid** (tactile, hardware feel) with the **Live Execution Terminal** (logical, AI processing), you create a landing page that feels less like a website and more like a high-end application interface.

Here is the strategic warning: **Do not render 10,000 individual `<div>` dots for the background grid.** If you do, the browser will lag, the CPU will spike, and the premium illusion will instantly shatter. 

Instead, we use a hyper-performant **CSS Masking Trick** for the grid, and standard React state for the terminal.

Here is exactly how your team (or Claude Code) must build this.

---

### Step 1: The Interactive Matrix Grid (High-Performance Trick)

Instead of animating individual dots, we layer two backgrounds on top of each other. 
1. The bottom layer is your standard dark `#0A0A0A` dot matrix.
2. The top layer is a glowing `terminal-amber` dot matrix.
3. We apply a CSS `mask-image` (a radial gradient) to the top layer that follows the user's mouse coordinates using a React `onMouseMove` event.

This gives the exact illusion of hardware dots "lighting up" around the cursor with **zero performance drop**.

#### The Code Component (`InteractiveGrid.tsx`)
```tsx
'use client';
import React, { useState, MouseEvent } from 'react';

export const InteractiveGrid = ({ children }: { children: React.ReactNode }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div 
      className="relative min-h-screen w-full bg-void overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Base Dark Dot Matrix (Always visible) */}
      <div className="absolute inset-0 bg-dot-matrix opacity-50"></div>

      {/* Illuminated Amber Dot Matrix (Masked by Mouse) */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          // We recreate the dot matrix here, but with the Amber phosphor color
          backgroundImage: 'radial-gradient(rgba(255, 176, 0, 0.4) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          WebkitMaskImage: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
          maskImage: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
        }}
      ></div>

      {/* Page Content goes on top */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
```

---

### Step 2: The Live Execution Terminal (The Hero Centerpiece)

This component simulates the AI engine in real-time. It uses React `useEffect` to push fake data into a scrolling terminal window. 

#### The Code Component (`LiveExecutionTerminal.tsx`)
```tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { DottedLoader } from './DottedLoader'; // The component we built earlier

const FIREHOSE_DATA = [
  "[14:02:01] @WhaleAlert: 500 BTC transferred to Binance",
  "[14:02:02] BINANCE:ETH/USDT VOL SPIKE +4.2%",
  "[14:02:04] @CryptoDegen: $WIF is breaking out of the channel",
  "[14:02:05] MACD CROSSOVER DETECTED: SOL/USDT (15m)",
  "[14:02:07] @NewsBot: FED announces emergency rate pause",
  "[14:02:08] BINANCE:PEPE/USDT ORDERBOOK IMBALANCE (BID SIDE)"
];

export const LiveExecutionTerminal = () => {
  const [leftLogs, setLeftLogs] = useState<string[]>([]);
  const [rightLogs, setRightLogs] = useState<React.ReactNode[]>([]);
  const scrollRefLeft = useRef<HTMLDivElement>(null);
  const scrollRefRight = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRefLeft.current) scrollRefLeft.current.scrollTop = scrollRefLeft.current.scrollHeight;
    if (scrollRefRight.current) scrollRefRight.current.scrollTop = scrollRefRight.current.scrollHeight;
  }, [leftLogs, rightLogs]);

  // Simulation Loop
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      // 1. Push raw data to the left column
      const newData = FIREHOSE_DATA[step % FIREHOSE_DATA.length];
      setLeftLogs(prev => [...prev.slice(-15), newData]); // Keep max 15 lines

      // 2. Simulate AI processing on the right column
      if (step % 3 === 0) { // Every 3rd tick, the AI finds a signal
        setRightLogs(prev => [...prev.slice(-15), 
          <span key={`1-${step}`} className="text-text-secondary">{`> INGESTING EVENT: ID_${9912 + step}...`}</span>
        ]);
        
        setTimeout(() => {
          setRightLogs(prev => [...prev, 
            <div key={`2-${step}`} className="flex items-center gap-2">
              <span className="text-text-secondary">{`> LLM INFERENCE:`}</span>
              <DottedLoader color="bg-terminal-amber" />
            </div>
          ]);
        }, 600);

        setTimeout(() => {
          setRightLogs(prev => [...prev, 
            <span key={`3-${step}`} className="text-terminal-amber">{`> SIGNAL FOUND: STRONG MOMENTUM`}</span>,
            <span key={`4-${step}`} className="text-text-primary">{`> DEPLOYING AGENT: RB-SWING`}</span>,
            <span key={`5-${step}`} className="text-data-profit">{`> EXECUTION: [ MARKET BUY SUCCESS ]`}</span>,
            <span key={`6-${step}`} className="text-void-border">----------------------------------------</span>
          ]);
        }, 1800);
      }
      step++;
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto border border-void-border bg-void-surface flex h-80 font-mono text-xs shadow-2xl">
      {/* Left Column: Firehose */}
      <div className="w-1/2 border-r border-void-border p-4 overflow-hidden flex flex-col">
        <div className="text-text-tertiary mb-2 uppercase tracking-widest border-b border-void-border pb-2">Raw Data Stream</div>
        <div ref={scrollRefLeft} className="flex-1 overflow-y-auto space-y-1 text-text-secondary pr-2 custom-scrollbar">
          {leftLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* Right Column: AI Engine */}
      <div className="w-1/2 p-4 overflow-hidden flex flex-col">
        <div className="text-text-tertiary mb-2 uppercase tracking-widest border-b border-void-border pb-2">Agent Logic</div>
        <div ref={scrollRefRight} className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          {rightLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>
    </div>
  );
};
```

---

### Step 3: The Claude Code Execution Prompt

To tie this all together into your new Landing Page, copy and paste this exact prompt into Claude Code:

> "Claude, we are building the new Landing Page (`/` or `page.tsx`). We are implementing two complex interactive concepts: an Interactive Mouse-Tracking Dot Matrix, and a Live Execution Terminal simulation.
> 
> **Task 1: The Interactive Grid**
> Read the code provided for `InteractiveGrid.tsx`. Create this component. It uses a CSS `mask-image` with a radial gradient tied to the mouse position to illuminate the background dot matrix in `terminal-amber` when the user hovers over it. Wrap the entire Landing Page content inside this `<InteractiveGrid>` component.
> 
> **Task 2: The Terminal Component**
> Read the code provided for `LiveExecutionTerminal.tsx`. Create this component. It relies on the `<DottedLoader>` component we built previously. It uses `setInterval` and `setTimeout` to push strings into two scrolling columns, simulating a raw data firehose on the left, and LLM processing on the right.
> 
> **Task 3: Assemble the Hero Section**
> In the Landing Page file (`page.tsx`), build the Hero section. It should be centered, with heavy padding. 
> 1. Top text: `>_ SYSTEM STATUS: ACCEPTING NEW DEPLOYMENTS` (monospace, text-terminal-amber).
> 2. Main Heading: 'Autonomous Quantitative Trading, Powered by LLMs.' (font-sans, text-5xl, font-bold, tracking-tight, text-text-primary).
> 3. Sub-heading text explaining the product (text-text-secondary).
> 4. Insert the `<LiveExecutionTerminal />` directly below the text.
> 5. Below the terminal, add a high-contrast primary CTA button: `[ LAUNCH DASHBOARD ]`.
> 
> Ensure strict adherence to the High-Fidelity Terminal aesthetic: absolutely no rounded corners > 2px, strictly `bg-void` and `border-void-border`, and flawless monospace alignment."