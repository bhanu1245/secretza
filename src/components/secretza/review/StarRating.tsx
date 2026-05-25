"use client";

import { useState, useCallback } from "react";
import { Star, StarHalf } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
} as const;

const textSizeMap = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export default function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onChange,
  showValue = false,
  className,
}: StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const activeStars = hoveredStar !== null ? hoveredStar : rating;

  const handleClick = useCallback(
    (starIndex: number) => {
      if (interactive && onChange) {
        onChange(starIndex);
      }
    },
    [interactive, onChange]
  );

  const handleMouseEnter = useCallback(
    (starIndex: number) => {
      if (interactive) {
        setHoveredStar(starIndex);
      }
    },
    [interactive]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredStar(null);
  }, []);

  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    // Support half-star display
    const diff = activeStars - i;
    const isFilled = diff >= 0;
    const isHalf = diff >= -0.5 && diff < 0;
    const isEmpty = !isFilled && !isHalf;

    stars.push(
      <motion.button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => handleClick(i)}
        onMouseEnter={() => handleMouseEnter(i)}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "relative inline-flex items-center justify-center",
          interactive
            ? "cursor-pointer transition-transform"
            : "cursor-default pointer-events-none"
        )}
        whileHover={interactive ? { scale: 1.2 } : undefined}
        whileTap={interactive ? { scale: 0.9 } : undefined}
      >
        {/* Empty star (background) */}
        <Star
          className={cn(
            sizeMap[size],
            "text-[#3F3F46]",
            (isFilled || isHalf) && "absolute"
          )}
        />
        {/* Filled star */}
        {(isFilled || isHalf) && (
          <div className="relative">
            <Star
              className={cn(
                sizeMap[size],
                isFilled ? "text-amber-400" : "text-amber-400/50",
                isHalf && "absolute inset-0 clip-path-half"
              )}
              fill="currentColor"
              style={
                isHalf
                  ? {
                      clipPath: "inset(0 50% 0 0)",
                    }
                  : undefined
              }
            />
          </div>
        )}
      </motion.button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">{stars}</div>
      {showValue && (
        <span
          className={cn(
            "ml-1 font-semibold text-[#F5F5F7]",
            textSizeMap[size]
          )}
        >
          {rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
