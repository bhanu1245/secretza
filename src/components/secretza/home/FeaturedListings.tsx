"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListings } from "@/hooks/useApiData";
import { useNavigationStore } from "@/store/useAppStore";
import ListingCard from "../listing/ListingCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function FeaturedListings() {
  const navigate = useNavigationStore((s) => s.navigate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { listings: featuredListings, loading } = useListings({ featured: true, limit: 8 });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-8 sm:mb-10">
        <div className="flex items-center gap-3">
          {/* Violet accent bar */}
          <div className="w-1 h-8 rounded-full gradient-violet" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Featured Listings
            </h2>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Top advertisers you can trust
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex items-center justify-center size-9 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-violet/40 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex items-center justify-center size-9 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-violet/40 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <Button
            onClick={() => navigate("search", { featured: "true" })}
            variant="ghost"
            className="text-violet hover:text-violet-hover hover:bg-violet/10 font-medium"
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Carousel / Grid */}
      <div className="relative">
        {loading && featuredListings.length === 0 ? (
          <div className="flex lg:grid lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[280px] sm:w-[300px] lg:w-auto animate-pulse">
                <div className="rounded-xl bg-surface border border-border overflow-hidden">
                  <div className="aspect-[3/4] bg-muted" />
                  <div className="p-3">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <motion.div
          className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto pb-4 lg:pb-0 scrollbar-none snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0"
          ref={scrollRef}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {featuredListings.map((listing) => (
            <motion.div
              key={listing.id}
              variants={cardVariants}
              className="flex-shrink-0 w-[280px] sm:w-[300px] lg:w-auto snap-start"
            >
              <ListingCard listing={listing} />
            </motion.div>
          ))}
        </motion.div>
        )}

        {/* Mobile scroll indicators */}
        <div className="flex md:hidden justify-center gap-2 mt-4">
          <button
            onClick={() => scroll("left")}
            className="flex items-center justify-center size-10 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex items-center justify-center size-10 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
