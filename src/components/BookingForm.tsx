"use client";

import { useState } from "react";

import { toISTDayLabel } from "@/lib/slots";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  VideoIcon,
} from "./Icons";

const TOTAL_STEPS = 2;

/**
 * Honeypot field name. Deliberately meaningless — but the name is not what
 * saves it. Accepting a Chrome autofill suggestion on any field fills every
 * other field Chrome thinks it can, whatever they are called, which quietly
 * flagged real visitors as bots. `readOnly` is the part that actually works:
 * browsers refuse to autofill a read-only input, while a script setting
 * `.value` directly — what a bot does — is unaffected.
 */
const TRAP_FIELD = "contact_ref_id";

type Step = 1 | 2;

type Values = {
  name: string;
  phone: string;
  email: string;
  date: string;
  start: string;
};

type Errors = Partial<Record<keyof Values, string>>;

type Booked = {
  startLabel: string;
  meetLink: string | null;
  emailed: boolean;
};

const empty: Values = { name: "", phone: "", email: "", date: "", start: "" };

function validateDetails(values: Values): Errors {
  const errors: Errors = {};

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

export default function BookingForm() {
  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);

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
        startLabel: data.startLabel ?? "",
        meetLink: data.meetLink ?? null,
        emailed: Boolean(data.emailed),
      });
    } catch {
      setFailed("Could not reach the server. Please check your connection.");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 1) {
      const found = validateDetails(values);
      setErrors(found);
      if (Object.keys(found).length === 0) setStep(2);
      return;
    }

    if (!values.date) {
      setErrors({ date: "Please pick a date." });
      return;
    }
    if (!values.start) {
      setErrors({ start: "Please pick a time." });
      return;
    }
    setErrors({});

    // Read straight off the form: an uncontrolled field cannot have leaked
    // an autofilled value into state earlier in the flow.
    const trap = new FormData(event.currentTarget).get(TRAP_FIELD);
    void submit(typeof trap === "string" ? trap : "");
  };

  if (booked) {
    return (
      <section className="card">
        <div className="done">
          <div className="done-badge">
            <CheckIcon />
          </div>
          <h2>You&rsquo;re booked, {values.name.trim().split(" ")[0]}.</h2>
          <p>
            {booked.startLabel ? <strong>{booked.startLabel} IST</strong> : "Your meeting is set"} —
            {booked.emailed
              ? " the details and your Google Meet link are on their way to "
              : " the calendar invite is on its way to "}
            {values.email.trim()}.
          </p>
          {booked.meetLink ? (
            <a className="done-link" href={booked.meetLink} target="_blank" rel="noreferrer">
              <VideoIcon />
              Google Meet link
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-top">
        <span className="step-label">
          Step <b>{String(step).padStart(2, "0")}</b> / {String(TOTAL_STEPS).padStart(2, "0")}
        </span>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${TOTAL_STEPS}`}
        >
          <span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {step === 1 ? (
          <>
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
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="picker">
              <div className="picker-head">
                <span className="picker-title">
                  <CalendarIcon size={17} />
                  Pick a date
                </span>
                <span className="picker-hint">30 min · IST</span>
              </div>
              <DatePicker value={values.date} onChange={pickDate} />
              {errors.date ? <p className="error">{errors.date}</p> : null}
            </div>

            {/* Times only make sense once there is a day to look them up for. */}
            {values.date ? (
              <div className="picker is-times">
                <div className="picker-head">
                  <span className="picker-title">
                    <ClockIcon size={17} />
                    Pick a time
                  </span>
                  <span className="picker-hint">{toISTDayLabel(values.date)}</span>
                </div>
                <TimePicker date={values.date} value={values.start} onChange={set("start")} />
                {errors.start ? <p className="error">{errors.start}</p> : null}
              </div>
            ) : null}
          </>
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
          {step > 1 ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStep((step - 1) as Step)}
              disabled={sending}
            >
              <ArrowLeftIcon />
              Back
            </button>
          ) : null}
          <button type="submit" className="btn-primary" disabled={sending}>
            {step === TOTAL_STEPS ? (sending ? "Booking…" : "Confirm booking") : "Continue"}
            {sending ? null : <ArrowRightIcon />}
          </button>
        </div>
      </form>

      <p className="privacy">
        <LockIcon />
        Your details stay private. No spam.
      </p>
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
