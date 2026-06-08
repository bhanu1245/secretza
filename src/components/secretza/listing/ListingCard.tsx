"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin, Shield, Eye, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ListingTierBadge, { resolveListingTier } from "@/components/secretza/listing/ListingTierBadge";
import type { Listing } from "@/lib/types";
import TimeAgo from "@/components/secretza/shared/TimeAgo";
import { useNavigationStore, useUIStore } from "@/store/useAppStore";
import StarRating from "@/components/secretza/review/StarRating";
import { cn } from "@/lib/utils";
import { getListingCoverImageWithPlaceholder, getListingImages } from "@/lib/listing-images";
import { isSpaHome, listingPath } from "@/lib/public-navigation";

interface ListingCardProps {
  listing: Listing;
}

// ==========================================
// BlurHash CSS Placeholder
// ==========================================
function BlurHashPlaceholder({
  blurHash,
  width,
  height,
  className,
}: {
  blurHash?: string;
  width: number;
  height: number;
  className?: string;
}) {
  // Generate a low-quality canvas-based placeholder from the blurHash
  // This is a simplified version that creates a colored gradient based on blurHash characters
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !blurHash) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Decode blurHash to colors (simplified - just use first few chars as color seeds)
    const colors = decodeBlurHashColors(blurHash);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some blur/noise effect
    ctx.filter = "blur(20px)";
  }, [blurHash, width, height]);

  if (!blurHash) {
    return (
      <div className={cn("animate-pulse bg-gradient-to-br from-[#1E1E2A] to-[#15151D]", className)} />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className={cn("w-full h-full object-cover", className)}
      style={{
        imageRendering: "auto",
        filter: "blur(20px)",
        transform: "scale(1.2)",
      }}
    />
  );
}

// Simplified blurhash color extraction
function decodeBlurHashColors(hash: string): string[] {
  if (!hash || hash.length < 6) {
    return ["#1E1E2A", "#252535", "#1E1E2A"];
  }

  try {
    // Extract size info from first two chars
    const sizeFlag = hash.charCodeAt(0) - 48;
    const numY = Math.floor(sizeFlag / 9) + 1;
    const numX = (sizeFlag % 9) + 1;

    // Decode quantized DC value (first real color)
    const dcVal = decode83(hash.slice(2, 6));
    return [sRGBToLinear(decodeDC(dcVal)), "#252535", "#1E1E2A"];
  } catch {
    return ["#1E1E2A", "#252535", "#1E1E2A"];
  }
}

function decode83(str: string): number {
  let value = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    value = value * 83 + (c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55 : c >= 97 && c <= 122 ? c - 61 : c <= 127 ? -1 : -1);
  }
  return value;
}

function decodeDC(value: number): string {
  const r = Math.max(0, Math.round(value / 50 * 255));
  const g = Math.max(0, Math.round(((value % 50) / 50) * 255));
  const b = Math.max(0, Math.round(((value % 25) / 25) * 255));
  return `rgb(${Math.min(r, 180)}, ${Math.min(g, 120)}, ${Math.min(b, 220)})`;
}

function sRGBToLinear(color: string): string {
  return color;
}

/** True when the browser has already fetched/decoded this img (cache / hydration). */
export function isImageAlreadyLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

