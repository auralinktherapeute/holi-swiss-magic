import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { autocompleteSwissAddress } from "@/lib/google-places.functions";

type Suggestion = { id: string; primary: string; secondary: string };

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  countries?: string[]; // ISO 3166-1 alpha-2
  className?: string;
};

export function AddressAutocomplete({ id, value, onChange, placeholder, countries = ["ch"], className }: Props) {
  const fetchSuggestions = useServerFn(autocompleteSwissAddress);
  const reactId = useId();
  const inputId = id ?? reactId;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string>("");
  const requestRef = useRef(0);
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionTokenRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!v.trim() || v.trim().length < 3) {
      setSuggestions([]); setOpen(false); return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const requestId = ++requestRef.current;
      try {
        setLoading(true);
        setError(null);
        const result = await fetchSuggestions({
          data: {
            query: v,
            sessionToken: sessionTokenRef.current || crypto.randomUUID(),
            countries,
          },
        });
        if (requestId !== requestRef.current) return;
        const mapped: Suggestion[] = result.suggestions;
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch (e: unknown) {
        if (requestId !== requestRef.current) return;
        setSuggestions([]);
        setOpen(false);
        setError(e instanceof Error ? e.message : "Erreur d'autocomplétion");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 300);
  }

  function selectSuggestion(s: Suggestion) {
    const full = s.secondary ? `${s.primary}, ${s.secondary}` : s.primary;
    onChange(full);
    setOpen(false);
    setSuggestions([]);
    sessionTokenRef.current = crypto.randomUUID();
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => selectSuggestion(s)}
                className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block font-medium">{s.primary}</span>
                  {s.secondary && <span className="block text-xs text-muted-foreground">{s.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-1 text-xs text-muted-foreground">Autocomplétion indisponible — saisie libre.</p>
      )}
    </div>
  );
}