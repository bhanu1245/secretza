"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, TrendingUp, MapPin, Users, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useLocations } from "@/hooks/useApiData";
import { useNavigationStore, useSearchStore } from "@/store/useAppStore";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HeroSection() {
  const [keyword, setKeyword] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>("all");
  const [countrySlug, setCountrySlug] = useState<string>("all");
  const navigate = useNavigationStore((s) => s.navigate);
  const setFilters = useSearchStore((s) => s.setFilters);

  // Fetch categories and countries from API
  const { categories } = useCategories();
  const { countries } = useLocations();

  const handleSearch = () => {
    setFilters({
      keyword: keyword || undefined,
      categorySlug: categorySlug !== "all" ? categorySlug : undefined,
      countrySlug: countrySlug !== "all" ? countrySlug : undefined,
    });
    navigate("search", {
      keyword: keyword || "",
      category: categorySlug !== "all" ? categorySlug : "",
      country: countrySlug !== "all" ? countrySlug : "",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const featuredCategories = categories.filter((c) => c.isFeatured);

  return (
    <section className="relative w-full hero-gradient overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-violet/5 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 sm:pb-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Heading */}
        <motion.div variants={itemVariants} className="text-center mb-8 sm:mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Discover{" "}
            <span className="text-violet violet-text-glow">Premium</span>
            <br className="hidden sm:block" /> Adult Classifieds
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Worldwide discreet listings. Verified advertisers. Complete privacy.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          variants={itemVariants}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className="glass rounded-xl border border-border p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              {/* Keyword input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search escorts, massage, dating..."
                  className="pl-10 h-12 sm:h-14 bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 text-base rounded-lg"
                />
              </div>

              {/* Category dropdown */}
              <Select value={categorySlug} onValueChange={setCategorySlug}>
                <SelectTrigger className="h-12 sm:h-14 w-full sm:w-[180px] bg-transparent border-0 focus:ring-0 focus-visible:ring-0 rounded-lg sm:border-l sm:border-border sm:ml-2">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {featuredCategories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Location dropdown */}
              <Select value={countrySlug} onValueChange={setCountrySlug}>
                <SelectTrigger className="h-12 sm:h-14 w-full sm:w-[180px] bg-transparent border-0 focus:ring-0 focus-visible:ring-0 rounded-lg sm:border-l sm:border-border sm:ml-2">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.slug} value={country.slug}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search button */}
              <Button
                onClick={handleSearch}
                className="h-12 sm:h-14 w-full sm:w-auto sm:ml-2 gradient-violet text-white font-semibold rounded-lg text-base hover:opacity-90 transition-opacity"
              >
                <Search className="size-5" />
                <span className="sm:hidden">Search</span>
                <span className="hidden sm:inline">Search Now</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16"
        >
          <Button
            onClick={handleSearch}
            size="lg"
            className="gradient-violet text-white font-semibold px-8 h-12 rounded-lg text-base hover:opacity-90 transition-opacity"
          >
            <Search className="size-5" />
            Search Now
          </Button>
          <Button
            onClick={() => navigate("post-ad")}
            variant="outline"
            size="lg"
            className="border-violet/40 text-violet hover:bg-violet/10 hover:text-violet font-semibold px-8 h-12 rounded-lg text-base"
          >
            <Plus className="size-5" />
            Post Free Ad
          </Button>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          variants={itemVariants}
          className="max-w-3xl mx-auto"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: "Listings", value: "10K+" },
              { icon: MapPin, label: "Countries", value: "8" },
              { icon: Users, label: "Cities", value: "50+" },
              { icon: ShieldCheck, label: "Verified", value: "Advertisers" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-3 rounded-xl bg-surface/50 border border-border"
              >
                <stat.icon className="size-5 text-violet mb-1.5" />
                <span className="text-lg sm:text-xl font-bold text-foreground">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
