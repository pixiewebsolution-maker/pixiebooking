/**
 * Showing our IST slots in whatever time zone the visitor picks.
 *
 * Availability stays defined in IST (see slots.ts) and the server never needs
 * to know the visitor's zone to list or book a slot: a slot is an instant, and
 * the zone only changes how that instant is labelled and which calendar day it
 * falls on. Everything here runs in the browser, after mount.
 */

import {
  TIME_ZONE,
  earliestBookableInstant,
  selectableDates,
  slotStartsForDate,
} from "@/lib/slots";

export const DEFAULT_ZONE = TIME_ZONE;

/** Shown in the picker, sorted by offset. The visitor's own zone is added if missing. */
const COMMON_ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Europe/Istanbul",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, found);
  }
  return found;
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Old names some browsers still report, mapped to the ones in our list. */
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
};

export function detectZone(): string {
  try {
    const reported = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zone = RENAMED[reported] ?? reported;
    return zone && isValidZone(zone) ? zone : DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

/** "2026-11-04": the calendar day an instant falls on in a zone. */
export function localDate(date: Date, zone: string): string {
  return formatter("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "2:30 pm" in a zone. */
export function localClock(date: Date, zone: string): string {
  return formatter("en-IN", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function zonePart(zone: string, style: Intl.DateTimeFormatOptions["timeZoneName"], at: Date) {
  return (
    formatter("en-US", { timeZone: zone, timeZoneName: style })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

/** "GMT+5:30". */
export function offsetLabel(zone: string, at: Date = new Date()): string {
  const label = zonePart(zone, "shortOffset", at);
  return label === "GMT" ? "GMT+0" : label;
}

function offsetMinutes(zone: string, at: Date): number {
  const match = offsetLabel(zone, at).match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

function cityOf(zone: string): string {
  return zone.split("/").at(-1)?.replace(/_/g, " ") ?? zone;
}

export type ZoneOption = {
  value: string;
  /** "Kolkata" */
  city: string;
  /** "India Standard Time" */
  name: string;
  /** "GMT+5:30" */
  offset: string;
  /** Lower-case text the search box matches against. */
  search: string;
};

/** Picker options, with the visitor's detected zone guaranteed to be present. */
export function zoneOptions(include: string[], at: Date = new Date()): ZoneOption[] {
  const zones = Array.from(new Set([...COMMON_ZONES, ...include])).filter(isValidZone);
  return zones
    .map((zone) => ({ zone, minutes: offsetMinutes(zone, at) }))
    .sort((a, b) => a.minutes - b.minutes || a.zone.localeCompare(b.zone))
    .map(({ zone }) => {
      const city = cityOf(zone);
      const name = zonePart(zone, "long", at);
      const offset = offsetLabel(zone, at);
      return {
        value: zone,
        city,
        name,
        offset,
        search: `${city} ${name} ${offset} ${zone}`.toLowerCase(),
      };
    });
}

/** Short name for the zone, e.g. "India Standard Time". */
export function zoneName(zone: string, at: Date = new Date()): string {
  return zonePart(zone, "long", at) || cityOf(zone);
}

/**
 * Calendar days, in the visitor's zone, that hold at least one bookable slot.
 * A working day is 8 hours long, so its first and last slot cover every local
 * day it can touch.
 */
export function bookableLocalDates(zone: string, now: Date = new Date()): string[] {
  const notBefore = earliestBookableInstant(now).getTime();
  const days = new Set<string>();

  for (const day of selectableDates(now)) {
    const starts = slotStartsForDate(day).filter((start) => start.getTime() >= notBefore);
    const first = starts[0];
    const last = starts.at(-1);
    if (!first || !last) continue;
    days.add(localDate(first, zone));
    days.add(localDate(last, zone));
  }

  return Array.from(days).sort();
}

/** The IST working days whose slots can land on this local day. */
export function istDaysFor(local: string, zone: string, now: Date = new Date()): string[] {
  return selectableDates(now).filter((day) => {
    const starts = slotStartsForDate(day);
    const first = starts[0];
    const last = starts.at(-1);
    if (!first || !last) return false;
    return localDate(first, zone) === local || localDate(last, zone) === local;
  });
}

/* ------------------------------------------------ plain calendar-day maths */

function utcNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/** "Monday, 16 November" for a "2026-11-16" day string. */
export function dayLabel(day: string): string {
  return formatter("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(utcNoon(day));
}

/** { weekday: "Tue", day: "18", month: "Nov" } for a date chip. */
export function chipParts(day: string): { weekday: string; day: string; month: string } {
  const parts = formatter("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(utcNoon(day));
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { weekday: find("weekday"), day: find("day"), month: find("month") };
}

/** "Nov 2026" for a "2026-11" month string. */
export function monthLabel(month: string): string {
  return formatter("en-GB", { timeZone: "UTC", month: "short", year: "numeric" }).format(
    utcNoon(`${month}-01`),
  );
}

export function shiftMonth(month: string, by: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The days of a month laid out Monday first, padded with nulls. */
export function monthGrid(month: string): (string | null)[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
