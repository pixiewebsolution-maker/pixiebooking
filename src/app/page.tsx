import Image from "next/image";
import { Suspense } from "react";

import { BookingForm } from "@/components/BookingForm";
import { CheckIcon, ClockIcon, ShieldIcon, SparkIcon, VideoIcon } from "@/components/Icons";

const AGENDA = [
  {
    icon: SparkIcon,
    title: "Where you are losing leads",
    body: "We go through your current site, or your Instagram if you do not have one, and name the gaps.",
  },
  {
    icon: CheckIcon,
    title: "What we would build",
    body: "Pages, structure, and the one thing that matters most for your kind of business.",
  },
  {
    icon: ClockIcon,
    title: "Timeline and budget",
    body: "A straight answer on what it costs and how long it takes. No proposal theatre.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-12 px-5 pb-20 pt-7 sm:gap-14 sm:pt-10">
      <nav className="flex items-center justify-between gap-4">
        <Image
          src="/logo.png"
          alt="Pixie Webs"
          width={846}
          height={239}
          priority
          className="h-9 w-auto sm:h-10"
        />
        <span className="hidden rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-muted sm:block">
          Mon&ndash;Sat &middot; 10am&ndash;6pm IST
        </span>
      </nav>

      <header className="flex flex-col gap-6">
        <span className="flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-white">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent-2" />
          Booking calls this week
        </span>

        <h1 className="text-balance text-[2.1rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
          A website that actually <span className="gradient-text">brings you customers.</span>
        </h1>

        <p className="text-pretty text-base leading-relaxed text-muted sm:text-lg">
          Book a free 30 minute call. We look at your business, show you what is costing you leads,
          and tell you exactly what we would build.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { icon: ClockIcon, label: "30 minutes" },
            { icon: VideoIcon, label: "Google Meet" },
            { icon: ShieldIcon, label: "No obligation" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-muted"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <BookingForm />
      </Suspense>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          What we cover on the call
        </h2>

        <ul className="flex flex-col gap-3">
          {AGENDA.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-4 rounded-xl border border-line bg-white/[0.02] p-4 transition hover:border-white/20"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/25 to-accent-2/15 text-white">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium leading-snug">{title}</p>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card flex items-start gap-4 p-5">
        <ShieldIcon className="h-6 w-6 shrink-0 text-accent-2" />
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-white">It is a conversation, not a pitch.</span> If we
          are not the right fit, we will say so and point you somewhere better.
        </p>
      </section>

      <footer className="flex flex-col items-center gap-1 text-center text-xs text-muted">
        <Image
          src="/logo.png"
          alt=""
          width={846}
          height={239}
          className="mb-2 h-6 w-auto opacity-40"
        />
        <p>&copy; {new Date().getFullYear()} Pixie Webs. All times shown in IST.</p>
      </footer>
    </main>
  );
}

function FormSkeleton() {
  return <div aria-hidden className="card h-[30rem] w-full animate-pulse" />;
}
