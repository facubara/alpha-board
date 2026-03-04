"use client";

import React, { useState, useEffect } from "react";

export function InteractiveGrid({ children }: { children: React.ReactNode }) {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-void text-text-primary">
      {/* Base Dark Dot Matrix (Scrolls normally with page) */}
      <div className="absolute inset-0 bg-dot-matrix opacity-50 pointer-events-none" />

      {/* Illuminated Amber Dot Matrix (Fixed to viewport, never crops) */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300 z-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 176, 0, 0.8) 2px, transparent 2px)",
          backgroundSize: "24px 24px",
          WebkitMaskImage: `radial-gradient(circle 200px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
          maskImage: `radial-gradient(circle 200px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
        }}
      />

      {/* Page Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
