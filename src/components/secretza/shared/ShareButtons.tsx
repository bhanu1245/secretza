"use client";

import { useCallback, useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildShareUrl, type SharePlatform } from "@/lib/share-links";

type ShareButtonsProps = {
  url: string;
  title: string;
  className?: string;
  /** Show "Share" label heading */
  showLabel?: boolean;
};

const PLATFORMS: {
  id: Exclude<SharePlatform, "copy">;
  label: string;
  className: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    className: "hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 2C6.486 2 2 6.486 2 12c0 1.77.465 3.43 1.277 4.873L2 22l5.247-1.262A9.96 9.96 0 0012 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm0 18.182a8.17 8.17 0 01-4.173-1.145l-.3-.178-3.11.748.788-3.035-.195-.31A8.168 8.168 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8.182z" />
      </svg>
    ),
  },
  {
    id: "telegram",
    label: "Telegram",
    className: "hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/30",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    className: "hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "X",
    className: "hover:bg-foreground/10 hover:text-foreground hover:border-foreground/20",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export default function ShareButtons({
  url,
  title,
  className,
  showLabel = true,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const openShare = useCallback(
    (platform: Exclude<SharePlatform, "copy">) => {
      const shareUrl = buildShareUrl(platform, url, title);
      window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    },
    [url, title]
  );

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: "Share URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed", { description: "Could not copy link to clipboard." });
    }
  }, [url]);

  const tryNativeShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
  }, [title, url]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showLabel && (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Share2 className="size-4" />
          <span>Share</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {PLATFORMS.map(({ id, label, className: platformClass, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => openShare(id)}
            aria-label={`Share on ${label}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-colors",
              "min-h-[40px] min-w-[40px] justify-center sm:justify-start",
              platformClass
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-colors",
            "min-h-[40px] min-w-[40px] justify-center sm:justify-start",
            "hover:bg-violet/20 hover:text-violet hover:border-violet/30"
          )}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
        </button>
        <button
          type="button"
          onClick={tryNativeShare}
          aria-label="Share via device"
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-colors md:hidden",
            "min-h-[40px] min-w-[40px] justify-center",
            "hover:bg-violet/20 hover:text-violet hover:border-violet/30"
          )}
        >
          <Share2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
