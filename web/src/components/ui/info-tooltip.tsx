"use client";

/**
 * InfoTooltip — Lightweight tooltip wrapper for explanatory hints.
 *
 * Two modes:
 * 1. Wrap children: <InfoTooltip content="..."><MyElement /></InfoTooltip>
 * 2. Inline icon: <InfoTooltip content="..." icon />  renders a small (i) icon
 */

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  /** Tooltip text content */
  content: string;
  /** Wrap children as the trigger (default) */
  children?: ReactNode;
  /** Show a small info icon as trigger instead of wrapping children */
  icon?: boolean;
  /** Side to show tooltip */
  side?: "top" | "bottom" | "left" | "right";
  /** Additional className for the trigger wrapper */
  className?: string;
}

export function InfoTooltip({
  content,
  children,
  icon,
  side = "top",
  className,
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={!icon} className={icon ? cn("inline-flex", className) : className}>
        {icon ? (
          <span className="ml-1 inline-flex cursor-help items-center text-muted transition-colors hover:text-secondary">
            <Info className="h-3 w-3" />
          </span>
        ) : (
          children
        )}
      </TooltipTrigger>
      <TooltipContent side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
