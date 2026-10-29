"use client";

import { istInstant } from "@/lib/slots";

const dayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function DatePicker({
  dates,
  selected,
  onSelect,
}: {
  dates: string[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  if (dates.length === 0) {
    return <div aria-hidden className="h-[4.5rem] animate-pulse rounded-xl border border-line bg-ink" />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Choose a date"
      className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1"
    >
      {dates.map((date) => {
        const noon = istInstant(date, 12, 0);
        const isSelected = date === selected;

        return (
          <button
            key={date}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(date)}
            className={`flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-3 py-3 transition ${
              isSelected
                ? "border-white bg-white text-ink"
                : "border-line bg-ink text-white hover:border-white/40"
            }`}
          >
            <span className={`text-xs uppercase tracking-wide ${isSelected ? "text-ink/70" : "text-muted"}`}>
              {dayFormatter.format(noon)}
            </span>
            <span className="text-sm font-semibold">{dateFormatter.format(noon)}</span>
          </button>
        );
      })}
    </div>
  );
}
