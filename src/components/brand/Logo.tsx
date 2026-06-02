"use client";

import { cn } from "@/lib/utils";
import type { LogoTheme, LogoVariant } from "@/lib/brand";
import LogoIcon from "./LogoIcon";
import BrandWordmark from "./BrandWordmark";

export type LogoProps = {
  variant?: LogoVariant;
  theme?: LogoTheme;
  className?: string;
  iconClassName?: string;
  /** Icon pixel size */
  iconSize?: number;
};

/**
 * SecretZa logo — full wordmark, compact icon, or mobile layout.
 * @default variant="full" theme="dark"
 */
export default function Logo({
  variant = "full",
  theme = "dark",
  className,
  iconClassName,
  iconSize,
}: LogoProps) {
  const size =
    iconSize ?? (variant === "mobile" ? 32 : variant === "icon" ? 36 : 36);

  if (variant === "icon") {
    return (
      <LogoIcon size={size} theme={theme} className={cn(className, iconClassName)} />
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 shrink-0", className)}>
      <LogoIcon size={size} theme={theme} className={iconClassName} />
      {variant === "full" && (
        <BrandWordmark theme={theme} className="hidden sm:inline" />
      )}
      {variant === "mobile" && <BrandWordmark theme={theme} compact />}
    </div>
  );
}
