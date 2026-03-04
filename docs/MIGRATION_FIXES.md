This is exactly why we do these audits. The design is getting there, but these two execution errors completely shatter the "Premium Terminal" illusion. 

Here is the brutal truth:
1. **The Cropped Grid:** Your glowing hover layer is constrained to `100vh` (the viewport height), but your page content is taller than that. When you scroll down, the absolute container ends, slicing your amber dots in half. It looks broken.
2. **The Navigation Leak:** You still have the entire app (`Rankings, Agents, Backtest, etc.`) exposed on the public landing page. This is a massive conversion killer and leaks your product before you've captured the user.

Here is the exact Markdown document (`MIGRATION_FIXES.md`) you need to hand to your team and Claude Code to fix both issues permanently.

***

```markdown
# ALPHA-BOARD: Landing Page Hotfixes (MIGRATION_FIXES.md)

## 1. The Interactive Grid Cropping Bug
**The Problem:** The glowing amber dot-matrix mask is getting horizontally/vertically cropped. This happens because the absolute container holding the CSS mask is bound to the parent's initial height, breaking when the page scrolls.
**The Solution:** The illuminated layer must be detached from the document flow using `position: fixed`, and it must track viewport coordinates (`clientX/clientY`) instead of document coordinates.

### The Fix for `InteractiveGrid.tsx`
Update the component to use `fixed inset-0` for the amber layer. 

```tsx
'use client';
import React, { useState, useEffect } from 'react';

export const InteractiveGrid = ({ children }: { children: React.ReactNode }) => {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 }); // Default off-screen

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Use clientX/Y so the mask stays locked to the viewport during scroll
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-void text-text-primary">
      {/* 1. Base Dark Dot Matrix (Scrolls normally with page) */}
      <div className="absolute inset-0 bg-dot-matrix opacity-50 pointer-events-none"></div>

      {/* 2. Illuminated Amber Dot Matrix (Fixed to viewport, never crops) */}
      <div 
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 176, 0, 0.8) 2px, transparent 2px)',
          backgroundSize: '24px 24px', // Exaggerated size for Marketing
          WebkitMaskImage: `radial-gradient(circle 200px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
          maskImage: `radial-gradient(circle 200px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
        }}
      ></div>

      {/* 3. Page Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
```

---

## 2. The Navigation Leak (Auth Routing)
**The Problem:** The global `<Navbar>` is rendering all internal app links (`Rankings`, `Agents`, `Backtest`, etc.) to unauthenticated users on the root `/` page. 
**The Solution:** The Navbar must conditionally render its links based on the current route and authentication state. The Landing Page should **only** show the Logo and a `Sign In` button.

### The Fix for the Navbar / Header
Modify the navigation mapping logic. If the user is on `/` and unauthenticated, hide the primary links array.

```tsx
'use client';
import { usePathname } from 'next/navigation';
// Import your auth hook here, e.g., useSession() or useAuth()

export const Navbar = () => {
  const pathname = usePathname();
  // Mock auth state - replace with real auth logic
  const isAuthenticated = false; 

  // If on the landing page AND not logged in, show the Marketing Header
  const isMarketingView = pathname === '/' && !isAuthenticated;

  return (
    <header className="border-b border-void-border bg-void-surface/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
      
      {/* LOGO: Always visible */}
      <div className="text-terminal-amber font-mono font-bold tracking-tight">
        >_ <span className="text-text-primary font-sans">ALPHA</span>BOARD
      </div>

      {/* INTERNAL LINKS: Hidden on Marketing View */}
      {!isMarketingView && (
        <nav className="hidden md:flex items-center space-x-6 text-sm font-sans text-text-secondary">
          <a href="/agents" className="hover:text-text-primary">Agents</a>
          <a href="/streams" className="hover:text-text-primary">Streams</a>
          <a href="/deploy" className="hover:text-text-primary">Deploy</a>
          <a href="/backtest" className="hover:text-text-primary">Backtest</a>
        </nav>
      )}

      {/* CALL TO ACTION */}
      <div>
        {isMarketingView ? (
          <a href="/login" className="font-mono text-sm text-text-primary hover:text-terminal-amber">
            [ Sign In ]
          </a>
        ) : (
          <a href="/settings" className="font-mono text-sm text-text-secondary hover:text-text-primary">
            [ Settings ]
          </a>
        )}
      </div>
    </header>
  );
};
```

---

## 3. Claude Code Execution Prompts

Pass these exact prompts to your Claude CLI to execute the fixes automatically.

**Prompt 1: Fix the Cropped Background Grid**
> "Claude, read the `MIGRATION_FIXES.md` file. Go to `InteractiveGrid.tsx`. We have a bug where the amber dot matrix mask is getting cropped vertically when the user scrolls. Refactor the component according to the code in Section 1. You must change the illuminated mask layer to `fixed inset-0` and use an event listener to track `e.clientX/clientY` (viewport coordinates) instead of letting it rely on the relative document height."

**Prompt 2: Hide Internal Routes from the Landing Page**
> "Claude, read Section 2 of `MIGRATION_FIXES.md`. Locate our primary `<Navbar>` or `<Header>` component. Implement a conditional check: If the user is on the root route (`/`) AND is not authenticated, do not map or render the internal app links (Rankings, Agents, Backtest, etc.). In this 'marketing view', the header must only contain the AlphaBoard logo on the left, and a `[ Sign In ]` button on the right."
```

***

### UX Strategist Final Note:
Once these two things are fixed, the layout in your screenshot is a **9.5/10**. 
The typography is sharp, the terminal execution window is perfectly placed, and the high-contrast `[ LAUNCH TERMINAL ]` button dominates the visual hierarchy. By fixing the scroll crop and stripping the distracting navigation, you force the user's attention exactly where you want it: the copy and the primary CTA.