// ==========================================
// OptimizedImage Component
// ==========================================
function OptimizedImage({
  src,
  alt,
  thumbnailSrc,
  className,
  blurHash,
  imageWidth,
  imageHeight,
}: {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  className?: string;
  blurHash?: string;
  imageWidth?: number;
  imageHeight?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(thumbnailSrc || src);
  const imgRef = useRef<HTMLImageElement>(null);
  const fullPreloadStartedRef = useRef(false);

  useEffect(() => {
    fullPreloadStartedRef.current = false;
  }, [src, thumbnailSrc]);

  const startFullPreload = useCallback(() => {
    if (fullPreloadStartedRef.current) return;
    if (!thumbnailSrc || thumbnailSrc === src) return;
    fullPreloadStartedRef.current = true;
    const fullImg = new Image();
    fullImg.src = src;
    fullImg.onload = () => {
      setDisplaySrc(src);
    };
  }, [thumbnailSrc, src]);

  const markLoaded = useCallback(() => {
    setLoaded(true);
    if (thumbnailSrc && thumbnailSrc !== src && displaySrc === thumbnailSrc) {
      startFullPreload();
    }
  }, [thumbnailSrc, src, displaySrc, startFullPreload]);

  const attachImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (!node || error) return;
      if (isImageAlreadyLoaded(node)) {
        markLoaded();
      }
    },
    [error, markLoaded],
  );

  // Sync cached/hydrated images when displaySrc changes (e.g. thumb → full swap).
  useLayoutEffect(() => {
    if (error) return;
    if (!isImageAlreadyLoaded(imgRef.current)) return;
    // Intentional: recover from missed onLoad when the browser already decoded the image.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration/cache safety for <img>
    markLoaded();
  }, [displaySrc, error, markLoaded]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* BlurHash placeholder */}
      {!loaded && !error && (
        <BlurHashPlaceholder
          blurHash={blurHash}
          width={imageWidth || 300}
          height={imageHeight || 400}
          className="absolute inset-0 z-0"
        />
      )}

      {/* Actual image */}
      <img
        ref={attachImgRef}
        src={displaySrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          if (error) return;
          markLoaded();
        }}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          error ? "opacity-0" : ""
        )}
      />

      {/* Fallback gradient on error */}
      {error && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E1E2A] to-[#15151D] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-violet/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#52525B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ListingCard Component
// ==========================================
export default function ListingCard({ listing }: ListingCardProps) {
  const pathname = usePathname();
  const navigate = useNavigationStore((s) => s.navigate);
  const setSelectedListingId = useUIStore((s) => s.setSelectedListingId);
  const resolvedImages = getListingImages(listing);
  const coverImage = getListingCoverImageWithPlaceholder(listing);
  const useSpaModal = isSpaHome(pathname);
  const href = listing.slug ? listingPath(listing.slug) : undefined;

  const handleClick = () => {
    setSelectedListingId(listing.id);
    if (useSpaModal) {
      navigate("listing", { id: listing.id, slug: listing.slug });
    }
  };

  const imageSrc = coverImage.url;
  const thumbSrc = coverImage.thumbnailUrl || imageSrc;
  const blurHash = coverImage?.blurHash;
  const imgWidth = coverImage?.width;
  const imgHeight = coverImage?.height;

  const cardContent = (
    <>
      {/* Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <OptimizedImage
          src={imageSrc}
          alt={coverImage.alt || listing.title}
          thumbnailSrc={thumbSrc !== imageSrc ? thumbSrc : undefined}
          blurHash={blurHash}
          imageWidth={imgWidth}
          imageHeight={imgHeight}
          className="transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Verified Badge */}
        {(listing.user as any)?.isVerified && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <Badge className="gap-1 bg-emerald-500/90 text-[10px] font-semibold text-white border-0 backdrop-blur-sm">
            <Shield className="size-3" />
            Verified
          </Badge>
        </div>
        )}

        {/* Tier Badge (Boosted > Premium > Featured) */}
        {resolveListingTier(listing) && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <ListingTierBadge listing={listing} variant="overlay" />
          </div>
        )}

        {/* Image Count Badge (if multiple images) */}
        {resolvedImages.length > 1 && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {resolvedImages.length} photos
            </span>
          </div>
        )}

        {/* Price Overlay (bottom-right of image) */}
        {listing.price && (
          <div className="absolute bottom-2.5 right-2.5 z-10">
            <span className="block max-w-32 truncate rounded-lg bg-violet/90 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-sm">
              {listing.price}
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#F5F5F7]">
          {listing.title}
        </h3>

        {/* Location */}
        <div className="flex min-w-0 items-center gap-1 text-[#A1A1AA]">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate text-xs">
            {listing.city.name}, {listing.state.name}
          </span>
        </div>

        {/* Category Badge */}
        <div>
          <Badge
            className="text-[10px] font-medium border-0"
            style={{
              backgroundColor: `${listing.category.color}20`,
              color: listing.category.color,
            }}
          >
            {listing.category.name}
          </Badge>
        </div>

        {(listing.reviewCount ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={listing.averageRating ?? 0} size="sm" showValue={true} />
            <span className="text-[10px] text-[#A1A1AA]">({listing.reviewCount})</span>
          </div>
        )}
        {/* Tags */}
        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {listing.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[#1E1E2A] px-1.5 py-0.5 text-[10px] text-[#A1A1AA]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.06)] pt-2">
          <div className="flex min-w-0 items-center gap-1 text-[#A1A1AA]">
            <Clock className="size-3" />
            <span className="truncate text-[10px]"><TimeAgo date={listing.createdAt} /></span>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[#A1A1AA]">
            <Eye className="size-3" />
            <span className="text-[10px]">{listing.viewCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </>
  );

  const cardClassName =
    "card-hover group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface";

  if (!useSpaModal && href) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Link href={href} className={cardClassName}>
          {cardContent}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cardClassName}
      onClick={handleClick}
    >
      {cardContent}
    </motion.div>
  );
}
