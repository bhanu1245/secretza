/** SecretZa brand system — single source of truth for naming, colors, and assets. */

export const BRAND_NAME = "SecretZa" as const;

export const BRAND_COLORS = {
  primary: "#3B82F6",
  secondary: "#6366F1",
  primaryLight: "#60A5FA",
  secondaryLight: "#818CF8",
  gradient: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
  gradientExtended: "linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #818CF8 100%)",
  darkBg: "#0B0B0F",
  lightBg: "#FFFFFF",
} as const;

export const BRAND_ASSETS = {
  logoFullDark: "/brand/logo-full-dark.svg",
  logoFullLight: "/brand/logo-full-light.svg",
  logoIconDark: "/brand/logo-icon-dark.svg",
  logoIconLight: "/brand/logo-icon-light.svg",
  logoMobileDark: "/brand/logo-mobile-dark.svg",
  favicon: "/brand/favicon.svg",
  ogImage: "/brand/og-image.svg",
  icon192: "/brand/icon-192.svg",
  icon512: "/brand/icon-512.svg",
  /** Legacy path — points to premium icon */
  logoLegacy: "/brand/logo-icon-dark.svg",
} as const;

export type LogoTheme = "dark" | "light";
export type LogoVariant = "full" | "icon" | "mobile";

/** User-facing title suffix for SEO pages */
export function brandTitleSuffix(): string {
  return ` | ${BRAND_NAME}`;
}

/** Email template header block with logo */
export function emailBrandHeader(title: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://SecretZa.com";
  return `
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${baseUrl}${BRAND_ASSETS.logoIconDark}" width="48" height="48" alt="${BRAND_NAME}" style="border-radius: 12px; margin-bottom: 16px;" />
      <h1 style="color: #F5F5F7; font-size: 24px; margin: 0;">${title}</h1>
    </div>`;
}

export const EMAIL_BUTTON_STYLE =
  "display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #3B82F6, #6366F1); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;";
