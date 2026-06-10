"use client";

import { Crown, Rocket, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ListingTierBadgeInput = {
  isBoosted?: boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
  boostUntil?: string | Date | null;
  featuredUntil?: string | Date | null;
};

export type ListingTier = "boosted" | "premium" | "featured";

function isBoostTierActive(listing: ListingTierBadgeInput): boolean {
  return Boolean(
    listing.isBoosted &&
      listing.boostUntil &&
      new Date(listing.boostUntil).getTime() > Date.now(),
  );
}

function isFeaturedTierActive(listing: ListingTierBadgeInput): boolean {
  return Boolean(
    listing.isFeatured &&
      listing.featuredUntil &&
      new Date(listing.featuredUntil).getTime() > Date.now(),
  );
}

function isPremiumTierActive(listing: ListingTierBadgeInput): boolean {
  return Boolean(listing.isPremium);
}

/** All active tiers for display (boosted, premium, featured — not mutually exclusive). */
export function resolveActiveListingTiers(listing: ListingTierBadgeInput): ListingTier[] {
  const tiers: ListingTier[] = [];
  if (isBoostTierActive(listing)) tiers.push("boosted");
  if (isPremiumTierActive(listing)) tiers.push("premium");
  if (isFeaturedTierActive(listing)) tiers.push("featured");
  return tiers;
}

/** Single highest-priority tier (legacy / compact contexts). */
export function resolveListingTier(listing: ListingTierBadgeInput): ListingTier | null {
  return resolveActiveListingTiers(listing)[0] ?? null;
}

type ListingTierBadgeProps = {
  listing: ListingTierBadgeInput;
  tier?: ListingTier;
  variant?: "overlay" | "inline";
  className?: string;
};

const OVERLAY_STYLES: Record<ListingTier, string> = {
  boosted: "bg-violet-600/90 text-white border-0 backdrop-blur-sm",
  premium: "bg-blue-600/90 text-white border-0 backdrop-blur-sm",
  featured: "bg-amber-500/90 text-white border-0 backdrop-blur-sm pulse-violet",
};

const INLINE_STYLES: Record<ListingTier, string> = {
  boosted: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  premium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  featured: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const LABELS: Record<ListingTier, string> = {
  boosted: "Boosted",
  premium: "Premium",
  featured: "Featured",
};

export default function ListingTierBadge({
  listing,
  tier,
  variant = "inline",
  className,
}: ListingTierBadgeProps) {
  const activeTiers = resolveActiveListingTiers(listing);
  const resolvedTier = tier ?? activeTiers[0] ?? null;
  if (!resolvedTier || !activeTiers.includes(resolvedTier)) return null;

  const isOverlay = variant === "overlay";
  const Icon = resolvedTier === "boosted" ? Rocket : resolvedTier === "premium" ? Crown : Star;

  return (
    <Badge
      variant={isOverlay ? "default" : "outline"}
      className={cn(
        "gap-1 text-[10px] font-semibold px-1.5 py-0",
        isOverlay ? OVERLAY_STYLES[resolvedTier] : INLINE_STYLES[resolvedTier],
        className,
      )}
    >
      <Icon className={cn("size-3", resolvedTier === "featured" && !isOverlay && "fill-amber-400")} />
      {LABELS[resolvedTier]}
    </Badge>
  );
}

type ListingTierBadgesProps = {
  listing: ListingTierBadgeInput;
  variant?: "overlay" | "inline";
  layout?: "row" | "stack";
  className?: string;
};

export function ListingTierBadges({
  listing,
  variant = "inline",
  layout = "row",
  className,
}: ListingTierBadgesProps) {
  const tiers = resolveActiveListingTiers(listing);
  if (tiers.length === 0) return null;

  return (
    <div
      className={cn(
        layout === "stack"
          ? "flex flex-col items-end gap-1"
          : "flex flex-row flex-wrap items-center gap-1",
        className,
      )}
    >
      {tiers.map((tier) => (
        <ListingTierBadge key={tier} listing={listing} tier={tier} variant={variant} />
      ))}
    </div>
  );
}
