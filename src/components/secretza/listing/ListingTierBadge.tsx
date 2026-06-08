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

export function resolveListingTier(listing: ListingTierBadgeInput): ListingTier | null {
  const now = Date.now();
  const boostActive =
    listing.isBoosted &&
    listing.boostUntil &&
    new Date(listing.boostUntil).getTime() > now;
  const featuredActive =
    listing.isFeatured &&
    listing.featuredUntil &&
    new Date(listing.featuredUntil).getTime() > now;

  if (boostActive) return "boosted";
  if (listing.isPremium) return "premium";
  if (featuredActive) return "featured";
  return null;
}

type ListingTierBadgeProps = {
  listing: ListingTierBadgeInput;
  variant?: "overlay" | "inline";
  className?: string;
};

const OVERLAY_STYLES: Record<ListingTier, string> = {
  boosted: "bg-violet-600/90 text-white border-0 backdrop-blur-sm",
  premium: "bg-blue-600/90 text-white border-0 backdrop-blur-sm",
  featured: "bg-violet/90 text-white border-0 backdrop-blur-sm pulse-violet",
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
  variant = "inline",
  className,
}: ListingTierBadgeProps) {
  const tier = resolveListingTier(listing);
  if (!tier) return null;

  const isOverlay = variant === "overlay";
  const Icon = tier === "boosted" ? Rocket : tier === "premium" ? Crown : Star;

  return (
    <Badge
      variant={isOverlay ? "default" : "outline"}
      className={cn(
        "gap-1 text-[10px] font-semibold px-1.5 py-0",
        isOverlay ? OVERLAY_STYLES[tier] : INLINE_STYLES[tier],
        className,
      )}
    >
      <Icon className={cn("size-3", tier === "featured" && !isOverlay && "fill-amber-400")} />
      {LABELS[tier]}
    </Badge>
  );
}
