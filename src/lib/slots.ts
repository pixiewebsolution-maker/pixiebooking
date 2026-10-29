/**
 * Slot math for a Mon-Sat, 10:00-18:00 IST calendar with 30 minute meetings.
 *
 * India has no daylight saving, so IST is a fixed +05:30 offset. That lets us
 * build exact instants from a date string without pulling in a tz library.
 */

export const TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET = "+05:30";
export const SLOT_MINUTES = 30;
export const DAY_START_HOUR = 10;
export const DAY_END_HOUR = 18;
export const MIN_NOTICE_HOURS = 24;
export const BOOKING_WINDOW_DAYS = 30;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const istTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const istLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "2026-11-04" in IST for a given instant (defaults to now). */
export function toISTDateString(date: Date = new Date()): string {
  return istDateFormatter.format(date);
}

/** "14:30" in IST. */
export function toISTTimeString(date: Date): string {
  return istTimeFormatter.format(date);
}

/** "Tue, 4 Nov, 2:30 pm" in IST — used on the confirmation page and emails. */
export function toISTLabel(date: Date): string {
  return istLabelFormatter.format(date);
}

export function isValidDateString(value: string): boolean {
  return DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00${IST_OFFSET}`));
}

/** Exact instant for a wall-clock time on an IST calendar date. */
export function istInstant(dateString: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateString}T${hh}:${mm}:00.000${IST_OFFSET}`);
}

export function addDays(dateString: string, days: number): string {
  // Anchor at noon so the shift can never cross a date boundary by accident.
  const anchor = istInstant(dateString, 12, 0);
  return toISTDateString(new Date(anchor.getTime() + days * 86_400_000));
}

/** Monday to Saturday. Noon IST shares its UTC weekday, so getUTCDay is safe here. */
export function isWorkingDay(dateString: string): boolean {
  const day = istInstant(dateString, 12, 0).getUTCDay();
  return day >= 1 && day <= 6;
}

export function slotEnd(start: Date): Date {
  return new Date(start.getTime() + SLOT_MINUTES * 60_000);
}

export function earliestBookableInstant(now: Date = new Date()): Date {
  return new Date(now.getTime() + MIN_NOTICE_HOURS * 3_600_000);
}

/** Every slot start on a date, ignoring the calendar and the notice window. */
export function slotStartsForDate(dateString: string): Date[] {
  if (!isValidDateString(dateString) || !isWorkingDay(dateString)) return [];

  const starts: Date[] = [];
  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      starts.push(istInstant(dateString, hour, minute));
    }
  }
  return starts;
}

/** The window a free/busy query needs to cover one booking day. */
export function dayBounds(dateString: string): { timeMin: Date; timeMax: Date } {
  return {
    timeMin: istInstant(dateString, DAY_START_HOUR, 0),
    timeMax: istInstant(dateString, DAY_END_HOUR, 0),
  };
}

export type BusyInterval = { start: Date; end: Date };

export function overlapsBusy(start: Date, busy: BusyInterval[]): boolean {
  const end = slotEnd(start);
  return busy.some((b) => start < b.end && end > b.start);
}

/**
 * Is this instant a slot we would ever sell? Checked again on the server at
 * submit time so a tampered payload cannot book 3am on a Sunday.
 */
export function isLegalSlotStart(start: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(start.getTime())) return false;
  if (start.getTime() < earliestBookableInstant(now).getTime()) return false;

  const dateString = toISTDateString(start);
  if (start.getTime() > istInstant(addDays(toISTDateString(now), BOOKING_WINDOW_DAYS), 23, 59).getTime()) {
    return false;
  }

  return slotStartsForDate(dateString).some((s) => s.getTime() === start.getTime());
}

/** Dates offered in the picker: working days inside the booking window. */
export function selectableDates(now: Date = new Date()): string[] {
  const firstBookable = toISTDateString(earliestBookableInstant(now));
  const dates: string[] = [];

  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i += 1) {
    const date = addDays(firstBookable, i);
    if (!isWorkingDay(date)) continue;
    // Skip a day whose last slot has already fallen inside the notice window.
    const last = slotStartsForDate(date).at(-1);
    if (!last || last.getTime() < earliestBookableInstant(now).getTime()) continue;
    dates.push(date);
  }

  return dates;
}
