type FieldProps = {
  id: string;
  label: string;
  type: "text" | "email" | "tel";
  value: string;
  error?: string;
  autoComplete: string;
  inputMode?: "text" | "email" | "tel";
  placeholder: string;
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
  onChange,
  onBlur,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-white">
        {label}
      </label>
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
        className={`w-full rounded-xl border bg-ink px-4 py-3 text-white placeholder:text-muted/60 outline-none transition focus:border-white focus:ring-2 focus:ring-white/20 ${
          error ? "border-red-500/70" : "border-line"
        }`}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
