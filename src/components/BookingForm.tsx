"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Calendar } from "@/components/Calendar";
import { Field } from "@/components/Field";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  VideoIcon,
} from "@/components/Icons";
import { SlotPicker, type Slot } from "@/components/SlotPicker";
import { selectableDates, toISTLabel } from "@/lib/slots";
import { UTM_KEYS, bookingSchema, type UtmParams } from "@/lib/validation";

const UTM_STORAGE_KEY = "pw_utm";
const TEXT_FIELDS = ["name", "email", "phone"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Errors = Partial<Record<TextField | "slot" | "form", string>>;

export function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Record<TextField, string>>({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [honeypot, setHoneypot] = useState("");

  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const utm = useRef<UtmParams>({});
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Only talk to the calendar once they actually reach the scheduling step.
  useEffect(() => {
    if (step !== 2 || !selectedDate) return;

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
  }, [step, selectedDate, loadSlots]);

  const validateField = useCallback((field: TextField, value: string) => {
    const result = bookingSchema.shape[field].safeParse(value);
    setErrors((current) => ({
      ...current,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }, []);

  function validateDetails(): boolean {
    const nextErrors: Errors = {};
    for (const field of TEXT_FIELDS) {
      const result = bookingSchema.shape[field].safeParse(values[field]);
      if (!result.success) nextErrors[field] = result.error.issues[0]?.message;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goToScheduling() {
    if (!validateDetails()) return;
    setStep(2);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!validateDetails()) {
      setStep(1);
      return;
    }

    if (!selectedSlot) {
      setErrors({ slot: "Pick a time that works for you" });
      return;
    }

    setSubmitting(true);
    setErrors({});

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

        // Taken while they were deciding: reload that day so the grid is honest.
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

  const selectedLabel = selectedSlot ? toISTLabel(new Date(selectedSlot)) : null;

  return (
    <div ref={cardRef} className="card scroll-mt-6 p-5 sm:p-6">
      <StepHeader step={step} />

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        {step === 1 ? (
          <div key="details" className="flex animate-step-in flex-col gap-4">
            <Field
              id="name"
              label="Full name"
              type="text"
              inputMode="text"
              autoComplete="name"
              placeholder="Arjun Nair"
              icon={<UserIcon className="h-[1.15rem] w-[1.15rem]" />}
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
              icon={<MailIcon className="h-[1.15rem] w-[1.15rem]" />}
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
              icon={<PhoneIcon className="h-[1.15rem] w-[1.15rem]" />}
              value={values.phone}
              error={errors.phone}
              onChange={(value) => setValues((v) => ({ ...v, phone: value }))}
              onBlur={() => validateField("phone", values.phone)}
            />

            <button
              type="button"
              onClick={goToScheduling}
              className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-base font-semibold text-ink transition hover:bg-white/90 active:scale-[0.99]"
            >
              Next
              <ArrowRightIcon className="h-[1.15rem] w-[1.15rem] transition-transform group-hover:translate-x-0.5" />
            </button>

            <p className="text-center text-xs text-muted">
              Takes about 20 seconds. No spam, ever.
            </p>
          </div>
        ) : (
          <div key="schedule" className="flex animate-step-in flex-col gap-5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{values.name}</p>
                <p className="truncate text-xs text-muted">{values.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="shrink-0 text-xs font-medium text-accent-2 underline underline-offset-4 transition hover:text-white"
              >
                Edit
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold tracking-tight">Schedule a meet</h3>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" /> 30 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <VideoIcon className="h-4 w-4" /> Google Meet
                </span>
                <span className="flex items-center gap-1.5">India Standard Time</span>
              </div>
            </div>

            <Calendar
              available={dates}
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setErrors((current) => ({ ...current, slot: undefined, form: undefined }));
              }}
            />

            <div className="flex flex-col gap-3">
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                aria-label="Back to your details"
                className="flex w-14 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:border-white/30 hover:text-white"
              >
                <ArrowLeftIcon className="h-[1.15rem] w-[1.15rem]" />
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-white px-5 py-4 text-base font-semibold text-ink transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Confirming…"
                  : selectedLabel
                    ? `Confirm ${selectedLabel}`
                    : "Confirm my call"}
              </button>
            </div>
          </div>
        )}

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
      </form>
    </div>
  );
}

function StepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold tracking-tight">
          {step === 1 ? "Your details" : "Almost done"}
        </p>
        <p className="text-xs text-muted">Step {step} of 2</p>
      </div>

      <div className="flex gap-1.5" aria-hidden>
        <span className="h-1 flex-1 rounded-full bg-gradient-to-r from-accent to-accent-2" />
        <span
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            step === 2 ? "bg-gradient-to-r from-accent to-accent-2" : "bg-line"
          }`}
        />
      </div>
    </div>
  );
}
