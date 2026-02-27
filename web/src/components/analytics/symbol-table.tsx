"use client";

/**
 * SymbolTable — Per-symbol statistics with client-side sortable columns.
 */

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SymbolStats } from "@/lib/types";

type SortKey = "symbol" | "tradeCount" | "winRate" | "totalPnl" | "avgPnl" | "totalFees";

interface SymbolTableProps {
  data: SymbolStats[];
}

export function SymbolTable({ data }: SymbolTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("tradeCount");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Reset page on sort change
  useEffect(() => { setPage(0); }, [sortKey, sortAsc]);

  const sorted = [...data].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "symbol") return dir * a.symbol.localeCompare(b.symbol);
    return dir * (a[sortKey] - b[sortKey]);
  });

  const paginatedRows = useMemo(() => {
    if (pageSize >= sorted.length) return sorted;
    return sorted.slice(page * pageSize, (page + 1) * pageSize);
  }, [sorted, page, pageSize]);

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  if (data.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <p className="text-xs text-muted">No symbol data</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]">
            <TableHead
              className="cursor-pointer text-xs font-medium text-secondary"
              onClick={() => handleSort("symbol")}
            >
              Symbol{arrow("symbol")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right text-xs font-medium text-secondary"
              onClick={() => handleSort("tradeCount")}
            >
              Trades{arrow("tradeCount")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right text-xs font-medium text-secondary"
              onClick={() => handleSort("winRate")}
            >
              Win%{arrow("winRate")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right text-xs font-medium text-secondary"
              onClick={() => handleSort("totalPnl")}
            >
              Total PnL{arrow("totalPnl")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right text-xs font-medium text-secondary"
              onClick={() => handleSort("avgPnl")}
            >
              Avg PnL{arrow("avgPnl")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-right text-xs font-medium text-secondary"
              onClick={() => handleSort("totalFees")}
            >
              Fees{arrow("totalFees")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRows.map((s) => (
            <TableRow key={s.symbol} className="h-10 hover:bg-[var(--bg-elevated)]">
              <TableCell className="font-mono text-sm font-semibold text-primary">
                {s.symbol}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                {s.tradeCount}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-secondary">
                {(s.winRate * 100).toFixed(1)}%
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono text-sm font-semibold tabular-nums",
                  s.totalPnl > 0 && "text-bullish",
                  s.totalPnl < 0 && "text-bearish",
                  s.totalPnl === 0 && "text-secondary"
                )}
              >
                {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-mono text-sm tabular-nums",
                  s.avgPnl > 0 && "text-bullish",
                  s.avgPnl < 0 && "text-bearish",
                  s.avgPnl === 0 && "text-secondary"
                )}
              >
                {s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted">
                ${s.totalFees.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {sorted.length > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={sorted.length}
          pageSizeOptions={[25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
