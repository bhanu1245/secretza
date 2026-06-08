"use client";

import { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Shield,
  Eye,
  Flag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BadgeCheck,
  ImageIcon,
} from "lucide-react";
import ListingTierBadge from "@/components/secretza/listing/ListingTierBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Listing } from "@/lib/types";
import TimeAgo, { formatDate } from "@/components/secretza/shared/TimeAgo";
import { useUIStore } from "@/store/useAppStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ReviewList from "@/components/secretza/review/ReviewList";
import ListingContactSection from "@/components/secretza/listing/ListingContactSection";
import ShareButtons from "@/components/secretza/shared/ShareButtons";
import { buildListingUrl } from "@/lib/seo-ssr";
import {
  getListingImages,
  getListingCoverImageWithPlaceholder,
} from "@/lib/listing-images";

interface ListingDetailProps {
  listing: Listing;
  isOpen: boolean;
  onClose: () => void;
}

// ==========================================
// Optimized Image for Detail View
// ==========================================
function DetailImage({
  src,
  alt,
  thumbnailSrc,
  className,
  blurHash,
  onLoaded,
}: {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  className?: string;
  blurHash?: string;
  onLoaded?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* BlurHash background */}
      {!loaded && !error && blurHash && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, #1E1E2A 0%, #252535 50%, #1E1E2A 100%)`,
            filter: "blur(20px)",
            transform: "scale(1.5)",
          }}
        />
      )}

      {!loaded && !error && (
        <div className="absolute inset-0 bg-[#1E1E2A] animate-pulse" />
      )}

      <img
        src={loaded ? src : (thumbnailSrc || src)}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          if (thumbnailSrc && thumbnailSrc !== src && !loaded) {
            setLoaded(true);
            // Preload full image
            const fullImg = new Image();
            fullImg.src = src;
            fullImg.onload = () => {
              setLoaded(true);
              onLoaded?.();
            };
          } else {
            setLoaded(true);
            onLoaded?.();
          }
        }}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          error ? "opacity-0" : ""
        )}
      />

      {error && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E1E2A] to-[#15151D] flex items-center justify-center">
          <ImageIcon className="size-10 text-[#52525B]" />
        </div>
      )}
    </div>
  );
}

export default function ListingDetail({
  listing,
  isOpen,
  onClose,
}: ListingDetailProps) {
  const isMobile = useIsMobile();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);

  const resolvedImages = getListingImages(listing);
  const images =
    resolvedImages.length > 0
      ? resolvedImages
      : [getListingCoverImageWithPlaceholder(listing)];

  const currentImage = images[selectedImageIndex] || images[0];

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setMainImageLoaded(false);
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setMainImageLoaded(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[95vh] max-h-[95vh] w-full rounded-t-2xl p-0 sm:max-w-full"
            : "w-full max-w-2xl p-0 sm:max-w-2xl"
        }
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{listing.title}</SheetTitle>
          <SheetDescription>Listing details</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-full">
          <div className="flex flex-col">
            {/* Image Gallery */}
            <div className="relative">
              {/* Main Image */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0B0B0F]">
                {currentImage && (
                  <DetailImage
                    src={currentImage.url}
                    alt={currentImage.alt || listing.title}
                    thumbnailSrc={currentImage.thumbnailUrl}
                    blurHash={currentImage.blurHash}
                    className="absolute inset-0"
                    onLoaded={() => setMainImageLoaded(true)}
                  />
                )}

                {/* Image Navigation */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70 z-10"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70 z-10"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                )}

                {/* Image Count Badge */}
                <div className="absolute bottom-2.5 right-2.5 z-10">
                  <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                </div>

                {/* Loading indicator for main image */}
                {!mainImageLoaded && currentImage && (
                  <div className="absolute inset-0 flex items-center justify-center z-0">
                    <div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex flex-wrap gap-2 bg-surface px-3 py-2">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedImageIndex(idx);
                        setMainImageLoaded(false);
                      }}
                      className={cn(
                        "shrink-0 overflow-hidden rounded-lg border-2 transition",
                        idx === selectedImageIndex
                          ? "border-violet"
                          : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <img
                        src={img.thumbnailUrl || img.url}
                        alt={img.alt || `${listing.title} - ${idx + 1}`}
                        className="size-16 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 p-4">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <ListingTierBadge listing={listing} variant="inline" />
                {(listing.user as any)?.isVerified && (
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
              <h1 className="text-xl font-bold leading-tight text-[#F5F5F7]">
                {listing.title}
              </h1>

              <ShareButtons
                url={buildListingUrl(listing.slug)}
                title={listing.title}
                className="mt-2"
              />

              {/* Price */}
              {listing.price && (
                <div className="rounded-xl bg-violet/10 px-4 py-3">
                  <span className="text-2xl font-bold text-violet">
                    {listing.price}
                  </span>
                </div>
              )}

              {/* Description */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#A1A1AA] uppercase tracking-wider">
                  Description
                </h3>
                <p className="text-sm leading-relaxed text-[#F5F5F7]/80">
                  {listing.description}
                </p>
              </div>

              {/* Tags */}
              {listing.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {listing.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-[#1E1E2A] px-2.5 py-1 text-xs text-[#A1A1AA]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Separator className="bg-[rgba(255,255,255,0.08)]" />

              {/* Location & Meta */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#A1A1AA]">
                  <MapPin className="size-4 shrink-0 text-violet" />
                  <span className="text-sm">
                    {listing.city.name}, {listing.state.name},{" "}
                    {listing.country.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#A1A1AA]">
                  <Calendar className="size-4 shrink-0 text-violet" />
                  <span className="text-sm">
                    <TimeAgo date={listing.createdAt} /> &middot;{" "}
                    <span suppressHydrationWarning>{formatDate(listing.createdAt)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#A1A1AA]">
                  <Eye className="size-4 shrink-0 text-violet" />
                  <span className="text-sm">
                    {listing.viewCount.toLocaleString()} views
                  </span>
                </div>
              </div>

              <Separator className="bg-[rgba(255,255,255,0.08)]" />

              {/* Advertiser Info */}
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
                    <span className="text-sm font-semibold text-[#F5F5F7]">
                      {listing.user.name}
                    </span>
                    {(listing.user as any).isVerified && (
                      <BadgeCheck className="size-4 text-emerald-500" />
                    )}
                  </div>
                  {(listing.user as any).isVerified && (
                    <span className="text-xs text-[#A1A1AA]">Verified Advertiser</span>
                  )}
                </div>
              </div>

              <Separator className="bg-[rgba(255,255,255,0.08)]" />

              <ListingContactSection listingId={listing.id} className="bg-surface" />

              {/* Report */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-[#A1A1AA] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              >
                <Flag className="size-4" />
                Report this listing
              </Button>

              {/* Reviews Section */}
              <ReviewList listingId={listing.id} />

              {/* Bottom spacing for mobile close handle */}
              {isMobile && <div className="h-6" />}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
