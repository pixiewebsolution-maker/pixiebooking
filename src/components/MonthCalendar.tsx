"use client";

import { useMemo, useState } from "react";

import { monthGrid, monthLabel, shiftMonth } from "@/lib/zones";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  /** Bookable days, "YYYY-MM-DD", in the visitor's zone. */
  available: string[];
  /** Today in the visitor's zone, ringed on the grid. */
  today: string;
  value: string;
  onChange: (day: string) => void;
};

/** Month grid; only days that hold a bookable slot can be picked. */
export default function MonthCalendar({ available, today, value, onChange }: Props) {
  const open = useMemo(() => new Set(available), [available]);
  const firstMonth = (available[0] ?? today).slice(0, 7);
  const lastMonth = (available.at(-1) ?? today).slice(0, 7);

  const [month, setMonth] = useState(() => (value || available[0] || today).slice(0, 7));
  // A zone change can move the open days out from under the month on screen.
  const shown = month < firstMonth ? firstMonth : month > lastMonth ? lastMonth : month;

  const cells = useMemo(() => monthGrid(shown), [shown]);

  if (available.length === 0) {
    return (
      <p className="picker-state">
        No dates are open right now. Please call us and we will find a time.
      </p>
    );
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => setMonth(shiftMonth(shown, -1))}
          disabled={shown <= firstMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon />
        </button>
        <span className="cal-month" aria-live="polite">
          {monthLabel(shown)}
        </span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => setMonth(shiftMonth(shown, 1))}
          disabled={shown >= lastMonth}
          aria-label="Next month"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="cal-grid" role="grid" aria-label="Choose a date">
        {WEEKDAYS.map((label, index) => (
          <span className="cal-weekday" key={index} aria-hidden>
            {label}
          </span>
        ))}

        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;

          const bookable = open.has(day);
          const selected = day === value;
          const classes = [
            "cal-day",
            bookable ? "is-open" : "",
            selected ? "is-selected" : "",
            day === today ? "is-today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day}
              type="button"
              className={classes}
              disabled={!bookable}
              aria-pressed={selected}
              aria-label={day}
              onClick={() => onChange(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
