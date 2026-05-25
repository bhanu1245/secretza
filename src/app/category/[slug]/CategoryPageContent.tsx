"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ListingCard from "@/components/secretza/listing/ListingCard";
import { buildUrl } from "@/lib/seo-ssr";
import type { Listing } from "@/lib/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface SerializedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  listingCount: number;
}

interface CategoryPageContentProps {
  category: SerializedCategory;
  listings: Listing[];
  total: number;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
export default function CategoryPageContent({
  category,
  listings,
  total,
}: CategoryPageContentProps) {
  return (
    <div>
      {/* Back link */}
      <Link
        href={buildUrl("/")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-violet transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="size-4" />
        Back to Home
      </Link>

      {/* Category Header */}
      <div className="flex flex-col gap-3 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {category.name}
          </h1>
          <Badge
            className="text-xs border-0"
            style={{
              backgroundColor: `${category.color}20`,
              color: category.color,
            }}
          >
            {total} listing{total !== 1 ? "s" : ""}
          </Badge>
        </div>
        {category.description && (
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {category.description}
          </p>
        )}
      </div>

      {/* Listings Grid */}
      {listings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center mb-4">
            <span className="text-3xl">📋</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No listings yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            There are no approved listings in this category yet. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}
