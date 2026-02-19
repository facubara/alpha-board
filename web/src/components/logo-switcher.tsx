"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

const LOGOS = [
  { key: "ascii", src: "/logos/ascii-logo.png" },
  { key: "crosshatch", src: "/logos/crosshatch-logo.png" },
  { key: "dots", src: "/logos/dots-logo.png" },
  { key: "halftone", src: "/logos/halftone-logo.png" },
  { key: "edge-detection", src: "/logos/edge-detection-logo.png" },
  { key: "vhs", src: "/logos/vhs-logo.png" },
] as const;

const STORAGE_KEY = "alpha-board:logo-variant";

export function LogoSwitcher() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const found = LOGOS.findIndex((l) => l.key === stored);
      if (found !== -1) setIndex(found);
    }
    setMounted(true);
  }, []);

  function cycle() {
    const next = (index + 1) % LOGOS.length;
    setIndex(next);
    localStorage.setItem(STORAGE_KEY, LOGOS[next].key);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link href="/" aria-label="Home">
        <img
          key={LOGOS[index].key}
          src={LOGOS[index].src}
          alt="Alpha Board"
          className="h-[38px] w-auto rounded-sm"
          style={{ visibility: mounted ? "visible" : "hidden" }}
        />
      </Link>
      <button
        onClick={cycle}
        aria-label="Switch logo variant"
        title="Switch logo variant"
        className="rounded p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
      >
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
