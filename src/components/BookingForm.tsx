"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Field } from "@/components/Field";
import { DatePicker } from "@/components/DatePicker";
import { SlotPicker, type Slot } from "@/components/SlotPicker";
import { selectableDates } from "@/lib/slots";
import { UTM_KEYS, bookingSchema, type UtmParams } from "@/lib/validation";

const UTM_STORAGE_KEY = "pw_utm";
const TEXT_FIELDS = ["name", "email", "phone"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

export function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [values, setValues] = useState<Record<TextField, string>>({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Partial<Record<TextField | "slot" | "form", string>>>({});
  const [honeypot, setHoneypot] = useState("");

  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const utm = useRef<UtmParams>({});

  // Dates depend on the visitor clock, so build them after mount to keep the
  // server and client markup identical.
  useEffect(() => {
    const available = selectableDates();
    setDates(available);
    setSelectedDate((current) => current ?? available[0] ?? null);
  }, []);

  // Instagram sends people here with campaign tags; keep them through a reload.
  useEffect(() => {
    const fromUrl: UtmParams = {};
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) fromUrl[key] = value.slice(0, 200);
    }

    if (Object.keys(fromUrl).length > 0) {
      utm.current = fromUrl;
      try {
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
      } catch {
        // Private mode: campaign tags are nice to have, not essential.
      }
      return;
    }

    try {
      const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) utm.current = JSON.parse(stored) as UtmParams;
    } catch {
      utm.current = {};
    }
  }, [searchParams]);

  const loadSlots = useCallback(async (date: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/slots?date=${date}`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load times");
    return (data.slots ?? []) as Slot[];
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const controller = new AbortController();
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);

    loadSlots(selectedDate, controller.signal)
      .then(setSlots)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSlots([]);
        setSlotsError(error instanceof Error ? error.message : "Could not load times");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate, loadSlots]);

  const validateField = useCallback((field: TextField, value: string) => {
    const result = bookingSchema.shape[field].safeParse(value);
    setErrors((current) => ({
      ...current,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: Partial<Record<TextField | "slot" | "form", string>> = {};
    for (const field of TEXT_FIELDS) {
      const result = bookingSchema.shape[field].safeParse(values[field]);
      if (!result.success) nextErrors[field] = result.error.issues[0]?.message;
    }
    if (!selectedSlot) nextErrors.slot = "Pick a time that works for you";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          start: selectedSlot,
          company_website: honeypot,
          utm: utm.current,
          referrer: typeof document !== "undefined" ? document.referrer : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ form: data.error ?? "Something went wrong. Please try again." });

        // Taken while they were typing: reload that day so the grid is honest.
        if (response.status === 409 && selectedDate) {
          setSelectedSlot(null);
          try {
            setSlots(await loadSlots(selectedDate));
          } catch {
            setSlots([]);
          }
        }
        return;
      }

      router.push(data.ref ? `/confirmed?ref=${encodeURIComponent(data.ref)}` : "/confirmed");
    } catch {
      setErrors({ form: "Network problem. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-2xl border border-line bg-ink-soft p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        <Field
          id="name"
          label="Your name"
          type="text"
          inputMode="text"
          autoComplete="name"
          placeholder="Arjun Nair"
          value={values.name}
          error={errors.name}
          onChange={(value) => setValues((v) => ({ ...v, name: value }))}
          onBlur={() => validateField("name", values.name)}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          error={errors.email}
          onChange={(value) => setValues((v) => ({ ...v, email: value }))}
          onBlur={() => validateField("email", values.email)}
        />
        <Field
          id="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          value={values.phone}
          error={errors.phone}
          onChange={(value) => setValues((v) => ({ ...v, phone: value }))}
          onBlur={() => validateField("phone", values.phone)}
        />
      </div>

      {/* Honeypot. Hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-white">Pick a day</h2>
        <DatePicker dates={dates} selected={selectedDate} onSelect={setSelectedDate} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-white">
          Pick a time <span className="font-normal text-muted">(IST)</span>
        </h2>
        <SlotPicker
          slots={slots}
          loading={slotsLoading}
          error={slotsError}
          selected={selectedSlot}
          onSelect={(start) => {
            setSelectedSlot(start);
            setErrors((current) => ({ ...current, slot: undefined }));
          }}
        />
        {errors.slot ? (
          <p role="alert" className="text-sm text-red-400">
            {errors.slot}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-white px-5 py-4 text-base font-semibold text-ink transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Confirming…" : "Confirm my call"}
      </button>

      <p className="text-center text-xs text-muted">
        You will get a Google Calendar invite with a Meet link. 30 minutes, Monday to Saturday.
      </p>
    </form>
  );
}
