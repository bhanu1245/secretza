import { cn } from "@/lib/utils";
import { BRAND_NAME, type LogoTheme } from "@/lib/brand";

type BrandWordmarkProps = {
  theme?: LogoTheme;
  className?: string;
  /** Smaller size for mobile header */
  compact?: boolean;
};

/**
 * SecretZa wordmark — Variant A "Classic Serif Bold".
 * Monochrome serif caps with wide tracking, pairing with the SZ monogram tile.
 */
export default function BrandWordmark({
  theme = "dark",
  className,
  compact = false,
}: BrandWordmarkProps) {
  const baseColor = theme === "dark" ? "text-foreground" : "text-gray-900";

  return (
    <span
      className={cn(
        "font-serif font-bold uppercase select-none",
        compact ? "text-sm sm:text-base tracking-[0.14em]" : "text-base sm:text-lg tracking-[0.18em]",
        baseColor,
        className
      )}
      aria-label={BRAND_NAME}
    >
      {BRAND_NAME}
    </span>
  );
}
