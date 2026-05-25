"use client";

import { useEffect, useState } from "react";

function computeTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface TimeAgoProps {
  date: string;
  className?: string;
}

export default function TimeAgo({ date, className }: TimeAgoProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () => setText(computeTimeAgo(date));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [date]);

  // Before mount (server render), show nothing to avoid hydration mismatch.
  // After mount, the effect has set the real text.
  if (text === "") {
    return <span className={className}>-</span>;
  }

  return <span className={className}>{text}</span>;
}
