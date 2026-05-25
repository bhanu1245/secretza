"use client";

import { motion } from "framer-motion";
import {
  Heart,
  Sparkles,
  Flame,
  Star,
  User,
  HeartHandshake,
  Briefcase,
  Gem,
  Camera,
  Phone,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useCategories } from "@/hooks/useApiData";
import { useNavigationStore } from "@/store/useAppStore";

// Map category icon strings to Lucide components
const iconMap: Record<string, LucideIcon> = {
  Heart,
  Sparkles,
  Flame,
  Star,
  User,
  HeartHandshake,
  Briefcase,
  Gem,
  Camera,
  Phone,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function CategoryGrid() {
  const navigate = useNavigationStore((s) => s.navigate);
  const { categories, loading } = useCategories();
  const featuredCategories = categories.filter((c) => c.isFeatured && c.isActive);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-8 sm:mb-10">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Browse Categories
          </h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Find exactly what you&apos;re looking for
          </p>
        </div>
        <button
          onClick={() => navigate("search")}
          className="text-violet hover:text-violet-hover text-sm font-medium flex items-center gap-1 transition-colors"
        >
          View All
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Category Grid */}
      {loading && featuredCategories.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface border border-border p-4 sm:p-5 animate-pulse">
              <div className="size-10 sm:size-12 rounded-lg bg-muted mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {featuredCategories.map((category) => {
          const IconComponent = iconMap[category.icon] || Heart;

          return (
            <motion.button
              key={category.id}
              variants={cardVariants}
              onClick={() =>
                navigate("category", { slug: category.slug })
              }
              className="card-hover group relative flex flex-col items-start gap-3 rounded-xl bg-surface border border-border p-4 sm:p-5 text-left cursor-pointer"
              style={{ borderLeftWidth: "3px", borderLeftColor: category.color }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center size-10 sm:size-12 rounded-lg transition-colors"
                style={{ backgroundColor: `${category.color}15` }}
              >
                <IconComponent
                  className="size-5 sm:size-6 transition-colors"
                  style={{ color: category.color }}
                />
              </div>

              {/* Name */}
              <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-violet transition-colors leading-tight">
                {category.name}
              </h3>

              {/* Count badge */}
              <span className="text-xs text-muted-foreground bg-surface-light px-2 py-0.5 rounded-md">
                {category.listingCount.toLocaleString()} listings
              </span>
            </motion.button>
          );
        })}
      </motion.div>
      )}
    </section>
  );
}
