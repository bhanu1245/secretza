const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
}

/** Compact revenue display for stat cards (e.g. ₹1.5K). */
export function formatRevenueCompact(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toLocaleString("en-IN")}`;
}

/** Y-axis tick labels for the revenue chart (e.g. ₹2k). */
export function formatRevenueAxisTick(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(0)}k`;
  return `${symbol}${value}`;
}

/** Full amount for chart tooltips. */
export function formatRevenueAmount(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString("en-IN")}`;
}
