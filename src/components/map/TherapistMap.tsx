import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import { Star, ArrowRight, Navigation } from "lucide-react";

// Fix Leaflet default icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Therapist = {
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

type Props = {
  therapists: Therapist[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: string;
};

function createMarkerIcon(therapist: Therapist, isSelected: boolean) {
  const border = isSelected ? "#5cc8fa" : "#b86ef9";
  const glow = isSelected ? "0 0 12px 3px rgba(92,200,250,0.6)" : "0 0 8px 2px rgba(184,110,249,0.4)";
  const initials = `${therapist.first_name[0]}${therapist.last_name[0]}`.toUpperCase();

  const html = therapist.photo_url
    ? `<div style="width:44px;height:44px;border-radius:50%;border:2.5px solid ${border};box-shadow:${glow};overflow:hidden;background:#1a1035">
        <img src="${therapist.photo_url}" style="width:100%;height:100%;object-fit:cover" />
       </div>`
    : `<div style="width:44px;height:44px;border-radius:50%;border:2.5px solid ${border};box-shadow:${glow};background:linear-gradient(135deg,#3d1a5c,#1a1035);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#b86ef9">
        ${initials}
       </div>`;

  return L.divIcon({ html, className: "", iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24] });
}

function GeoButton() {
  const map = useMap();
  return (
    <button
      onClick={() => map.locate({ setView: true, maxZoom: 12 })}
      className="absolute bottom-20 right-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(184,110,249,0.4)] bg-[#1a1035]/90 text-[#b86ef9] shadow-lg backdrop-blur hover:bg-[#2d1248] transition"
      title="Près de moi"
    >
      <Navigation className="h-4 w-4" />
    </button>
  );
}

function FlyToSelected({ therapists, selectedId }: { therapists: Therapist[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const t = therapists.find((x) => x.id === selectedId);
    if (t?.latitude && t?.longitude) {
      map.flyTo([t.latitude, t.longitude], 13, { duration: 0.8 });
    }
  }, [selectedId, therapists, map]);
  return null;
}

export function TherapistMap({ therapists, selectedId, onSelect, lang }: Props) {
  const positioned = therapists.filter((t) => t.latitude && t.longitude);
  const center: [number, number] =
    positioned.length > 0
      ? [
          positioned.reduce((s, t) => s + t.latitude!, 0) / positioned.length,
          positioned.reduce((s, t) => s + t.longitude!, 0) / positioned.length,
        ]
      : [46.8, 8.2]; // Centre Suisse

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={8}
        style={{ height: "100%", width: "100%", background: "#0f0a1e" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <FlyToSelected therapists={positioned} selectedId={selectedId} />
        <GeoButton />
        {positioned.map((t) => (
          <Marker
            key={t.id}
            position={[t.latitude!, t.longitude!]}
            icon={createMarkerIcon(t, t.id === selectedId)}
            eventHandlers={{ click: () => onSelect(t.id) }}
          >
            <Popup
              closeButton={false}
              className="holiswiss-popup"
            >
              <div
                style={{
                  background: "#1a1035",
                  border: "1px solid rgba(184,110,249,0.35)",
                  borderRadius: 12,
                  padding: "12px",
                  minWidth: 200,
                  maxWidth: 240,
                  boxShadow: "0 8px 32px rgba(184,110,249,0.2)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  {t.photo_url ? (
                    <img src={t.photo_url} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #b86ef9", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#3d1a5c,#1a1035)", border: "2px solid #b86ef9", display: "flex", alignItems: "center", justifyContent: "center", color: "#b86ef9", fontWeight: 700, flexShrink: 0 }}>
                      {t.first_name[0]}
                    </div>
                  )}
                  <div>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>{t.first_name} {t.last_name}</p>
                    {t.title && <p style={{ color: "#b86ef9", fontSize: 12, margin: 0 }}>{t.title}</p>}
                  </div>
                </div>
                {t.city && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "0 0 8px 0" }}>📍 {t.city}</p>}
                {t.price_min && (
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "0 0 8px 0" }}>
                    À partir de {t.price_min} {t.currency ?? "CHF"}
                  </p>
                )}
                <a
                  href={`/${lang}/therapeute/${t.slug}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    color: "#5cc8fa", fontSize: 12, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Voir le profil →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .leaflet-container { background: #0f0a1e; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .holiswiss-popup .leaflet-popup-content-wrapper { padding: 0; }
      `}</style>
    </div>
  );
}
