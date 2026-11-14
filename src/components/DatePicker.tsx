"use client";

import { useMemo, useRef } from "react";

import { istChipParts, selectableDates } from "@/lib/slots";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

type Props = {
  value: string;
  onChange: (date: string) => void;
};

/**
 * Horizontal strip of the working days we are open for. Only ever rendered
 * after the first step, so reading the clock here cannot desync hydration.
 */
export default function DatePicker({ value, onChange }: Props) {
  const dates = useMemo(() => selectableDates(), []);
  const strip = useRef<HTMLDivElement>(null);

  const page = (direction: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (dates.length === 0) {
    return (
      <p className="picker-state">
        No dates are open right now. Please call us and we will find a time.
      </p>
    );
  }

  return (
    <div className="strip-wrap">
      <button
        type="button"
        className="strip-arrow"
        onClick={() => page(-1)}
        aria-label="Earlier dates"
      >
        <ChevronLeftIcon />
      </button>

      <div className="strip" ref={strip} role="radiogroup" aria-label="Choose a date">
        {dates.map((date) => {
          const { weekday, day, month } = istChipParts(date);
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`date-chip${selected ? " is-selected" : ""}`}
              onClick={() => onChange(date)}
            >
              <span className="date-chip-weekday">{weekday}</span>
              <span className="date-chip-day">{day}</span>
              <span className="date-chip-month">{month}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="strip-arrow"
        onClick={() => page(1)}
        aria-label="Later dates"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
