import { resolveSeoImageUrl, SEO_IMAGE_PLACEHOLDER } from "@/lib/seo-images-utils";

export interface SeoFeaturedImageProps {
  src?: string | null;
  alt: string;
  title?: string | null;
  caption?: string | null;
  priority?: boolean;
}

export default function SeoFeaturedImage({
  src,
  alt,
  title,
  caption,
  priority = false,
}: SeoFeaturedImageProps) {
  const imageUrl = resolveSeoImageUrl(src);
  const isPlaceholder = !src?.trim() || imageUrl === SEO_IMAGE_PLACEHOLDER;

  return (
    <figure className="mb-8 max-w-4xl">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-light aspect-[1200/630]">
        <img
          src={imageUrl}
          alt={alt}
          title={title || undefined}
          width={1200}
          height={630}
          className={`w-full h-full object-cover ${isPlaceholder ? "opacity-80" : ""}`}
          loading={priority ? "eager" : "lazy"}
          {...(priority ? { fetchPriority: "high" as const } : {})}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
