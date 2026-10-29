"use client";

export type Slot = { start: string; label: string };

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
      <div aria-hidden className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-xl border border-line bg-ink" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (slots.length === 0) {
    return <p className="text-sm text-muted">No times left on this day. Try another date.</p>;
  }

  return (
    <div role="radiogroup" aria-label="Choose a time" className="grid grid-cols-3 gap-2">
      {slots.map((slot) => {
        const isSelected = slot.start === selected;

        return (
          <button
            key={slot.start}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(slot.start)}
            className={`rounded-xl border px-2 py-3 text-sm font-medium transition ${
              isSelected
                ? "border-white bg-white text-ink"
                : "border-line bg-ink text-white hover:border-white/40"
            }`}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
