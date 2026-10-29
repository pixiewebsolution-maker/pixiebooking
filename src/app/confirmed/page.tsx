import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { CheckIcon, ClockIcon, MailIcon, VideoIcon } from "@/components/Icons";
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
  const firstName = booking?.name.trim().split(/\s+/)[0];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-10 px-5 pb-20 pt-7 sm:pt-10">
      <nav>
        <Image
          src="/logo.png"
          alt="Pixie Webs"
          width={846}
          height={239}
          priority
          className="h-9 w-auto"
        />
      </nav>

      <div className="card flex flex-col gap-6 p-6 sm:p-7">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-lg shadow-accent/30"
        >
          <CheckIcon className="h-7 w-7" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {firstName ? (
              <>
                You are booked, <span className="gradient-text-tight">{firstName}.</span>
              </>
            ) : (
              <>
                You are <span className="gradient-text-tight">booked.</span>
              </>
            )}
          </h1>
          <p className="text-pretty leading-relaxed text-muted">
            The calendar invite is on its way. Accept it so the time is held on your side too.
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-ink/50">
          <Row icon={<ClockIcon className="h-4 w-4" />} label="When">
            {booking ? `${toISTLabel(new Date(booking.start_time))} IST` : "Check your inbox"}
          </Row>
          <Row icon={<VideoIcon className="h-4 w-4" />} label="Where">
            Google Meet, 30 minutes
          </Row>
          <Row icon={<MailIcon className="h-4 w-4" />} label="Invite sent to">
            {booking?.email ?? "Your email"}
          </Row>
        </dl>

        {booking?.meet_link ? (
          <a
            href={booking.meet_link}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-semibold text-ink transition hover:bg-white/90"
          >
            <VideoIcon className="h-5 w-5" />
            Open the Meet link
          </a>
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Before we talk</h2>
        <ol className="flex flex-col gap-3">
          {[
            "Accept the calendar invite so neither of us double books.",
            "Have your current site, or your Instagram, open and ready.",
            "Think about the one thing you want the site to do for you.",
          ].map((item, index) => (
            <li key={item} className="flex gap-3.5 rounded-xl border border-line bg-white/[0.02] p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/25 to-accent-2/15 text-sm font-semibold">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-muted">{item}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">
          Need a different time? Reply to the invite and we will move it.
        </p>
      </section>

      <Link
        href="/"
        className="text-center text-xs text-muted underline underline-offset-4 transition hover:text-white"
      >
        Back to the start
      </Link>
    </main>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <dt className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
