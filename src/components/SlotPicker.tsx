"use client";

import { ClockIcon } from "@/components/Icons";

export type Slot = { start: string; label: string };

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function group(slots: Slot[]) {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];

  for (const slot of slots) {
    const hour = Number(slot.label.slice(0, 2));
    (hour < 13 ? morning : afternoon).push(slot);
  }

  return [
    { title: "Morning", slots: morning },
    { title: "Afternoon", slots: afternoon },
  ].filter((section) => section.slots.length > 0);
}

export function SlotPicker({
  slots,
  loading,
  error,
  selected,
  onSelect,
}: {
  slots: Slot[];
  loading: boolean;
  error: string | null;
  selected: string | null;
  onSelect: (start: string) => void;
}) {
  if (loading) {
    return (
      <div aria-hidden className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl border border-line bg-ink/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/50 px-4 py-5 text-sm text-muted">
        <ClockIcon className="h-5 w-5 shrink-0" />
        Fully booked that day. Try another date on the calendar.
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Choose a time" className="flex flex-col gap-4">
      {group(slots).map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted/70">
            {section.title}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {section.slots.map((slot) => {
              const isSelected = slot.start === selected;

              return (
                <button
                  key={slot.start}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelect(slot.start)}
                  className={`rounded-xl px-2 py-3 text-sm font-medium transition ${
                    isSelected
                      ? "bg-gradient-to-br from-accent to-accent/70 text-white shadow-lg shadow-accent/25"
                      : "border border-line bg-white/[0.02] text-white hover:border-accent/50 hover:bg-accent/10"
                  }`}
                >
                  {timeFormatter.format(new Date(slot.start))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
