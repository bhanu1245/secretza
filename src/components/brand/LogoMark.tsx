"use client";

import { cn } from "@/lib/utils";
import { BRAND_COLORS, type LogoTheme } from "@/lib/brand";

export type LogoMarkProps = {
  size?: number;
  theme?: LogoTheme;
  className?: string;
  /**
   * Reserved for API compatibility with prior gradient-based marks.
   * Variant A is a flat monochrome monogram and needs no SVG defs,
   * but the prop is retained so existing call sites keep compiling.
   */
  idPrefix?: string;
};

/** Serif font stack — Georgia leads, with robust serif fallbacks for SSR/Linux. */
const SERIF_STACK = "Georgia, 'Times New Roman', Times, serif";

/**
 * SecretZa mark — Variant A "Classic Serif Bold".
 * A rounded-square tile containing a bold serif "SZ" monogram, in the
 * luxury fashion-house tradition. Single source of truth for the icon
 * rendered in Header, Footer, Admin, Auth, and static SVG exports.
 */
export default function LogoMark({
  size = 64,
  theme = "dark",
  className,
}: LogoMarkProps) {
  const isDark = theme === "dark";
  const tile = isDark ? BRAND_COLORS.darkBg : BRAND_COLORS.lightBg;
  const ink = isDark ? "#FFFFFF" : BRAND_COLORS.darkBg;
  const border = isDark ? "rgba(255,255,255,0.18)" : "rgba(11,11,15,0.16)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="62" height="62" rx="8" fill={tile} />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="8"
        stroke={border}
        strokeWidth="1.5"
        fill="none"
      />
      <text
        x="32"
        y="46"
        fontFamily={SERIF_STACK}
        fontSize="34"
        fontWeight="700"
        letterSpacing="-1"
        textAnchor="middle"
        fill={ink}
      >
        SZ
      </text>
    </svg>
  );
}
