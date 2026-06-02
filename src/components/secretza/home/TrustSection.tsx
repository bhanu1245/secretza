"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Eye, Star, type LucideIcon } from "lucide-react";
import BrandWordmark from "@/components/brand/BrandWordmark";

interface TrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const trustItems: TrustItem[] = [
  {
    icon: Shield,
    title: "Verified Profiles",
    description: "All advertisers go through our verification process",
  },
  {
    icon: Lock,
    title: "Complete Privacy",
    description: "Your identity and activity are always protected",
  },
  {
    icon: Eye,
    title: "AI Moderation",
    description: "24/7 automated content review for safety",
  },
  {
    icon: Star,
    title: "Premium Quality",
    description: "Only the highest quality listings on our platform",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function TrustSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section heading */}
      <motion.div
        className="text-center mb-10 sm:mb-14"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          Why Choose <BrandWordmark theme="dark" className="inline" />?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl mx-auto">
          We&apos;re committed to providing a safe, private, and premium experience
        </p>
      </motion.div>

      {/* Trust Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {trustItems.map((item) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.title}
              variants={cardVariants}
              className="relative flex flex-col items-center text-center p-6 sm:p-8 rounded-xl bg-surface border border-border group hover:border-violet/20 transition-colors"
            >
              {/* Icon */}
              <div className="flex items-center justify-center size-14 rounded-xl bg-violet/10 mb-4 group-hover:bg-violet/15 transition-colors">
                <Icon className="size-7 text-violet" />
              </div>

              {/* Title */}
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
