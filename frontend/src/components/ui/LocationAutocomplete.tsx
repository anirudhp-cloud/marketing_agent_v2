import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DEBOUNCE_MS = 150;

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface LocationResult {
  label: string;
  type: string;
}

interface LocationItem {
  label: string;
  type: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Delhi, Mumbai, Bangalore",
  className,
}: LocationAutocompleteProps) {
  const [inputText, setInputText] = useState("");
  const [suggestions, setSuggestions] = useState<LocationItem[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse the pipe-separated value into tokens
  const selectedPlaces = useMemo(
    () =>
      value
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search via backend API
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const search = useCallback((query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({ q, limit: "8" });
        const resp = await fetch(`${API_URL}/api/locations/search?${params}`, {
          signal: controller.signal,
        });
        if (!resp.ok) return;
        const data: LocationResult[] = await resp.json();
        setSuggestions(data.map((d) => ({ label: d.label, type: d.type })));
        setHighlightIdx(-1);
        setOpen(data.length > 0);
      } catch {
        // Aborted or network error — ignore
      }
    }, DEBOUNCE_MS);
  }, []);

  const addPlace = useCallback(
    (place: string) => {
      const trimmed = place.trim();
      if (!trimmed) return;
      // Avoid duplicates
      if (selectedPlaces.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
        setInputText("");
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const newPlaces = [...selectedPlaces, trimmed];
      onChange(newPlaces.join(" | "));
      setInputText("");
      setSuggestions([]);
      setOpen(false);
      // Refocus so user can keep typing
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [selectedPlaces, onChange],
  );

  const removePlace = useCallback(
    (idx: number) => {
      const newPlaces = selectedPlaces.filter((_, i) => i !== idx);
      onChange(newPlaces.join(" | "));
    },
    [selectedPlaces, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        addPlace(suggestions[highlightIdx].label);
      } else if (inputText.trim()) {
        addPlace(inputText.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && inputText === "" && selectedPlaces.length > 0) {
      removePlace(selectedPlaces.length - 1);
    }
  };

  const typeIcon = (type: string) => {
    if (type === "country") return "🌍";
    if (type === "state") return "📍";
    if (type === "district" || type === "sub-district") return "🏛️";
    if (type === "suburb" || type === "neighbourhood") return "🏘️";
    if (type === "water") return "💧";
    if (type === "terrain") return "⛰️";
    if (type === "landmark") return "📌";
    if (type === "capital") return "⭐";
    return "🏙️";
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Tags + Input area */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 bg-ink-3 border border-rim rounded-r2 px-3 py-2 min-h-[42px] cursor-text transition-all focus-within:border-coral/45 focus-within:shadow-[0_0_0_3px_var(--accent-glow-xs)]",
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedPlaces.map((place, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[0.78rem] font-medium bg-coral/10 text-coral border border-coral/20 whitespace-nowrap"
          >
            {place}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removePlace(i);
              }}
              className="ml-0.5 text-coral/60 hover:text-coral transition-colors text-[0.7rem] leading-none"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            search(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputText.trim().length >= 2) search(inputText);
          }}
          placeholder={selectedPlaces.length === 0 ? placeholder : "Add more…"}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-fg text-sm placeholder:text-fg-3"
        />
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-ink-2 border border-rim rounded-r2 shadow-[0_8px_32px_rgba(0,0,0,0.25)] overflow-hidden max-h-[260px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addPlace(s.label);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                i === highlightIdx ? "bg-coral/10 text-coral" : "text-fg-2 hover:bg-glass-2",
              )}
            >
              <span className="text-base flex-shrink-0">{typeIcon(s.type)}</span>
              <span className="truncate">{s.label}</span>
              <span className="ml-auto text-[0.65rem] text-fg-3 uppercase tracking-wider flex-shrink-0">
                {s.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
