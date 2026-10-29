import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { toISTLabel } from "@/lib/slots";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You are booked — Pixie Webs",
  robots: { index: false, follow: false },
};

type Booking = { name: string; email: string; start_time: string; meet_link: string | null };

async function getBooking(ref: string | undefined): Promise<Booking | null> {
  if (!ref) return null;

  try {
    const { data, error } = await supabaseAdmin()
      .from("bookings")
      .select("name, email, start_time, meet_link")
      .eq("id", ref)
      .maybeSingle();

    if (error) throw error;
    return (data as Booking | null) ?? null;
  } catch (error) {
    // A missing lookup should never block the thank-you page.
    console.error("[confirmed] could not load booking", error);
    return null;
  }
}

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const booking = await getBooking(ref);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-5 pb-16 pt-10">
      <Image
        src="/logo.png"
        alt="Pixie Webs"
        width={842}
        height={237}
        priority
        className="h-9 w-auto"
      />

      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-ink-soft p-6">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-ink"
        >
          &#10003;
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {booking ? `You are booked, ${booking.name.split(" ")[0]}.` : "You are booked."}
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-muted">
            {booking ? (
              <>
                We will meet on{" "}
                <strong className="font-semibold text-white">{toISTLabel(new Date(booking.start_time))} IST</strong>.
                The calendar invite is on its way to{" "}
                <strong className="font-semibold text-white">{booking.email}</strong>.
              </>
            ) : (
              "Your call is confirmed. Check your inbox for the Google Calendar invite with the Meet link."
            )}
          </p>
        </div>

        {booking?.meet_link ? (
          <a
            href={booking.meet_link}
            className="rounded-xl border border-line px-4 py-3 text-center text-sm font-medium text-white transition hover:border-white/40"
          >
            Google Meet link
          </a>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 text-sm text-muted">
        <h2 className="font-medium text-white">What happens next</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Accept the calendar invite so the time is held on your side too.</li>
          <li>Have a look at your current website, if you have one, before we talk.</li>
          <li>Join on the Meet link at the scheduled time. We keep it to 30 minutes.</li>
        </ol>
        <p>Need a different time? Just reply to the invite and we will move it.</p>
      </section>

      <Link href="/" className="text-center text-xs text-muted underline underline-offset-4">
        Back to the start
      </Link>
    </main>
  );
}
