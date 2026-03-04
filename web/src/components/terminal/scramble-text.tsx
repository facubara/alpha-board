"use client";

import { useState, useEffect, useRef } from "react";

const SCRAMBLE_CHARS = "#@%01!?*+=~";

function useScrambleText(finalText: string, duration = 400) {
  const [display, setDisplay] = useState(finalText);
  const frameRef = useRef<number>(undefined);

  useEffect(() => {
    const start = Date.now();
    const chars = finalText.split("");

    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const settled = Math.floor(progress * chars.length);

      const result = chars.map((char, i) => {
        if (i < settled) return char;
        if (char === " ") return " ";
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      });

      setDisplay(result.join(""));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [finalText, duration]);

  return display;
}

interface ScrambleTextProps {
  text: string;
  duration?: number;
  className?: string;
  as?: "span" | "div" | "p";
}

export function ScrambleText({ text, duration = 400, className = "", as: Tag = "span" }: ScrambleTextProps) {
  const display = useScrambleText(text, duration);

  return (
    <Tag className={`font-mono ${className}`}>
      {display}
    </Tag>
  );
}
