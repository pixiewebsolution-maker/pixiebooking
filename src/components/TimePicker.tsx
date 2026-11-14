"use client";

import { useEffect, useState } from "react";

import { istDaysFor, localClock, localDate } from "@/lib/zones";

type Slot = { start: string };

type Props = {
  /** The day picked on the calendar, in the visitor's zone. */
  date: string;
  zone: string;
  value: string;
  onChange: (start: string) => void;
};

/**
 * Times still free on the chosen day. The server lists free slots per IST
 * working day from the calendar's free/busy — we never trust the client on
 * availability. A local day can straddle two IST days, so ask for each and keep
 * the slots that land on the day the visitor picked.
 */
export default function TimePicker({ date, zone, value, onChange }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setSlots(null);
    setError(null);

    (async () => {
      try {
        const days = istDaysFor(date, zone);
        const lists = await Promise.all(
          days.map(async (day) => {
            const response = await fetch(`/api/slots?date=${encodeURIComponent(day)}`, {
              signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? "Could not load times.");
            return (data.slots ?? []) as Slot[];
          }),
        );

        setSlots(
          lists
            .flat()
            .filter((slot) => localDate(new Date(slot.start), zone) === date)
            .sort((a, b) => a.start.localeCompare(b.start)),
        );
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load times.");
      }
    })();

    return () => controller.abort();
  }, [date, zone]);

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
            {localClock(new Date(slot.start), zone)}
          </button>
        );
      })}
    </div>
  );
}
