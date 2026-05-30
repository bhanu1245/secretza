"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Shield,
  Star,
  Eye,
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BadgeCheck,
  ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import StarRating from "@/components/secretza/review/StarRating";
import ReviewList from "@/components/secretza/review/ReviewList";
import ListingContactSection from "@/components/secretza/listing/ListingContactSection";
import { normalizeListingContact } from "@/lib/listing-contact";
import { buildCategoryUrl } from "@/lib/seo-ssr";
import { cn } from "@/lib/utils";
import {
  getPublicListingImages,
  getListingCoverImageWithPlaceholder,
} from "@/lib/listing-images";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface SerializedListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  services: string[];
  price: string;
  currency: string;
  status: string;
  isFeatured: boolean;
  isBoosted: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  contactEmail: string | null;
  contactTelegram: string | null;
  contactInstagram: string | null;
  contactWebsite: string | null;
  contactText: string | null;
  whatsapp: string | null;
  telegram: string | null;
  age: number | null;
  user: { id: string; name: string | null; avatar: string | null; isVerified: boolean };
  category: { id: string; name: string; slug: string; color: string };
  country: { id: string; name: string; slug: string };
  state: { id: string; name: string; slug: string } | null;
  city: { id: string; name: string; slug: string };
  listingImages: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    mediumUrl: string;
    width: number;
    height: number;
    sortOrder: number;
    blurHash: string | null;
  }>;
  profileImage?: string | null;
  galleryImages?: string[] | string;
  legacyImages: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  averageRating: number;
  reviewCount: number;
}

interface ListingPageContentProps {
  listing: SerializedListing;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function useImages(listing?: SerializedListing) {
  if (!listing) {
    return [];
  }

  const resolved = getPublicListingImages({
    ...listing,
    images: listing.legacyImages,
  });

  if (resolved.length > 0) {
    return resolved;
  }

  return [getListingCoverImageWithPlaceholder(listing, { publicOnly: true })];
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
export default function ListingPageContent({ listing }: ListingPageContentProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const images = useImages(listing);
  const currentImage = images[selectedImageIndex] || images[0];
  const contact = normalizeListingContact(listing);

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column — Images + Description */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* Back link */}
        <Link
          href={buildCategoryUrl(listing.category.slug)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-violet transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          Back to {listing.category.name}
        </Link>

        {/* Image Gallery */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#0B0B0F]">
            {currentImage ? (
              <img
                src={currentImage.url}
                alt={currentImage.alt || listing.title}
                className="size-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <ImageIcon className="size-12 text-[#52525B]" />
              </div>
            )}

            {/* Image navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 z-10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70 z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}

            {/* Image counter */}
            <div className="absolute bottom-3 right-3 z-10">
              <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {selectedImageIndex + 1} / {images.length}
              </span>
            </div>
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={cn(
                    "shrink-0 overflow-hidden rounded-lg border-2 transition",
                    idx === selectedImageIndex
                      ? "border-violet"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={img.thumbnailUrl || img.url}
                    alt={`${listing.title} - ${idx + 1}`}
                    className="size-16 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {listing.isFeatured && (
            <Badge className="gap-1 bg-violet text-white border-0 pulse-violet">
              <Star className="size-3 fill-current" />
              Featured
            </Badge>
          )}
          {listing.user.isVerified && (
            <Badge className="gap-1 bg-emerald-500/90 text-white border-0">
              <Shield className="size-3" />
              Verified
            </Badge>
          )}
          <Badge
            className="border-0"
            style={{
              backgroundColor: `${listing.category.color}20`,
              color: listing.category.color,
            }}
          >
            {listing.category.name}
          </Badge>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">
          {listing.title}
        </h1>

        {/* Price */}
        {listing.price && (
          <div className="rounded-xl bg-violet/10 px-5 py-3 w-fit">
            <span className="text-2xl sm:text-3xl font-bold text-violet">
              {listing.price}
            </span>
          </div>
        )}

        {/* Description */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Description
          </h2>
          <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
            {listing.description}
          </div>
        </div>

        {/* Tags */}
        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {listing.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-surface-light px-2.5 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {listing.services.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Services
            </h2>
            <div className="flex flex-wrap gap-2">
              {listing.services.map((service) => (
                <span
                  key={service}
                  className="rounded-lg border border-violet/20 bg-violet/10 px-3 py-1.5 text-xs text-violet"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <ReviewList listingId={listing.id} />
      </div>

      {/* Right Column — Sidebar */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <ListingContactSection contact={contact} />

        {/* Advertiser Card */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            Advertiser
          </h3>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 border-2 border-violet/30">
              <AvatarImage
                src={listing.user.avatar || undefined}
                alt={listing.user.name || "Advertiser"}
              />
              <AvatarFallback className="bg-surface-light text-violet">
                {listing.user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {listing.user.name}
                </span>
                {listing.user.isVerified && (
                  <BadgeCheck className="size-4 text-emerald-500" />
                )}
              </div>
              {listing.user.isVerified && (
                <span className="text-xs text-muted-foreground">
                  Verified Advertiser
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            Details
          </h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-violet" />
              <span className="text-sm">
                {listing.city.name}
                {listing.state ? `, ${listing.state.name}` : ""},{" "}
                {listing.country.name}
              </span>
            </div>
            {listing.age && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <BadgeCheck className="size-4 shrink-0 text-violet" />
                <span className="text-sm">{listing.age} years old</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 shrink-0 text-violet" />
              <span className="text-sm">
                {new Date(listing.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="size-4 shrink-0 text-violet" />
              <span className="text-sm">
                {listing.viewCount.toLocaleString()} views
              </span>
            </div>
            {listing.reviewCount > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star className="size-4 shrink-0 text-amber-400" />
                <StarRating
                  rating={listing.averageRating}
                  size="sm"
                  showValue={true}
                />
                <span className="text-xs">({listing.reviewCount})</span>
              </div>
            )}
          </div>
        </div>

        {/* Report */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Flag className="size-4" />
          Report this listing
        </Button>
      </div>
    </div>
  );
}
