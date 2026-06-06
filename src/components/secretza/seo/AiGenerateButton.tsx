"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface AiGenerateButtonProps {
  /** Async action that performs the AI request. Errors are surfaced by the caller. */
  onGenerate: () => Promise<void>;
  label: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/**
 * Shared AI action button. Manages its own loading state and prevents
 * double-submits; the parent owns the actual generation + analytics tracking.
 */
export default function AiGenerateButton({
  onGenerate,
  label,
  disabled = false,
  title,
  className = "",
}: AiGenerateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onGenerate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-2.5 py-1 text-xs font-medium text-[#C4B5FD] transition-colors hover:bg-[#7C3AED]/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
