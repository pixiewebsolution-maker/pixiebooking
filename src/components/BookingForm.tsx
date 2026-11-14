"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_ZONE,
  bookableLocalDates,
  dayLabel,
  detectZone,
  localClock,
  localDate,
  offsetLabel,
  zoneOptions,
} from "@/lib/zones";
import { SLOT_MINUTES } from "@/lib/slots";
import MonthCalendar from "./MonthCalendar";
import TimePicker from "./TimePicker";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  VideoIcon,
} from "./Icons";

/**
 * Honeypot field name. Deliberately meaningless — but the name is not what
 * saves it. Accepting a Chrome autofill suggestion on any field fills every
 * other field Chrome thinks it can, whatever they are called, which quietly
 * flagged real visitors as bots. `readOnly` is the part that actually works:
 * browsers refuse to autofill a read-only input, while a script setting
 * `.value` directly — what a bot does — is unaffected.
 */
const TRAP_FIELD = "contact_ref_id";

/** Shown once the booking goes through. */
const BEFORE_THE_CALL = [
  "Join 5 minutes early. The Google Meet link is in your email and calendar invite.",
  "Use a laptop or desktop if you can, so we can share screens.",
  "Find a quiet spot with a stable internet connection.",
  "Note down the tools, sheets and steps you use today. Screenshots help.",
  "Think about the one problem you most want solved.",
  "Need a different time? Just reply to the confirmation email.",
];

type Values = {
  name: string;
  phone: string;
  email: string;
  date: string;
  start: string;
};

type Errors = Partial<Record<keyof Values, string>>;

type Booked = {
  start: string;
  meetLink: string | null;
  emailed: boolean;
};

const empty: Values = { name: "", phone: "", email: "", date: "", start: "" };

function validate(values: Values): Errors {
  const errors: Errors = {};

  if (!values.date) errors.date = "Please pick a date.";
  else if (!values.start) errors.start = "Please pick a time.";

  if (values.name.trim().length < 2) {
    errors.name = "Please enter your full name.";
  }

  const digits = values.phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    errors.phone = "Please enter a valid phone number.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  return errors;
}

/** "Tuesday, 18 November · 2:30 pm – 3:00 pm" in the chosen zone. */
function slotLabel(startIso: string, zone: string): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
  return `${dayLabel(localDate(start, zone))} · ${localClock(start, zone)} – ${localClock(end, zone)}`;
}

