import { NextResponse } from "next/server";

import { getBusyIntervals } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  BOOKING_WINDOW_DAYS,
  addDays,
  dayBounds,
  earliestBookableInstant,
  isValidDateString,
  isWorkingDay,
  overlapsBusy,
  slotStartsForDate,
  toISTDateString,
  toISTTimeString,
} from "@/lib/slots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = rateLimit(`slots:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const date = new URL(request.url).searchParams.get("date") ?? "";

  if (!isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const now = new Date();
  const windowEnd = addDays(toISTDateString(now), BOOKING_WINDOW_DAYS);
  if (date < toISTDateString(now) || date > windowEnd) {
    return NextResponse.json({ date, slots: [] });
  }

  if (!isWorkingDay(date)) {
    return NextResponse.json({ date, slots: [] });
  }

  const { timeMin, timeMax } = dayBounds(date);

  try {
    const busy = await getBusyIntervals(timeMin, timeMax);
    const notBefore = earliestBookableInstant(now);

    const slots = slotStartsForDate(date)
      .filter((start) => start.getTime() >= notBefore.getTime())
      .filter((start) => !overlapsBusy(start, busy))
      .map((start) => ({ start: start.toISOString(), label: toISTTimeString(start) }));

    return NextResponse.json({ date, slots });
  } catch (error) {
    console.error("[slots] free/busy lookup failed", error);
    return NextResponse.json({ error: "Could not load times. Please try again." }, { status: 502 });
  }
}
