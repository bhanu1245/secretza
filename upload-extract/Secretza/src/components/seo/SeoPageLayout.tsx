// ==========================================
// SEO Page Layout — Server Component
// ==========================================
// Renders the complete SEO page layout matching the dark theme.
// Used by all SEO page routes.

import Link from "next/link";
import { ShieldCheck, Clock, MapPin, Tag, Search, TrendingUp, Link2 } from "lucide-react";
import Header from "@/components/secretza/layout/Header";
import Footer from "@/components/secretza/layout/Footer";
import { Badge } from "@/components/ui/badge";
import type { SEOContent } from "@/lib/seo-content";

// ------------------------------------------
// Props
// ------------------------------------------

export interface SeoListing {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: string | null;
  citySlug: string;
  cityName: string;
  categorySlug: string;
  categoryName: string;
  images: string[];
  isFeatured: boolean;
  isBoosted: boolean;
  createdAt: string;
}

export interface SeoPageLayoutProps {
  seo: SEOContent;
  listings: SeoListing[];
  structuredData: Record<string, unknown>[];
  canonicalUrl: string;
  noindex?: boolean;
  totalListings?: number;
  children?: React.ReactNode;
}

// ------------------------------------------
// Component
// ------------------------------------------

export default function SeoPageLayout({
  seo,
  listings,
  structuredData,
  canonicalUrl,
  noindex = false,
  totalListings,
  children,
}: SeoPageLayoutProps) {
  const cityLinks = seo.internalLinks.filter((l) => l.type === "city");
  const categoryLinks = seo.internalLinks.filter((l) => l.type === "category");
  const searchLinks = seo.internalLinks.filter((l) => l.type === "search");
  const currentCityName = seo.breadcrumbItems[seo.breadcrumbItems.length - 1]?.name ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <link rel="preconnect" href="https://secretza.com" />
      {/* Noindex meta */}
      {noindex && (
        <title>{seo.title}</title>
      )}

      <Header />

      <main className="flex-1 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumbs */}
          {seo.breadcrumbItems.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
                {seo.breadcrumbItems.map((item, index) => (
                  <li key={item.url} className="flex items-center gap-1.5">
                    {index > 0 && (
                      <span className="text-muted-foreground/40" aria-hidden="true">/</span>
                    )}
                    {index === seo.breadcrumbItems.length - 1 ? (
                      <span className="text-foreground font-medium" aria-current="page">
                        {item.name}
                      </span>
                    ) : (
                      <Link
                        href={item.url}
                        className="hover:text-foreground transition-colors"
                      >
                        {item.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* H1 Heading */}
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {seo.h1}
          </h1>

          {/* Freshness Signal */}
          {seo.lastUpdated && (
            <p className="text-xs text-muted-foreground mb-4">
              <Clock className="w-3.5 h-3.5 inline-block mr-1 opacity-60" />
              Last updated: {seo.lastUpdated}
            </p>
          )}

          {/* Author / Editor Info */}
          {seo.authorInfo && (
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-violet/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <span>
                <span className="text-foreground font-medium">{seo.authorInfo.name}</span>
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                {seo.authorInfo.role}
              </span>
            </div>
          )}

          {/* Listings Count Badge */}
          {totalListings !== undefined && (
            <div className="mb-4">
              <Badge
                variant="secondary"
                className="bg-violet/10 text-violet border-violet/20 text-xs font-medium px-3 py-1"
              >
                {totalListings.toLocaleString()} listings available
              </Badge>
            </div>
          )}

          {/* Intro Paragraph */}
          <p className="text-muted-foreground leading-relaxed mb-2 max-w-4xl">
            {seo.introParagraph}
          </p>

          {/* Secondary Paragraph */}
          {seo.secondaryParagraph && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 mt-4">
              {seo.secondaryParagraph}
            </p>
          )}

          {/* Trust & Safety */}
          <section className="mb-8 p-4 rounded-xl bg-surface-light/50 border border-violet/20" aria-label="Trust & Safety">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-violet mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Verified & Safe Platform</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All listings are verified. Report suspicious activity. Communicate through the platform.
                </p>
              </div>
            </div>
          </section>

          {/* Trending Searches */}
          {seo.trendingSearches && seo.trendingSearches.length > 0 && (
            <section className="mb-8" aria-label="Trending Searches">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet" />
                Trending Searches in {currentCityName || "India"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {seo.trendingSearches.map((search) => (
                  <Link
                    key={search}
                    href={`/search?q=${encodeURIComponent(search)}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-muted-foreground hover:text-violet hover:border-violet/30 transition-colors"
                  >
                    <Search className="w-3 h-3 inline-block mr-1 opacity-60" />
                    {search}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Popular Searches */}
          {seo.popularSearches && seo.popularSearches.length > 0 && (
            <section className="mb-8" aria-label="Popular Searches">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-violet" />
                Popular Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {seo.popularSearches.map((search) => (
                  <Link
                    key={search}
                    href={`/search?q=${encodeURIComponent(search)}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-muted-foreground hover:text-violet hover:border-violet/30 transition-colors"
                  >
                    {search}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* City Highlights */}
          {seo.cityHighlights && seo.cityHighlights.length > 0 && (
            <section className="mb-8" aria-label="Popular Areas">
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Popular Areas in {currentCityName}
              </h2>
              <div className="flex flex-wrap gap-2">
                {seo.cityHighlights.slice(0, 12).map((highlight) => (
                  <Link
                    key={highlight}
                    href="#"
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-violet/30 transition-colors"
                  >
                    {highlight}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Canonical URL meta (visible for debugging but not rendered) */}
          <link rel="canonical" href={canonicalUrl} />

          {/* Listings Grid */}
          {listings.length > 0 && (
            <section className="mb-12" aria-label="Listings">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  Latest Listings
                </h2>
                {seo.lastUpdated && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {listings.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} isAboveFold={index === 0} />
                ))}
              </div>
            </section>
          )}

          {/* FAQ Section */}
          {seo.faqs.length > 0 && (
            <section className="mb-12" aria-label="Frequently Asked Questions">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Frequently Asked Questions
              </h2>
              <div className="space-y-2">
                {seo.faqs.map((faq, index) => (
                  <details
                    key={index}
                    name={`faq-${index}`}
                    className="group rounded-lg border border-border bg-surface overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:bg-surface-light transition-colors select-none">
                      <span className="pr-4">{faq.question}</span>
                      <svg
                        className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border">
                      <p className="pt-3">{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Page-Specific Extra Content */}
          {children}

          {/* Related Pages */}
          {seo.relatedPages && seo.relatedPages.length > 0 && (
            <section className="mb-8" aria-label="Related Pages">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-violet" />
                Related Pages
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {seo.relatedPages.map((page) => (
                  <Link
                    key={page.url}
                    href={page.url}
                    className="px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet/30 hover:bg-surface-light transition-all duration-200 truncate"
                  >
                    {page.title}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Internal Links — Explore More */}
          <section className="mt-12 mb-8" aria-label="Explore More">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Explore More on Secretza
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Nearby Cities */}
              {cityLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-violet" />
                    Nearby Cities
                  </h3>
                  <ul className="space-y-2">
                    {cityLinks.map((link) => (
                      <li key={link.url}>
                        <Link href={link.url} className="text-sm text-muted-foreground hover:text-violet transition-colors">
                          {link.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Category Links */}
              {categoryLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-violet" />
                    Popular Categories
                  </h3>
                  <ul className="space-y-2">
                    {categoryLinks.map((link) => (
                      <li key={link.url}>
                        <Link href={link.url} className="text-sm text-muted-foreground hover:text-violet transition-colors">
                          {link.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Popular Searches */}
              {searchLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-violet" />
                    Popular Searches
                  </h3>
                  <ul className="space-y-2">
                    {searchLinks.map((link) => (
                      <li key={link.url}>
                        <Link href={link.url} className="text-sm text-muted-foreground hover:text-violet transition-colors">
                          {link.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />

      {/* Structured Data */}
      {structuredData.map((schema, index) => (
        <script
          key={`json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

    </div>
  );
}

// ------------------------------------------
// Listing Card Sub-Component
// ------------------------------------------

function ListingCard({ listing, isAboveFold = false }: { listing: SeoListing; isAboveFold?: boolean }) {
  const hasImage = listing.images.length > 0;
  const imageUrl = hasImage ? listing.images[0] : null;

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="group block rounded-xl border border-border bg-surface overflow-hidden hover:border-violet/30 hover:shadow-lg hover:shadow-violet/5 transition-all duration-200"
    >
      {/* Image / Placeholder */}
      <div className="aspect-video bg-surface-light relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            width={640}
            height={360}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading={isAboveFold ? "eager" : "lazy"}
            {...(isAboveFold ? { fetchPriority: "high" as const } : {})}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-muted-foreground/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {listing.isFeatured && (
            <Badge className="bg-violet text-white text-[10px] px-1.5 py-0.5 font-semibold border-0">
              Featured
            </Badge>
          )}
          {listing.isBoosted && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-semibold border-0">
              Boosted
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground truncate mb-1 group-hover:text-violet transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-violet/20 text-violet/80 font-normal"
          >
            {listing.categoryName}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {listing.cityName}
          </span>
        </div>
        {listing.price && (
          <p className="text-sm font-semibold text-foreground">
            {listing.price}
          </p>
        )}
      </div>
    </Link>
  );
}
