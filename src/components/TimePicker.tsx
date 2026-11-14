"use client";

import { useEffect, useState } from "react";

import { toISTClock } from "@/lib/slots";

type Slot = { start: string; label: string };

type Props = {
  date: string;
  value: string;
  onChange: (start: string) => void;
};

/**
 * Times still free on the chosen date. The list comes from the server, which
 * reads the calendar's free/busy — we never trust the client on availability.
 */
export default function TimePicker({ date, value, onChange }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSlots(null);
    setError(null);

    (async () => {
      try {
        const response = await fetch(`/api/slots?date=${encodeURIComponent(date)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load times.");
        setSlots(data.slots ?? []);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load times.");
      }
    })();

    return () => controller.abort();
  }, [date]);

  if (error) {
    return <p className="picker-state is-error">{error}</p>;
  }

  if (slots === null) {
    return <p className="picker-state">Checking the calendar…</p>;
  }

  if (slots.length === 0) {
    return <p className="picker-state">No times left on this day. Try another date.</p>;
  }

  return (
    <div className="slot-grid" role="radiogroup" aria-label="Choose a time">
      {slots.map((slot) => {
        const selected = slot.start === value;
        return (
          <button
            key={slot.start}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`slot${selected ? " is-selected" : ""}`}
            onClick={() => onChange(slot.start)}
          >
            {toISTClock(new Date(slot.start))}
          </button>
        );
      })}
    </div>
  );
}
