"use client";

import { useEffect, useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/Icons";
import { istInstant } from "@/lib/slots";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** Cells for a "YYYY-MM" grid, Monday first, with leading blanks. */
function buildMonth(monthKey: string): (string | null)[] {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay is Sunday-first; shift so Monday is 0.
  const leading = (istInstant(`${monthKey}-01`, 12, 0).getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

export function Calendar({
  available,
  selected,
  onSelect,
}: {
  available: string[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const months = useMemo(() => [...new Set(available.map((date) => date.slice(0, 7)))], [available]);
  const availableSet = useMemo(() => new Set(available), [available]);

  const [monthIndex, setMonthIndex] = useState(0);

  // Follow the selection if it lands in another month, and stay in range when
  // the available list arrives after mount.
  useEffect(() => {
    if (months.length === 0) return;
    const target = selected ? months.indexOf(selected.slice(0, 7)) : -1;
    setMonthIndex((current) => (target >= 0 ? target : Math.min(current, months.length - 1)));
  }, [months, selected]);

  if (months.length === 0) {
    return <div aria-hidden className="h-72 animate-pulse rounded-xl border border-line bg-ink/60" />;
  }

  const monthKey = months[Math.min(monthIndex, months.length - 1)];
  const cells = buildMonth(monthKey);

  return (
    <div className="rounded-xl border border-line bg-ink/50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
          disabled={monthIndex === 0}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <p aria-live="polite" className="text-sm font-semibold tracking-tight">
          {monthFormatter.format(istInstant(`${monthKey}-01`, 12, 0))}
        </p>

        <button
          type="button"
          onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
          disabled={monthIndex >= months.length - 1}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, index) => (
          <span
            key={`${day}-${index}`}
            aria-hidden
            className="py-1 text-center text-[0.7rem] font-medium uppercase tracking-wider text-muted/70"
          >
            {day}
          </span>
        ))}
      </div>

      <div role="grid" aria-label="Choose a date" className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} aria-hidden />;

          const isAvailable = availableSet.has(date);
          const isSelected = date === selected;
          const dayNumber = Number(date.slice(-2));

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={!isAvailable}
              aria-selected={isSelected}
              aria-label={date}
              onClick={() => onSelect(date)}
              className={`relative flex h-10 items-center justify-center rounded-lg text-sm transition ${
                isSelected
                  ? "bg-gradient-to-br from-accent to-accent/70 font-semibold text-white shadow-lg shadow-accent/25"
                  : isAvailable
                    ? "border border-line/70 bg-white/[0.02] font-medium text-white hover:border-accent/50 hover:bg-accent/10"
                    : "text-muted/30"
              }`}
            >
              {dayNumber}
              {isAvailable && !isSelected ? (
                <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent-2/80" />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-2 text-[0.72rem] text-muted">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2/80" />
        Days with free slots &middot; Mon&ndash;Sat
      </p>
    </div>
  );
}
