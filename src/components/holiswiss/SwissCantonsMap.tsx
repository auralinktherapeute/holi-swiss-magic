import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

// Approximate cantonal centroids (lat, lng)
const CANTON_POINTS: { code: string; name: string; lat: number; lng: number; count: number }[] = [
  { code: "GE", name: "Genève", lat: 46.21, lng: 6.14, count: 42 },
  { code: "VD", name: "Vaud", lat: 46.62, lng: 6.55, count: 58 },
  { code: "VS", name: "Valais", lat: 46.23, lng: 7.36, count: 21 },
  { code: "FR", name: "Fribourg", lat: 46.80, lng: 7.15, count: 17 },
  { code: "NE", name: "Neuchâtel", lat: 46.99, lng: 6.93, count: 12 },
  { code: "JU", name: "Jura", lat: 47.35, lng: 7.16, count: 6 },
  { code: "BE", name: "Berne", lat: 46.95, lng: 7.45, count: 34 },
  { code: "SO", name: "Soleure", lat: 47.21, lng: 7.54, count: 8 },
  { code: "BS", name: "Bâle-Ville", lat: 47.56, lng: 7.59, count: 19 },
  { code: "BL", name: "Bâle-Campagne", lat: 47.45, lng: 7.74, count: 11 },
  { code: "AG", name: "Argovie", lat: 47.39, lng: 8.05, count: 15 },
  { code: "LU", name: "Lucerne", lat: 47.05, lng: 8.31, count: 18 },
  { code: "ZG", name: "Zoug", lat: 47.17, lng: 8.52, count: 7 },
  { code: "ZH", name: "Zurich", lat: 47.38, lng: 8.54, count: 61 },
  { code: "SH", name: "Schaffhouse", lat: 47.70, lng: 8.63, count: 4 },
  { code: "TG", name: "Thurgovie", lat: 47.55, lng: 9.05, count: 9 },
  { code: "SG", name: "Saint-Gall", lat: 47.42, lng: 9.37, count: 16 },
  { code: "AR", name: "Appenzell Rh.-Ext.", lat: 47.36, lng: 9.30, count: 3 },
  { code: "AI", name: "Appenzell Rh.-Int.", lat: 47.32, lng: 9.41, count: 2 },
  { code: "GL", name: "Glaris", lat: 47.04, lng: 9.07, count: 4 },
  { code: "SZ", name: "Schwytz", lat: 47.02, lng: 8.65, count: 6 },
  { code: "UR", name: "Uri", lat: 46.77, lng: 8.63, count: 3 },
  { code: "OW", name: "Obwald", lat: 46.88, lng: 8.25, count: 2 },
  { code: "NW", name: "Nidwald", lat: 46.93, lng: 8.39, count: 3 },
  { code: "GR", name: "Grisons", lat: 46.66, lng: 9.58, count: 13 },
  { code: "TI", name: "Tessin", lat: 46.20, lng: 8.80, count: 22 },
];

// Lazy-load react-leaflet so it never runs during SSR
const LazyMap = lazy(() => import("./SwissCantonsMapInner"));

export function SwissCantonsMap() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const total = CANTON_POINTS.reduce((s, c) => s + c.count, 0);

  return (
    <section className="bg-[#f3f0fa]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#2d1248] sm:text-3xl">
            {t("home.map.title", "Trouvez un thérapeute près de chez vous")}
          </h2>
          <p className="mt-2 text-sm text-[#5b4a6e]">
            {t("home.map.subtitle", "{{count}} praticiens vérifiés dans les 26 cantons suisses", { count: total })}
          </p>
        </div>

        <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.25)] shadow-[0_0_40px_rgba(184,110,249,0.15)]">
          {isClient ? (
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-[#eae5f3]">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b86ef9] border-t-transparent" />
                </div>
              }
            >
              <LazyMap
                cantonPoints={CANTON_POINTS}
                onCantonClick={(code: string) =>
                  navigate({ to: "/$lang/therapeutes", params: { lang }, search: { canton: code } as any })
                }
                t={t}
              />
            </Suspense>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#eae5f3]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b86ef9] border-t-transparent" />
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-[#5b4a6e]/70">
          {t("home.map.hint", "Cliquez sur un canton pour voir les thérapeutes disponibles")}
        </p>
      </div>
    </section>
  );
}
