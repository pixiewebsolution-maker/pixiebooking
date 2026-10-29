import { NextResponse } from "next/server";

import { createBookingEvent, getBusyIntervals } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isLegalSlotStart, overlapsBusy, slotEnd } from "@/lib/slots";
import { supabaseAdmin } from "@/lib/supabase";
import { UTM_KEYS, bookingSchema, firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLOT_TAKEN = "That time was just booked. Please pick another slot.";

export async function POST(request: Request) {
  const ip = clientIp(request);

  const burst = rateLimit(`book:${ip}`, 5, 10 * 60_000);
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

  const { name, email, phone, start: startRaw, company_website, utm, referrer } = parsed.data;

  // Honeypot tripped: look successful, create nothing.
  if (company_website) {
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

  // 1. Ask Google again, right now, in case the slot went in the last minute.
  try {
    const busy = await getBusyIntervals(start, end);
    if (overlapsBusy(start, busy)) {
      return NextResponse.json({ error: SLOT_TAKEN }, { status: 409 });
    }
  } catch (error) {
    console.error("[book] free/busy recheck failed", error);
    return NextResponse.json({ error: "Could not confirm that time. Please try again." }, { status: 502 });
  }

  const supabase = supabaseAdmin();

  // 2. Claim the slot in Postgres first. The unique index on start_time is what
  //    actually settles two requests arriving in the same second.
  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      name,
      email,
      phone,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      referrer: referrer ?? null,
      ...Object.fromEntries(UTM_KEYS.map((key) => [key, utm?.[key] ?? null])),
    })
    .select("id")
    .single();

  if (insertError || !booking) {
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: SLOT_TAKEN }, { status: 409 });
    }
    console.error("[book] could not save lead", insertError);
    return NextResponse.json({ error: "Could not save your booking. Please try again." }, { status: 500 });
  }

  // 3. Create the meeting. If Google fails, release the claim so the slot reopens.
  try {
    const event = await createBookingEvent({ name, email, phone, start, end });

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ event_id: event.eventId, meet_link: event.meetLink })
      .eq("id", booking.id);

    if (updateError) {
      // The call exists and the client has the invite; just flag it for us.
      console.error("[book] event created but lead not updated", booking.id, updateError);
    }

    return NextResponse.json({ ok: true, ref: booking.id });
  } catch (error) {
    console.error("[book] calendar event failed", error);
    await supabase.from("bookings").delete().eq("id", booking.id);
    return NextResponse.json(
      { error: "We could not confirm that meeting. Please try another time." },
      { status: 502 },
    );
  }
}
