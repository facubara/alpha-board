"use client";

/** Shared pagination footer for data tables. */
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = totalItems === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-void-border pt-4 mt-4 text-xs font-mono text-text-secondary">
      {/* Left: Showing X–Y of Z */}
      <span className="font-mono tabular-nums">
        Showing {start}–{end} of {totalItems}
      </span>

      {/* Right: page size + prev/next */}
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            onPageSizeChange(newSize);
            onPageChange(0);
          }}
          className="rounded-none border border-void-border bg-void-surface px-1.5 py-0.5 text-xs text-text-secondary"
          aria-label="Rows per page"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} / page
            </option>
          ))}
          <option value={totalItems}>All</option>
        </select>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="rounded-none p-1 transition-colors hover:text-terminal-amber cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center tabular-nums">
            {totalPages === 0 ? "0 / 0" : `${page + 1} / ${totalPages}`}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="rounded-none p-1 transition-colors hover:text-terminal-amber cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
