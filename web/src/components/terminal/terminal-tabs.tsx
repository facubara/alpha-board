"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
}

interface TerminalTabsProps {
  tabs: Tab[];
}

export function TerminalTabs({ tabs }: TerminalTabsProps) {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-void-border">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`font-mono text-xs uppercase tracking-widest px-4 py-2 transition-colors ${
              active
                ? "text-terminal-amber border-b-2 border-terminal-amber"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
