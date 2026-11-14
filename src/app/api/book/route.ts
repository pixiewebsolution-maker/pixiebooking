import { NextResponse } from "next/server";

import { createBookingEvent, getBusyIntervals } from "@/lib/google";
import { sendConfirmationEmail } from "@/lib/mailer";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isLegalSlotStart, overlapsBusy, slotEnd, toISTLabel } from "@/lib/slots";
import { bookingSchema, firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLOT_TAKEN = "That time was just booked. Please pick another slot.";

export async function POST(request: Request) {
  const burst = rateLimit(`book:${clientIp(request)}`, 5, 10 * 60_000);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(burst.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const { name, email, phone, start: startRaw, contact_ref_id: trap } = parsed.data;

  // Honeypot tripped: look successful, create nothing. Logged with the value,
  // because a silent discard here is indistinguishable from a broken
  // integration — and because what filled it is the only useful clue.
  // HONEYPOT_OFF=1 turns the trap off entirely if it ever misfires again:
  // losing a real lead costs far more than letting a spam booking through.
  if (trap && process.env.HONEYPOT_OFF !== "1") {
    console.warn(
      `[book] honeypot tripped, discarding submission` +
        (process.env.NODE_ENV === "production" ? "" : ` — field held: ${JSON.stringify(trap)}`),
    );
    return NextResponse.json({ ok: true });
  }

  const start = new Date(startRaw);
  if (!isLegalSlotStart(start)) {
    return NextResponse.json(
      { error: "That slot is no longer available. Please pick another time." },
      { status: 400 },
    );
  }
  const end = slotEnd(start);

  // Ask Google again, right now, in case the slot went in the last minute.
  // The calendar is the only source of truth here, so this is the guard.
  try {
    const busy = await getBusyIntervals(start, end);
    if (overlapsBusy(start, busy)) {
      return NextResponse.json({ error: SLOT_TAKEN }, { status: 409 });
    }
  } catch (error) {
    console.error("[book] free/busy recheck failed", error);
    return NextResponse.json(
      { error: "Could not confirm that time. Please try again." },
      { status: 502 },
    );
  }

  try {
    // sendUpdates: "all" is what emails the Google invite to the client —
    // except when the client is the calendar owner, who never gets one.
    const event = await createBookingEvent({ name, email, phone, start, end });

    // Our own copy: carries the Meet link in the body and an .ics, so the
    // link is in their inbox whatever their calendar app is.
    const emailed = await sendConfirmationEmail({
      name,
      email,
      phone,
      start,
      end,
      meetLink: event.meetLink,
      eventLink: event.htmlLink,
      iCalUid: event.iCalUid,
      organizerEmail: event.organizerEmail,
    });

    console.log(
      `[book] created ${event.eventId} for ${email}` +
        ` (meet: ${event.meetLink ? "yes" : "no"}, email: ${emailed ? "sent" : "failed"})`,
    );

    return NextResponse.json({
      ok: true,
      startLabel: toISTLabel(start),
      meetLink: event.meetLink,
      emailed,
    });
  } catch (error) {
    console.error("[book] calendar event failed", error);
    return NextResponse.json(
      { error: "We could not confirm that meeting. Please try another time." },
      { status: 502 },
    );
  }
}