export default function BookingForm() {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);

  // Dates depend on the clock and the visitor's zone, neither of which the
  // prerendered HTML can know. Everything date shaped waits for the browser.
  const [mounted, setMounted] = useState(false);
  const [zone, setZone] = useState(DEFAULT_ZONE);
  const [detected, setDetected] = useState(DEFAULT_ZONE);

  useEffect(() => {
    const found = detectZone();
    setZone(found);
    setDetected(found);
    setMounted(true);
  }, []);

  const available = useMemo(() => (mounted ? bookableLocalDates(zone) : []), [mounted, zone]);
  const today = useMemo(() => (mounted ? localDate(new Date(), zone) : ""), [mounted, zone]);
  const zones = useMemo(() => (mounted ? zoneOptions([detected]) : []), [mounted, detected]);

  const set = (key: keyof Values) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Changing the day invalidates whatever time was picked under the old one.
  const pickDate = (date: string) => {
    setValues((prev) => ({ ...prev, date, start: "" }));
    setErrors((prev) => ({ ...prev, date: undefined, start: undefined }));
  };

  // A new zone moves every slot to a different local day and clock time, so
  // keep the day only if it is still bookable and always ask for the time again.
  const pickZone = (next: string) => {
    setZone(next);
    const stillOpen = bookableLocalDates(next);
    setValues((prev) => ({
      ...prev,
      date: stillOpen.includes(prev.date) ? prev.date : "",
      start: "",
    }));
  };

  const submit = async (trap: string) => {
    setSending(true);
    setFailed(null);

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          start: values.start,
          timeZone: zone,
          [TRAP_FIELD]: trap,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFailed(data.error ?? "Something went wrong. Please try again.");
        // The slot went while they were deciding: send them back to pick again.
        if (response.status === 409) {
          setValues((prev) => ({ ...prev, start: "" }));
        }
        return;
      }

      setBooked({
        start: values.start,
        meetLink: data.meetLink ?? null,
        emailed: Boolean(data.emailed),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFailed("Could not reach the server. Please check your connection.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // On a phone the first problem is often off screen, above or below.
      requestAnimationFrame(() => {
        document
          .querySelector(".error")
          ?.closest(".picker, .field")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    // Read straight off the form: an uncontrolled field cannot have leaked
    // an autofilled value into state earlier in the flow.
    const trap = new FormData(event.currentTarget).get(TRAP_FIELD);
    void submit(typeof trap === "string" ? trap : "");
  };

  if (booked) {
    const inIst = zone === DEFAULT_ZONE;
    return (
      <section className="card is-done">
        <div className="done">
          <div className="done-badge">
            <CheckIcon />
          </div>
          <h2>You&rsquo;re booked, {values.name.trim().split(" ")[0]}.</h2>

          <div className="done-when">
            <CalendarIcon size={18} />
            <div>
              <strong>{slotLabel(booked.start, zone)}</strong>
              <span>
                {offsetLabel(zone)}
                {inIst ? " · IST" : ` · ${slotLabel(booked.start, DEFAULT_ZONE).split(" · ")[1]} IST`}
              </span>
            </div>
          </div>

          <p>
            {booked.emailed
              ? "The details and your Google Meet link are on their way to "
              : "The calendar invite is on its way to "}
            <strong>{values.email.trim()}</strong>.
          </p>

          {booked.meetLink ? (
            <a className="done-link" href={booked.meetLink} target="_blank" rel="noreferrer">
              <VideoIcon />
              Google Meet link
            </a>
          ) : null}
        </div>

        <div className="prep">
          <h3>Before the call</h3>
          <ul>
            {BEFORE_THE_CALL.map((point) => (
              <li key={point}>
                <span className="prep-tick">
                  <CheckIcon size={13} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="card is-booking">
      <form className="booking" onSubmit={handleSubmit} noValidate>
        <div className="pane pane-calendar">
          <div className="picker">
            <div className="picker-head">
              <span className="picker-title">
                <CalendarIcon size={17} />
                Select date &amp; time
              </span>
              <span className="picker-hint">{SLOT_MINUTES} min</span>
            </div>
            {mounted ? (
              <MonthCalendar
                available={available}
                today={today}
                value={values.date}
                onChange={pickDate}
              />
            ) : (
              <div className="cal is-loading" aria-hidden />
            )}
            {errors.date ? <p className="error">{errors.date}</p> : null}
          </div>

          <label className="zone">
            <GlobeIcon />
            <span className="sr-only">Time zone</span>
            <select value={zone} onChange={(event) => pickZone(event.target.value)} disabled={!mounted}>
              {mounted ? (
                zones.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              ) : (
                <option value={DEFAULT_ZONE}>Time zone</option>
              )}
            </select>
            <ChevronDownIcon />
          </label>

          {values.date ? (
            <div className="picker is-times">
              <div className="picker-head">
                <span className="picker-title">
                  <ClockIcon size={17} />
                  {dayLabel(values.date)}
                </span>
                <span className="picker-hint">{offsetLabel(zone)}</span>
              </div>
              <TimePicker date={values.date} zone={zone} value={values.start} onChange={set("start")} />
              {errors.start ? <p className="error">{errors.start}</p> : null}
            </div>
          ) : (
            <p className="picker-empty">Pick a date to see open times.</p>
          )}
        </div>

        <div className="pane pane-form">
          <h2 className="pane-title">Your details</h2>

          <Field
            id="name"
            label="Full name"
            icon={<UserIcon />}
            placeholder="e.g. John Doe"
            autoComplete="name"
            value={values.name}
            onChange={set("name")}
            error={errors.name}
          />
          <Field
            id="phone"
            label="Phone number"
            icon={<PhoneIcon />}
            type="tel"
            inputMode="tel"
            placeholder="e.g. +91 98765 43210"
            autoComplete="tel"
            value={values.phone}
            onChange={set("phone")}
            error={errors.phone}
          />
          <Field
            id="email"
            label="Email"
            icon={<MailIcon />}
            type="email"
            inputMode="email"
            placeholder="e.g. you@company.com"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
            error={errors.email}
          />

          {values.start ? (
            <p className="chosen">
              <ClockIcon size={15} />
              {slotLabel(values.start, zone)}
            </p>
          ) : null}

          {failed ? <p className="error is-banner">{failed}</p> : null}

          {/* Hidden from people, irresistible to bots. See TRAP_FIELD. */}
          <input
            className="trap"
            type="text"
            name={TRAP_FIELD}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            readOnly
            defaultValue=""
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
          />

          <div className="actions">
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? "Booking…" : "Confirm booking"}
              {sending ? null : <ArrowRightIcon />}
            </button>
          </div>

          <p className="privacy">
            <LockIcon />
            Your details stay private. No spam.
          </p>
        </div>

        <aside className="pane pane-about">
          <h3>Free discovery call</h3>
          <ul className="about-meta">
            <li>
              <ClockIcon size={15} />
              {SLOT_MINUTES} min
            </li>
            <li>
              <VideoIcon size={15} />
              Google Meet
            </li>
          </ul>
          <p>
            For growing businesses that run on spreadsheets, WhatsApp groups and too many apps.
          </p>
          <p>
            We&rsquo;ll look at how your business runs today, find where time and money slip
            through the cracks, and see whether a custom ERP or CRM built around your workflow is
            the right fit.
          </p>
          <p>
            You&rsquo;ll leave with clear next steps. If it&rsquo;s a fit, we&rsquo;ll also outline
            scope, timeline and investment.
          </p>
        </aside>
      </form>
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
};

function Field({
  id,
  label,
  icon,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  autoComplete,
}: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`control${error ? " is-invalid" : ""}`}>
        <span className="control-icon">{icon}</span>
        <span className="control-divider" />
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? (
        <p className="error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
