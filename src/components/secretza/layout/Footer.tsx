"use client";

import {
  Globe,
  Twitter,
  Instagram,
  Youtube,
  Heart,
  MessageCircle,
  Star,
  Users,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useNavigationStore } from "@/store/useAppStore";

const browseCategories = [
  { name: "Escorts", slug: "escorts" },
  { name: "Massage", slug: "massage" },
  { name: "Dating", slug: "dating" },
  { name: "Trans", slug: "trans" },
  { name: "Male Escorts", slug: "male-escorts" },
  { name: "Couples", slug: "couples" },
];

const topLocations = [
  { name: "Mumbai", href: "/mumbai" },
  { name: "Delhi", href: "/delhi" },
  { name: "Bangalore", href: "/bangalore" },
  { name: "Hyderabad", href: "/hyderabad" },
  { name: "Chennai", href: "/chennai" },
  { name: "Kolkata", href: "/kolkata" },
];

const companyLinks = [
  { label: "About", action: "about" },
  { label: "Terms", action: "terms" },
  { label: "Privacy Policy", action: "privacy" },
  { label: "Contact", action: "contact" },
  { label: "DMCA", action: "dmca" },
  { label: "Safety Tips", action: "safety" },
  { label: "Advertise", action: "advertise" },
];

const socialLinks = [
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Youtube, label: "YouTube", href: "#" },
  { icon: Globe, label: "Website", href: "#" },
];

export default function Footer() {
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <footer className="bg-surface border-t border-border mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-violet">
                <span className="text-white font-bold text-lg leading-none select-none">
                  S
                </span>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">
                Secretza
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-[250px]">
              Premium Adult Classifieds Worldwide. Connecting people safely and
              discreetly since 2024.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-light text-muted-foreground hover:text-foreground hover:bg-violet/20 hover:text-violet transition-all duration-200"
                >
                  <social.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Browse Column */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Browse
            </h3>
            <ul className="space-y-2.5">
              {browseCategories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/${cat.slug}`}
                    className="text-sm text-muted-foreground hover:text-violet transition-colors duration-200"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Locations Column */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Locations
            </h3>
            <ul className="space-y-2.5">
              {topLocations.map((loc) => (
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

          {/* Company Column */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Company
            </h3>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.action}>
                  <button
                    onClick={() => navigate("home")}
                    className="text-sm text-muted-foreground hover:text-violet transition-colors duration-200"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <Separator className="bg-border" />
        <div className="py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Secretza. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-warning" />
            <span>
              18+ Only &mdash; This site contains adult content. By using this
              site, you confirm you are at least 18 years old.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
