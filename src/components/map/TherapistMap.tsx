import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

const TherapistMapInner = lazy(() =>
  import("./TherapistMapInner").then((m) => ({ default: m.TherapistMapInner })),
);

export type TherapistMapTherapist = {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  title?: string;
  photo_url?: string;
  city?: string;
  canton?: string;
  latitude?: number;
  longitude?: number;
  price_min?: number;
  currency?: string;
  is_premium?: boolean;
  verified?: boolean;
  specialties?: string[];
};

export type TherapistMapProps = {
  therapists: TherapistMapTherapist[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: string;
};

function MapFallback() {
  return (
    <div className="h-full w-full rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e]" />
  );
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Therapist map failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return <MapFallback />;
    return this.props.children;
  }
}

export function TherapistMap(props: TherapistMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <MapFallback />;

  return (
    <MapErrorBoundary>
      <Suspense fallback={<MapFallback />}>
        <TherapistMapInner {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}
