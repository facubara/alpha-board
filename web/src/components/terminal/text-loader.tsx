"use client";

import { useState, useEffect } from "react";

const FRAMES = ["[ - ]", "[ \\ ]", "[ | ]", "[ / ]"];

interface TextLoaderProps {
  text?: string;
  className?: string;
}

export function TextLoader({ text = "Loading...", className = "" }: TextLoaderProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`font-mono text-sm text-text-secondary ${className}`}>
      {FRAMES[frame]} {text}
    </span>
  );
}
