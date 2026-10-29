import type { ReactNode } from "react";

type FieldProps = {
  id: string;
  label: string;
  type: "text" | "email" | "tel";
  value: string;
  error?: string;
  autoComplete: string;
  inputMode?: "text" | "email" | "tel";
  placeholder: string;
  icon: ReactNode;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export function Field({
  id,
  label,
  type,
  value,
  error,
  autoComplete,
  inputMode,
  placeholder,
  icon,
  onChange,
  onBlur,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.8rem] font-medium tracking-wide text-muted">
        {label}
      </label>

      <div className="group relative">
        <span
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
            error ? "text-red-400" : "text-muted group-focus-within:text-white"
          }`}
        >
          {icon}
        </span>

        <input
          id={id}
          name={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-xl border bg-ink/60 py-3.5 pl-11 pr-4 text-white outline-none transition placeholder:text-muted/50 focus:bg-ink ${
            error
              ? "border-red-500/60 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
              : "border-line focus:border-accent/70 focus:ring-2 focus:ring-accent/25"
          }`}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
