"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { localClock, type ZoneOption } from "@/lib/zones";
import { CheckIcon, ChevronDownIcon, GlobeIcon, SearchIcon } from "./Icons";

type Props = {
  value: string;
  options: ZoneOption[];
  onChange: (zone: string) => void;
  /** True until the browser has worked out the visitor's zone. */
  disabled?: boolean;
};

/** Searchable time zone dropdown: city, zone name, offset and the time there now. */
export default function TimeZonePicker({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const current = options.find((option) => option.value === value);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((option) => words.every((word) => option.search.includes(word)));
  }, [options, query]);

  const openPanel = () => {
    setQuery("");
    setNow(new Date());
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const choose = (zone: string) => {
    onChange(zone);
    setOpen(false);
  };

  // Focus the search box and bring the current zone into view on open.
  useEffect(() => {
    if (!open) return;
    search.current?.focus({ preventScroll: true });
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }, [open]);

  // Close on a click or tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the keyboard highlight visible while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = shown[active];
      if (option) choose(option.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`zone${open ? " is-open" : ""}`} ref={root}>
      <button
        type="button"
        className="zone-trigger"
        onClick={() => (open ? setOpen(false) : openPanel())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `Time zone: ${current.city}, ${current.name}` : "Time zone"}
      >
        <GlobeIcon />
        <span className="zone-current">
          {current ? (
            <>
              <strong>{current.city}</strong>
              <span>{current.name}</span>
            </>
          ) : (
            <span>Time zone</span>
          )}
        </span>
        {current ? <span className="zone-offset">{current.offset}</span> : null}
        <ChevronDownIcon className="zone-caret" />
      </button>

      {open ? (
        <div className="zone-panel">
          <div className="zone-search">
            <SearchIcon />
            <input
              ref={search}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search city or time zone"
              aria-label="Search time zones"
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <ul className="zone-list" id={listId} role="listbox" ref={list} aria-label="Time zones">
            {shown.length === 0 ? (
              <li className="zone-empty">No matching time zones</li>
            ) : (
              shown.map((option, index) => {
                const selected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    className={`zone-option${index === active ? " is-active" : ""}`}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => choose(option.value)}
                  >
                    <span className="zone-option-main">
                      <strong>{option.city}</strong>
                      <span>{option.name}</span>
                    </span>
                    <span className="zone-option-side">
                      <strong>{now ? localClock(now, option.value) : ""}</strong>
                      <span>{option.offset}</span>
                    </span>
                    <span className="zone-option-check">
                      {selected ? <CheckIcon size={15} /> : null}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
