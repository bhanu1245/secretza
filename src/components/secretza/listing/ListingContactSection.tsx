"use client";

import { useState } from "react";
import { Globe, Instagram, Mail, MessageSquare, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ContactInfo } from "@/lib/types";
import {
  buildTelegramUrl,
  buildWhatsAppUrl,
  hasContactInfo,
} from "@/lib/listing-contact";
import { useTrackEvent } from "@/components/providers/AnalyticsProvider";
import { useAuthStore } from "@/store/useAppStore";

type ContactAccessBlock = "guest" | "unverified" | null;

type ListingContactSectionProps = {
  listingId?: string;
  contact?: ContactInfo;
  title?: string;
  className?: string;
};

function openContact(type: keyof ContactInfo, value: string) {
  switch (type) {
    case "email":
      window.open(`mailto:${value}`, "_blank");
      break;
    case "telegram": {
      const url = buildTelegramUrl(value);
      if (url) window.open(url, "_blank");
      break;
    }
    case "whatsapp": {
      const url = buildWhatsAppUrl(value);
      if (url) window.open(url, "_blank");
      break;
    }
    case "phone":
      window.open(`tel:${value}`, "_self");
      break;
    case "instagram":
      window.open(`https://instagram.com/${value.replace(/^@+/, "")}`, "_blank");
      break;
    case "website":
      window.open(value.startsWith("http") ? value : `https://${value}`, "_blank");
      break;
    default:
      break;
  }
}

export default function ListingContactSection({
  listingId,
  contact: initialContact = {},
  title = "Contact Information",
  className = "",
}: ListingContactSectionProps) {
  const [contact, setContact] = useState<ContactInfo>(initialContact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessBlock, setAccessBlock] = useState<ContactAccessBlock>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const trackEvent = useTrackEvent();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isVerified = useAuthStore((s) => s.user?.isVerified ?? false);

  function openLogin() {
    const { setAuthModalOpen, setAuthModalTab } = useAuthStore.getState();
    setAuthModalTab("login");
    setAuthModalOpen(true);
  }

  async function handleVerifyEmail() {
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Verification email sent!", { description: data.message });
        setVerifySent(true);
      } else {
        toast.error("Failed to send", { description: data.error || "Please try again." });
      }
    } catch {
      toast.error("Failed to send", { description: "Network error." });
    } finally {
      setVerifying(false);
    }
  }

  async function revealContact() {
    if (!listingId) return;

    setLoading(true);
    setError(null);
    setAccessBlock(null);

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}/contact`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setAccessBlock("guest");
          setError("Login to view contact information");
          return;
        }

        const apiError = typeof data.error === "string" ? data.error : "";
        const isVerificationError =
          response.status === 403 &&
          (apiError.toLowerCase().includes("verification") ||
            (!isVerified && isAuthenticated));

        if (isVerificationError) {
          setAccessBlock("unverified");
          setError("Verify your email to view contact information");
          return;
        }

        setError(apiError || "Unable to load contact information");
        return;
      }

      setContact(data.contact || {});
      // Fire only after a confirmed successful reveal.
      trackEvent("contact_reveal", { listing_id: listingId });
    } catch {
      setError("Unable to load contact information");
    } finally {
      setLoading(false);
    }
  }

  if (!hasContactInfo(contact)) {
    if (!listingId) return null;

    return (
      <div className={`rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5 ${className}`}>
        <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
        <Button
          className="w-full bg-violet text-white hover:bg-violet/90"
          onClick={revealContact}
          disabled={loading}
        >
          {loading ? "Loading contact..." : "Show Contact Information"}
        </Button>
        {error && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-amber-400">{error}</p>
            {accessBlock === "guest" && (
              <Button
                className="w-full bg-violet text-white hover:bg-violet/90"
                onClick={openLogin}
              >
                Login
              </Button>
            )}
            {accessBlock === "unverified" && (
              <Button
                className="w-full border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
                onClick={handleVerifyEmail}
                disabled={verifying || verifySent}
              >
                {verifying ? "Sending..." : verifySent ? "Email sent" : "Verify Email"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[rgba(255,255,255,0.08)] bg-surface p-5 ${className}`}>
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2">
        {contact.whatsapp && (
          <Button
            className="w-full justify-start gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => openContact("whatsapp", contact.whatsapp!)}
          >
            <MessageSquare className="size-4" />
            WhatsApp: {contact.whatsapp}
          </Button>
        )}
        {contact.telegram && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-foreground hover:bg-[#229ED9]/10 hover:text-[#229ED9] hover:border-[#229ED9]/30"
            onClick={() => openContact("telegram", contact.telegram!)}
          >
            <Send className="size-4" />
            Telegram: @{contact.telegram.replace(/^@+/, "")}
          </Button>
        )}
        {contact.phone && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-foreground hover:bg-violet/10 hover:text-violet hover:border-violet/30"
            onClick={() => openContact("phone", contact.phone!)}
          >
            <Phone className="size-4" />
            {contact.phone}
          </Button>
        )}
        {contact.email && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-foreground hover:bg-violet/10 hover:text-violet hover:border-violet/30"
            onClick={() => openContact("email", contact.email!)}
          >
            <Mail className="size-4" />
            {contact.email}
          </Button>
        )}
        {contact.instagram && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-foreground hover:bg-[#E4405F]/10 hover:text-[#E4405F] hover:border-[#E4405F]/30"
            onClick={() => openContact("instagram", contact.instagram!)}
          >
            <Instagram className="size-4" />
            {contact.instagram}
          </Button>
        )}
        {contact.website && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-foreground hover:bg-violet/10 hover:text-violet hover:border-violet/30"
            onClick={() => openContact("website", contact.website!)}
          >
            <Globe className="size-4" />
            {contact.website}
          </Button>
        )}
        {contact.customText && (
          <div className="flex items-start gap-2 rounded-lg bg-[#1E1E2A] p-3">
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-violet" />
            <span className="text-sm text-foreground/80">{contact.customText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
