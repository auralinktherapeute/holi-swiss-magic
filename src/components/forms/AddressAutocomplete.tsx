import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

type Suggestion = { id: string; primary: string; secondary: string };

let loaderPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!KEY) return Promise.reject(new Error("Missing Google Maps browser key"));
  loaderPromise = new Promise<void>((resolve, reject) => {
    (window as any).__lovableInitMaps = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: KEY,
      v: "weekly",
      libraries: "places",
      loading: "async",
      callback: "__lovableInitMaps",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  countries?: string[]; // ISO 3166-1 alpha-2
  className?: string;
};

export function AddressAutocomplete({ id, value, onChange, placeholder, countries = ["ch"], className }: Props) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then(async () => {
        const { AutocompleteSessionToken } = (await (window as any).google.maps.importLibrary("places"));
        if (!mounted) return;
        sessionTokenRef.current = new AutocompleteSessionToken();
        setReady(true);
      })
      .catch((e) => mounted && setError(e.message));
    return () => { mounted = false; };
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
    if (!ready) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!v.trim() || v.trim().length < 3) {
      setSuggestions([]); setOpen(false); return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const { AutocompleteSuggestion } = (await (window as any).google.maps.importLibrary("places"));
        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: v,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: countries,
          language: "fr",
        });
        const mapped: Suggestion[] = (results || [])
          .map((s: any) => {
            const p = s.placePrediction;
            if (!p) return null;
            return {
              id: p.placeId,
              primary: p.mainText?.toString() ?? p.text?.toString() ?? "",
              secondary: p.secondaryText?.toString() ?? "",
            };
          })
          .filter(Boolean) as Suggestion[];
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch (e: any) {
        setError(e?.message ?? "Erreur d'autocomplétion");
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  function selectSuggestion(s: Suggestion) {
    const full = s.secondary ? `${s.primary}, ${s.secondary}` : s.primary;
    onChange(full);
    setOpen(false);
    setSuggestions([]);
    // Renew session token for billing-optimal sessions
    (window as any).google?.maps?.importLibrary("places").then(({ AutocompleteSessionToken }: any) => {
      sessionTokenRef.current = new AutocompleteSessionToken();
    });
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
      {error && !KEY && (
        <p className="mt-1 text-xs text-muted-foreground">Autocomplétion indisponible — saisie libre.</p>
      )}
    </div>
  );
}