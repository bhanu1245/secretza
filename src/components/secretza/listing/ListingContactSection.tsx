"use client";

import { useState } from "react";
import { Globe, Instagram, Mail, MessageSquare, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContactInfo } from "@/lib/types";
import {
  buildTelegramUrl,
  buildWhatsAppUrl,
  hasContactInfo,
} from "@/lib/listing-contact";

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

  async function revealContact() {
    if (!listingId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}/contact`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Unable to load contact information");
        return;
      }

      setContact(data.contact || {});
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
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
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
