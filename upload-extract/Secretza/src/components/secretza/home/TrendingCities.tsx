"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTrendingCities } from "@/hooks/useApiData";
import { useNavigationStore } from "@/store/useAppStore";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function TrendingCities() {
  const navigate = useNavigationStore((s) => s.navigate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cities: trendingCities, loading } = useTrendingCities();

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 280;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleCityClick = (city: (typeof trendingCities)[number]) => {
    navigate("location", {
      country: city.country.slug,
      state: city.state.slug,
      city: city.slug,
    });
  };

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-8 sm:mb-10">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Trending Cities
          </h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Popular destinations with the most listings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scroll controls - only on mobile */}
          <button
            onClick={() => scroll("left")}
            className="lg:hidden flex items-center justify-center size-9 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-violet/40 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="lg:hidden flex items-center justify-center size-9 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-violet/40 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => navigate("search")}
            className="text-violet hover:text-violet-hover text-sm font-medium flex items-center gap-1 transition-colors"
          >
            View All
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Cities - Horizontal scroll on mobile, grid on desktop */}
      {loading && trendingCities.length === 0 ? (
        <div className="flex lg:grid lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[240px] sm:w-[260px] lg:w-auto rounded-xl bg-surface border border-border overflow-hidden animate-pulse">
              <div className="p-4 sm:p-5">
                <div className="size-10 rounded-lg bg-muted mb-3" />
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <motion.div
        className="flex lg:grid lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-none snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0"
        ref={scrollRef}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {trendingCities.map((city) => (
          <motion.button
            key={city.id}
            variants={cardVariants}
            onClick={() => handleCityClick(city)}
            className="card-hover group relative flex-shrink-0 w-[240px] sm:w-[260px] lg:w-auto snap-start rounded-xl bg-surface border border-border overflow-hidden text-left cursor-pointer"
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative p-4 sm:p-5">
              {/* City icon */}
              <div className="flex items-center justify-center size-10 rounded-lg bg-violet/10 mb-3">
                <MapPin className="size-5 text-violet" />
              </div>

              {/* City name */}
              <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-violet transition-colors leading-tight">
                {city.name}
              </h3>

              {/* State & Country */}
              <p className="text-sm text-muted-foreground mt-1">
                {city.state.name}, {city.country.name}
              </p>

              {/* Listing count */}
              <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-violet bg-violet/10 px-2.5 py-1 rounded-md">
                {city.listingCount.toLocaleString()} listings
              </span>
            </div>
          </motion.button>
        ))}
      </motion.div>
      )}
    </section>
  );
}
