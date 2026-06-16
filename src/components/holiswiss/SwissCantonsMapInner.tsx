import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TFunction } from "i18next";

interface InnerProps {
  cantonPoints: { code: string; name: string; lat: number; lng: number; count: number }[];
  onCantonClick: (code: string) => void;
  t: TFunction;
}

export default function SwissCantonsMapInner({ cantonPoints, onCantonClick, t }: InnerProps) {
  return (
    <MapContainer
      center={[46.82, 8.23]}
      zoom={7}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "#d4e4f7" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
        subdomains="abc"
      />
      {cantonPoints.map((c) => {
        const radius = Math.max(8, Math.min(28, 6 + Math.sqrt(c.count) * 3));
        return (
          <CircleMarker
            key={c.code}
            center={[c.lat, c.lng]}
            radius={radius}
            pathOptions={{
              color: "#7c3aed",
              fillColor: "#b86ef9",
              fillOpacity: 0.65,
              weight: 2.5,
            }}
            eventHandlers={{
              click: () => onCantonClick(c.code),
              mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9, color: "#4c1d95", weight: 3.5 }),
              mouseout: (e) => e.target.setStyle({ fillOpacity: 0.65, color: "#7c3aed", weight: 2.5 }),
            }}
          >
            <Tooltip direction="top" offset={[0, -radius]} opacity={1} permanent={false}>
              <div style={{ fontWeight: 600, color: "#2d1248" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#6d28a8" }}>
                {c.count} {t("home.map.practitioners", "praticiens")}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
