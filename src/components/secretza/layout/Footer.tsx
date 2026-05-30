"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Twitter,
  Instagram,
  Youtube,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  FOOTER_BROWSE_LINKS,
  FOOTER_COMPANY_LINKS,
  FOOTER_LOCATION_LINKS,
} from "@/lib/footer-routes";

type SocialLinks = {
  twitter: string;
  instagram: string;
  youtube: string;
  website: string;
};

const socialIcons = [
  { key: "twitter" as const, icon: Twitter, label: "Twitter" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram" },
  { key: "youtube" as const, icon: Youtube, label: "YouTube" },
  { key: "website" as const, icon: Globe, label: "Website" },
];

export default function Footer() {
  const [social, setSocial] = useState<SocialLinks | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.social) setSocial(data.social);
      })
      .catch(() => {
        /* defaults omitted — icons hidden until loaded */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="bg-surface border-t border-border mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-violet">
                <span className="text-white font-bold text-lg leading-none select-none">S</span>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Secretza</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[250px]">
              Premium Adult Classifieds Worldwide. Connecting people safely and discreetly since 2024.
            </p>
            {social && (
              <div className="flex items-center gap-2">
                {socialIcons.map(({ key, icon: Icon, label }) => {
                  const href = social[key];
                  if (!href || href === "#") return null;
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-light text-muted-foreground hover:text-foreground hover:bg-violet/20 hover:text-violet transition-all duration-200"
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Browse</h3>
            <ul className="space-y-2.5">
              {FOOTER_BROWSE_LINKS.map((cat) => (
                <li key={cat.href}>
                  <Link
                    href={cat.href}
                    className="text-sm text-muted-foreground hover:text-violet transition-colors duration-200"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Locations</h3>
            <ul className="space-y-2.5">
              {FOOTER_LOCATION_LINKS.map((loc) => (
                <li key={loc.href}>
                  <Link
                    href={loc.href}
                    className="text-sm text-muted-foreground hover:text-violet transition-colors duration-200"
                  >
                    {loc.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2.5">
              {FOOTER_COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-violet transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-border" />
        <div className="py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Secretza. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-warning" />
            <span>
              18+ Only &mdash; This site contains adult content. By using this site, you confirm you are at least 18 years old.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
