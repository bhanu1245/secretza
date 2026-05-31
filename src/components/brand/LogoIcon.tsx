"use client";

import { cn } from "@/lib/utils";
import type { LogoTheme } from "@/lib/brand";
import LogoMark from "./LogoMark";

type LogoIconProps = {
  size?: number;
  theme?: LogoTheme;
  className?: string;
};

/** Premium SecretZa icon — rounded-square bold serif "SZ" monogram tile */
export default function LogoIcon({
  size = 36,
  theme = "dark",
  className,
}: LogoIconProps) {
  return (
    <LogoMark
      size={size}
      theme={theme}
      className={cn(className)}
      idPrefix={`sz-${theme}-${size}`}
    />
  );
}
