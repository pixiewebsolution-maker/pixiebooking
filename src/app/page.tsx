import Image from "next/image";
import { Suspense } from "react";

import { BookingForm } from "@/components/BookingForm";

const PROOF = [
  "Free 30 minute call",
  "Google Meet link sent instantly",
  "No obligation, no sales script",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-10 px-5 pb-16 pt-8 sm:pt-12">
      <header className="flex flex-col gap-6">
        <Image
          src="/logo.png"
          alt="Pixie Webs"
          width={842}
          height={237}
          priority
          className="h-10 w-auto sm:h-11"
        />

        <div className="flex flex-col gap-4">
          <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
            A website that actually brings you customers.
          </h1>
          <p className="text-pretty text-base leading-relaxed text-muted">
            Book a free 30 minute call. We will look at your business, show you what is costing you
            leads, and tell you exactly what we would build.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {PROOF.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
              <span aria-hidden className="text-white">
                &#10003;
              </span>
              {item}
            </li>
          ))}
        </ul>
      </header>

      <Suspense fallback={<FormSkeleton />}>
        <BookingForm />
      </Suspense>

      <footer className="text-center text-xs text-muted">
        &copy; {new Date().getFullYear()} Pixie Webs. All times shown in IST.
      </footer>
    </main>
  );
}

function FormSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[26rem] w-full animate-pulse rounded-2xl border border-line bg-ink-soft"
    />
  );
}
