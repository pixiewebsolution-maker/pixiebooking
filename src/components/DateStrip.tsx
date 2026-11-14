"use client";

import { useEffect, useRef } from "react";

import { chipParts } from "@/lib/zones";

type Props = {
  /** Bookable days, "YYYY-MM-DD", in the visitor's zone. */
  available: string[];
  value: string;
  onChange: (day: string) => void;
};

/**
 * The phone version of the calendar: one swipeable row of bookable days, so
 * the times and the form stay close to the top of the screen.
 */
export default function DateStrip({ available, value, onChange }: Props) {
  const strip = useRef<HTMLDivElement>(null);

  // Keep the picked day in view, e.g. after a time zone change moves it.
  useEffect(() => {
    const chip = strip.current?.querySelector<HTMLElement>(".date-chip.is-selected");
    chip?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  if (available.length === 0) {
    return (
      <p className="picker-state">
        No dates are open right now. Please call us and we will find a time.
      </p>
    );
  }

  return (
    <div className="strip" ref={strip} role="radiogroup" aria-label="Choose a date">
      {available.map((day) => {
        const { weekday, day: date, month } = chipParts(day);
        const selected = day === value;
        return (
          <button
            key={day}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`date-chip${selected ? " is-selected" : ""}`}
            onClick={() => onChange(day)}
          >
            <span className="date-chip-weekday">{weekday}</span>
            <span className="date-chip-day">{date}</span>
            <span className="date-chip-month">{month}</span>
          </button>
        );
      })}
    </div>
  );
}
