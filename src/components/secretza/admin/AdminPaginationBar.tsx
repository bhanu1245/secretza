"use client";

type AdminPaginationBarProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  disabled?: boolean;
};

export default function AdminPaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
  disabled = false,
}: AdminPaginationBarProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.06)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-sm text-[#A1A1AA]">
        <span>
          Page {page} of {totalPages} ({total} total)
        </span>
        {onLimitChange && (
          <label className="flex items-center gap-2 text-xs">
            Per page
            <select
              value={limit}
              disabled={disabled}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-[#0B0B0F] px-2 py-1 text-xs text-[#F5F5F7] outline-none"
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#A1A1AA] disabled:opacity-40 hover:bg-white/[0.04]"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#A1A1AA] disabled:opacity-40 hover:bg-white/[0.04]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
