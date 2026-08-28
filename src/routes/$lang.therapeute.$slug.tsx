import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { buildGeneratedSeoTitle, resolveSeoTitle } from "@/lib/seo-title";
import { resolveSeoDescription, truncateSeoDescription } from "@/lib/seo-description";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, lazy, Suspense, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logTherapistProfileView } from "@/lib/analytics.functions";
import { getCurrentAnalyticsSessionId } from "@/hooks/use-session-tracking";
import { cn } from "@/lib/utils";
import {
  MapPin, Star, BadgeCheck, Globe, Share2,
  Shield, ChevronUp, Calendar, ArrowRight, FileText,
} from "lucide-react";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { getTherapistBySlug } from "@/lib/public.functions";
import { getPublicFaqs } from "@/lib/therapist-faq.functions";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { FavoriteButton } from "@/components/holiswiss/FavoriteButton";
import { ItineraryButton } from "@/components/holiswiss/ItineraryButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Clock, Package as PackageIcon, Sparkles, Video, Users } from "lucide-react";
import { SPOKEN_LANGUAGES } from "@/lib/constants";
import { hreflangLinks, ogLocale, profileCopy, resolveProfileLang } from "@/lib/seo";
import { TrustBadges } from "@/components/holiswiss/TrustBadges";
import { CertificationsShowcase } from "@/components/holiswiss/CertificationsShowcase";
import { buildTrustBadges, isProPlan } from "@/lib/therapist-badges";
import { SocialLinksRow } from "@/components/holiswiss/SocialLinksRow";

const LANG_FLAG: Record<string, string> = {
  fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", en: "🇬🇧", es: "🇪🇸", pt: "🇵🇹",
  ru: "🇷🇺", ar: "🇸🇦", zh: "🇨🇳", ja: "🇯🇵", nl: "🇳🇱", tr: "🇹🇷",
};

const TherapistMiniMap = lazy(() =>
  import("@/components/map/TherapistMap").then((m) => ({ default: m.TherapistMap }))
);

const SITE = "https://holiswiss.ch";

export const Route = createFileRoute("/$lang/therapeute/$slug")({
  component: Page,
  loader: async ({ params }) => {
    try {
      const { therapist, reviews, certifications, articles, events } = await getTherapistBySlug({
        data: { slug: params.slug },
      });
      // FAQ : lecture séparée et tolérante. La RLS filtre déjà sur l'activation
      // et le statut du praticien — un échec ici ne doit pas priver le visiteur
      // de toute la fiche.
      let faqs: Array<{ question: string; answer: string }> = [];
      try {
        const r = await getPublicFaqs({ data: { slug: params.slug } });
        faqs = r.faqs ?? [];
      } catch { /* fiche servie sans FAQ */ }
      return {
        therapist,
        reviews: reviews ?? [],
        certifications: certifications ?? [],
        articles: articles ?? [],
        events: events ?? [],
        faqs,
      };
    } catch {
      return { therapist: null, reviews: [], certifications: [], articles: [], events: [], faqs: [] };
    }
  },

  head: ({ params, loaderData }) => {
    const t = loaderData?.therapist as
      | {
          id?: string;
          first_name?: string;
          last_name?: string;
          title?: string;
          city?: string;
          canton?: string;
          bio?: string;
          short_bio?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          photo_url?: string;
          address?: string | null;
          postal_code?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          website?: string | null;
          price_min?: number | null;
          price_max?: number | null;
          currency?: string | null;
          languages?: string[] | null;
          specialties?: string[] | null;
          years_experience?: number | null;
          phone?: string | null;
          services?: Array<{
            name?: string;
            description?: string;
            short_description?: string;
            price?: number;
            price_chf?: number;
            duration_min?: number;
            duration?: number;
            format?: string;
            kind?: "session" | "package";
            visible?: boolean;
          }> | null;
        }
      | null
      | undefined;
    const reviews = ((loaderData as any)?.reviews ?? []) as Array<{
      id: string;
      rating: number;
      comment: string | null;
      author_name: string | null;
      created_at: string;
    }>;
    const url = `${SITE}/${params.lang}/therapeute/${params.slug}`;
    const altLinks = hreflangLinks(`/therapeute/${params.slug}`);
    /**
     * Langue de RÉDACTION de la fiche, indépendante de l'URL consultée.
     *
     * La table `therapists` n'a aucune colonne de traduction : bio, titre et méta
     * sont uniques. Les quatre URL de langue servaient donc le même texte, chacune
     * se déclarant canonique et alternative des trois autres — Google a tranché seul
     * et a consolidé vers le français (variantes DE/EN/IT marquées `canonical_other`).
     *
     * On ne redirige pas : l'habillage d'interface est bien traduit, une fiche reste
     * donc utile dans les quatre langues. Mais une seule est indexable — les autres
     * pointent leur canonical vers elle, et on n'annonce plus de hreflang, qui
     * suppose des traductions véritables. Le jour où la fiche sera réellement
     * traduite, il faudra rétablir `altLinks` et le canonical auto-référent.
     */
    const contentLang = resolveProfileLang(null, (t as any)?.canton, (t as any)?.languages ?? null);
    const canonicalUrl = `${SITE}/${contentLang}/therapeute/${params.slug}`;
    // Pas de hreflang ici, même sur la version canonique : un cluster hreflang
    // suppose que chaque membre est canonique de lui-même. Les annoncer tout en
    // les canonicalisant ailleurs enverrait deux signaux contraires.
    const seoLinks = [{ rel: "canonical" as const, href: canonicalUrl }];
    if (!t) {
      const c0 = profileCopy(params.lang);
      return {
        meta: [
          { title: c0.genericTitle },
          { name: "description", content: c0.genericDescription },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }, ...altLinks],
      };
    }
    const fullName = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim();
    // SEO local : la langue de la version consultée pilote les libellés
    // générés (« Therapeut in Zürich », « Thérapeute à Genève »). Les textes
    // rédigés par le praticien (bio, approche) ne sont jamais traduits.
    const pageLang = resolveProfileLang(params.lang, t.canton, t.languages ?? null);
    const copy = profileCopy(pageLang);
    const place = [t.city, t.canton].filter(Boolean).join(", ");
    const role = copy.role(t.title ?? copy.fallbackRole, place);
    const title = resolveSeoTitle(
      t.meta_title,
      buildGeneratedSeoTitle({
        first_name: t.first_name,
        last_name: t.last_name,
        title: t.title,
        city: t.city,
        canton: t.canton,
        roleLabel: role,
      }),
    ).value;
    const fallback = copy.descFallback(fullName, role);
    // Même résolution que l'audit de visibilité et que l'aperçu SEO du dashboard.
    const description = truncateSeoDescription(
      resolveSeoDescription({
        meta_description: t.meta_description,
        bio: t.bio,
        short_bio: t.short_bio,
        fallback,
      }).value,
    );
    const image = t.photo_url;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { property: "og:locale", content: ogLocale(pageLang) },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    const personId = `${url}#person`;
    const address =
      t.address || t.city || t.canton || t.postal_code
        ? {
            "@type": "PostalAddress",
            streetAddress: t.address ?? undefined,
            postalCode: t.postal_code ?? undefined,
            addressLocality: t.city ?? undefined,
            addressRegion: t.canton ?? undefined,
            addressCountry: t.country ?? "CH",
          }
        : undefined;
    const cur = t.currency ?? "CHF";
    const priceRange = t.price_min
      ? t.price_max
        ? `${t.price_min}–${t.price_max} ${cur}`
        : `${t.price_min} ${cur}`
      : undefined;

    // Person — l'entité principale du profil
    const person: Record<string, unknown> = {
      "@type": "Person",
      "@id": personId,
      name: fullName || copy.fallbackRole,
      url,
      description,
    };
    if (image) person.image = image;
    if (t.title) person.jobTitle = t.title;
    if (address) person.address = address;
    if (typeof t.latitude === "number" && typeof t.longitude === "number") {
      (person as any).homeLocation = {
        "@type": "Place",
        geo: { "@type": "GeoCoordinates", latitude: t.latitude, longitude: t.longitude },
      };
    }
    if (t.canton) person.workLocation = { "@type": "AdministrativeArea", name: t.canton };
    if (Array.isArray(t.languages) && t.languages.length) person.knowsLanguage = t.languages;
    if (Array.isArray(t.specialties) && t.specialties.length) person.knowsAbout = t.specialties;
    if (t.phone) person.telephone = t.phone;
    if (t.website) person.sameAs = [t.website];
    person.worksFor = { "@id": "https://holiswiss.ch/#organization" };
    (person as any).inLanguage = pageLang;

    // hasCredential : uniquement les certifications réellement vérifiées et
    // affichées sur la page. Aucune donnée déclarative n'est balisée.
    const verifiedCerts = (((loaderData as any)?.certifications ?? []) as Array<{
      name?: string | null;
      issuer?: string | null;
      verification_status?: string | null;
      expires_at?: string | null;
    }>).filter(
      (c) =>
        c?.verification_status === "verified" &&
        (c.name ?? "").trim().length > 0 &&
        (!c.expires_at || Date.parse(c.expires_at) >= Date.now()),
    );
    if (verifiedCerts.length) {
      (person as any).hasCredential = verifiedCerts.slice(0, 10).map((c) => ({
        "@type": "EducationalOccupationalCredential",
        name: c.name,
        ...(c.issuer ? { recognizedBy: { "@type": "Organization", name: c.issuer } } : {}),
      }));
    }

    // AggregateRating + Reviews — uniquement si des avis approuvés existent
    const ratings = reviews.map((r) => r.rating).filter((n) => typeof n === "number");
    if (ratings.length > 0) {
      const avg = ratings.reduce((s, n) => s + n, 0) / ratings.length;
      person.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Math.round(avg * 10) / 10,
        reviewCount: ratings.length,
        bestRating: 5,
        worstRating: 1,
      };
      person.review = reviews.slice(0, 10).map((r) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: { "@type": "Person", name: r.author_name || "Client" },
        datePublished: r.created_at,
        reviewBody: (r.comment ?? "").slice(0, 800),
      }));
    }

    // Service[] — un noeud par prestation visible
    const rawServices = Array.isArray(t.services) ? t.services : [];
    const serviceNodes = rawServices
      .filter((s) => s && s.visible !== false && (s.name ?? "").trim().length > 0)
      .slice(0, 20)
      .map((s, i) => {
        const price = typeof s.price_chf === "number" ? s.price_chf : typeof s.price === "number" ? s.price : undefined;
        const node: Record<string, unknown> = {
          "@type": "Service",
          "@id": `${url}#service-${i}`,
          name: s.name,
          serviceType: s.name,
          provider: { "@id": personId },
          areaServed: t.canton
            ? { "@type": "AdministrativeArea", name: t.canton }
            : { "@type": "Country", name: "Switzerland" },
        };
        const desc = (s.description ?? s.short_description ?? "").trim();
        if (desc) node.description = desc.slice(0, 500);
        if (price != null) {
          node.offers = {
            "@type": "Offer",
            price: price,
            priceCurrency: cur,
            availability: "https://schema.org/InStock",
            url,
          };
        }
        return node;
      });

    // BreadcrumbList — reflète la navigation réelle
    const breadcrumbs = {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: copy.breadcrumbHome, item: `${SITE}/${params.lang}` },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.breadcrumbList,
          item: `${SITE}/${params.lang}/therapeutes`,
        },
        { "@type": "ListItem", position: 3, name: fullName, item: url },
      ],
    };

    // LocalBusiness — l'établissement physique, si une adresse réelle existe
    const businessNodes: Array<Record<string, unknown>> = [];
    if (address && (t.city || t.address)) {
      const business: Record<string, unknown> = {
        "@type": "HealthAndBeautyBusiness",
        "@id": `${url}#business`,
        name: fullName || copy.fallbackRole,
        url,
        description,
        address,
        areaServed: t.canton
          ? { "@type": "AdministrativeArea", name: t.canton }
          : { "@type": "Country", name: "Switzerland" },
        employee: { "@id": personId },
      };
      if (image) business.image = image;
      if (t.phone) business.telephone = t.phone;
      if (t.website) business.sameAs = [t.website];
      if (priceRange) business.priceRange = priceRange;
      if (typeof t.latitude === "number" && typeof t.longitude === "number") {
        business.geo = {
          "@type": "GeoCoordinates",
          latitude: t.latitude,
          longitude: t.longitude,
        };
      }
      if (Array.isArray(t.languages) && t.languages.length) business.knowsLanguage = t.languages;
      if (person.aggregateRating) business.aggregateRating = person.aggregateRating;
      businessNodes.push(business);
    }

    // FAQPage : bâtie sur les MÊMES questions que celles rendues en HTML —
    // jamais de balisage sans contrepartie visible sur la page.
    const faqList = ((loaderData as any)?.faqs ?? []) as Array<{ question: string; answer: string }>;
    const faqNode = faqList.length > 0 ? [{
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqList.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    }] : [];

    const graph: Array<Record<string, unknown>> = [person, ...businessNodes, ...serviceNodes, ...faqNode, breadcrumbs];
    const ld = { "@context": "https://schema.org", "@graph": graph };
    return {
      meta,
      links: seoLinks,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(ld),
        },
      ],
    };
  },
});

type ServiceEntry = { name: string; duration?: number; duration_min?: number; price?: number; price_chf?: number; format?: string; color?: string; description?: string; short_description?: string; kind?: "session" | "package"; visible?: boolean };
type AccreditationEntry = { org: string; number?: string };

const FADE_UP = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function StarRow({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-${size} w-${size} ${n <= rating ? "fill-amber-400 text-amber-400" : "text-[rgba(255,255,255,0.2)]"}`}
        />
      ))}
    </span>
  );
}

type ContentCardProps = {
  imageUrl: string | null;
  alt: string;
  to: string;
  params: Record<string, string>;
  badge?: string | null;
  title: string;
  meta?: string;
  description?: string | null;
  cta: string;
  index: number;
  placeholderIcon?: "calendar" | "article";
  compact?: boolean;
};

function ContentCard({
  imageUrl,
  alt,
  to,
  params,
  badge,
  title,
  meta,
  description,
  cta,
  index,
  placeholderIcon = "article",
  compact = false,
}: ContentCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const PlaceholderIcon = placeholderIcon === "calendar" ? Calendar : FileText;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: compact ? 10 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * (compact ? 0.05 : 0.08), ease: [0.16, 1, 0.3, 1] }}
      whileHover={shouldReduceMotion ? undefined : { y: compact ? -4 : -6 }}
      className="group"
    >
      <Link
        to={to}
        params={params}
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[rgba(255,255,255,0.03)] transition-all duration-300 hover:border-[rgba(184,110,249,0.45)] hover:bg-[rgba(255,255,255,0.055)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b86ef9]",
          compact ? "hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]" : "hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]"
        )}
      >
        <div className={cn("relative overflow-hidden", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2d1248] via-[#231040] to-[#1a0a2e]">
              <PlaceholderIcon className={cn("text-[rgba(184,110,249,0.35)]", compact ? "h-7 w-7" : "h-10 w-10")} />
            </div>
          )}
          <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(10,4,20,0.88)] to-transparent", compact ? "h-14" : "h-24")} />
          {badge && (
            <span className={cn(
              "absolute left-3 top-3 rounded-full bg-[rgba(184,110,249,0.92)] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm",
              compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
            )}>
              {badge}
            </span>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-4")}>
          {meta && (
            <div className={cn("flex items-center gap-2 text-[rgba(255,255,255,0.55)]", compact ? "mb-1.5 text-[10px]" : "mb-2 text-xs")}>
              <Calendar className={cn("shrink-0 text-[rgba(184,110,249,0.7)]", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
              <span className="truncate">{meta}</span>
            </div>
          )}

          <h3 className={cn(
            "line-clamp-2 font-semibold leading-snug text-white transition-colors group-hover:text-[#d5b0ff]",
            compact ? "mb-1.5 text-sm" : "mb-2 text-base"
          )}>
            {title}
          </h3>

          {description && (
            <p className={cn(
              "line-clamp-2 flex-1 leading-relaxed text-[rgba(255,255,255,0.62)]",
              compact ? "mb-3 text-xs" : "mb-4 text-sm line-clamp-3"
            )}>
              {description}
            </p>
          )}

          <div className={cn(
            "mt-auto flex items-center gap-1.5 font-semibold text-[#b86ef9] transition-colors group-hover:text-[#d5b0ff]",
            compact ? "text-xs" : "text-sm"
          )}>
            <span>{cta}</span>
            <ArrowRight className={cn("transition-transform duration-300 group-hover:translate-x-1", compact ? "h-3 w-3" : "h-4 w-4")} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Page() {
  const { slug, lang } = useParams({ from: "/$lang/therapeute/$slug" });
  const { t } = useTranslation();
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Le loader serveur a déjà chargé le profil : rendu dès le HTML initial (SEO/GEO),
  // useQuery ne sert plus qu'à revalider côté client.
  const loaderData = Route.useLoaderData();
  // FAQ : uniquement depuis le loader, jamais re-fetchée côté client — elle
  // doit être dans le HTML initial pour être lue par les crawlers.
  const faqs = (loaderData?.faqs ?? []) as Array<{ question: string; answer: string }>;

  const { data: th, isLoading } = useQuery({
    queryKey: ["therapist", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id,user_id,slug,first_name,last_name,title,meta_title,meta_description,short_bio,bio,photo_url,specialties,approaches,languages,address,postal_code,city,canton,country,latitude,longitude,consultation_modes,price_min,price_max,currency,insurance_accepted,website,status,verified,subscription_plan,gallery_urls,services,years_experience,google_reviews_url,accreditations,social_links,is_trainer,trainer_subjects,trainer_institution,trainer_since")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle() as any;
      if (error) throw error;
      return data;
    },
    initialData: (loaderData?.therapist ?? undefined) as never,
  });

  // Analytics maison — une vue de profil par montage du composant, jamais
  // relancée si th.id ne change pas (StrictMode / re-renders). Le temps
  // passé sur le profil n'est volontairement pas mesuré ici : la
  // fiabilité d'un signal de fin (fermeture d'onglet, navigation) n'est
  // pas meilleure que pour les sessions, voir use-session-tracking.ts.
  const logProfileView = useServerFn(logTherapistProfileView);
  const trackedTherapistIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!th?.id || trackedTherapistIdRef.current === th.id) return;
    trackedTherapistIdRef.current = th.id;
    logProfileView({
      data: { therapistId: th.id, sessionId: getCurrentAnalyticsSessionId() ?? undefined },
    }).catch((e) => console.error("[analytics] logTherapistProfileView failed:", e));
  }, [th?.id]);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", th?.id],
    enabled: !!th?.id,
    queryFn: async () => {
      // Colonnes garanties (schéma de production). La réponse du praticien est
      // tentée en second : si la colonne n'existe pas encore, on retombe
      // silencieusement sur les avis seuls plutôt que de tout perdre.
      const base = await (supabase as any)
        .from("reviews")
        .select("id,rating,comment,author_name,created_at")
        .eq("therapist_id", th!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (base.error) return [];

      const enriched = await (supabase as any)
        .from("reviews")
        .select("id,rating,comment,author_name,created_at,therapist_reply,therapist_reply_at,therapist_reply_status")
        .eq("therapist_id", th!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      return (enriched.error ? base.data : enriched.data) ?? [];
    },
  });

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: th ? `${th.first_name} ${th.last_name}` : "", url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] px-4 py-12">
        <div className="mx-auto w-full max-w-[1440px] space-y-4">
          <div className="h-64 animate-pulse rounded-3xl bg-[#1a1035]" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <div className="h-96 animate-pulse rounded-2xl bg-[#1a1035]" />
            <div className="h-96 animate-pulse rounded-2xl bg-[#1a1035]" />
          </div>
        </div>
      </div>
    );
  }

  if (!th) {
    return (
      <div className="min-h-screen bg-[#0f0a1e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-4">{t("therapist_profile.not_found")}</p>
          <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#b86ef9] underline">
            {t("therapist_profile.back")}
          </Link>
        </div>
      </div>
    );
  }

  const fullName = `${th.first_name} ${th.last_name}`.trim();
  const services: ServiceEntry[] = (Array.isArray(th.services) ? th.services : []).filter(
    (s: any) => s?.visible !== false,
  );
  // Ordre stable : `order` croissant, sinon ordre d'insertion.
  services.sort((a: any, b: any) => {
    const oa = typeof a.order === "number" ? a.order : 9999;
    const ob = typeof b.order === "number" ? b.order : 9999;
    return oa - ob;
  });
  const sessions = services.filter((s) => (s as any).kind !== "package");
  const packages = services.filter((s) => (s as any).kind === "package");
  const accreditations: AccreditationEntry[] = Array.isArray(th.accreditations) ? th.accreditations : [];
  const specialties: string[] = Array.isArray(th.specialties) ? th.specialties : [];
  const languages: string[] = Array.isArray(th.languages) ? th.languages : [];
  const gallery: string[] = Array.isArray(th.gallery_urls) ? th.gallery_urls.filter((u: any) => typeof u === "string" && u.length > 0) : [];
  // Régression corrigée : `is_premium` n'existe pas en production — le plan
  // réel est porté par `subscription_plan`.
  const isPro = isProPlan(th.subscription_plan);
  const showGallery = isPro && gallery.length > 0;
  const certifications = ((loaderData as any)?.certifications ?? []) as any[];
  const therapistArticles = ((loaderData as any)?.articles ?? []) as Array<{
    id: string; slug: string; titre: string; extrait: string | null;
    image_couverture: string | null; date_publication: string | null;
  }>;
  const therapistEvents = ((loaderData as any)?.events ?? []) as Array<{
    id: string; title: string; category: string | null; event_date: string | null;
    start_time: string | null; location: string | null; is_paid: boolean | null;
    price: number | null; image_signed_url: string | null;
  }>;

  const trustBadges = buildTrustBadges({
    lang,
    verified: th.verified,
    subscriptionPlan: th.subscription_plan,
    certifications,
    accreditations,
    trainer: {
      isTrainer: th.is_trainer,
      subjects: th.trainer_subjects,
      institution: th.trainer_institution,
      since: th.trainer_since,
    },
  });
  const heroBadges = trustBadges.filter(
    (b) => b.kind !== "certification" && b.kind !== "accreditation",
  );
  const bioIsLong = (th.bio ?? "").length > 280;

  const avg = reviews?.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews?.filter((r: any) => r.rating === n).length ?? 0,
  }));

  const reviewLocale = ({ de: "de-CH", it: "it-CH", en: "en-GB" } as Record<string, string>)[lang] ?? "fr-CH";

  return (
    <div className="min-h-screen bg-[#0f0a1e] pb-20">

      {/* ── HERO ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse at top, #3d1a5c 0%, #1a1035 50%, #0f0a1e 100%)" }}
      >
        <div className="px-6 pb-8 pt-8 sm:px-8 sm:pt-16 lg:px-12 2xl:px-16 md:min-h-64 md:flex md:items-end">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-center sm:items-start">
              {/* Photo */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative shrink-0"
              >
                <div
                  className="h-28 w-28 rounded-full overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
                    padding: 3,
                    boxShadow: "0 0 30px rgba(184,110,249,0.5)",
                  }}
                >
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#1a1035]">
                    <TherapistAvatar
                      photoUrl={th.photo_url}
                      alt={fullName}
                      fallback={fullName[0]}
                      className="h-full w-full object-cover"
                      fallbackClassName="flex h-full w-full items-center justify-center text-4xl font-bold text-[#b86ef9]"
                    />
                  </div>
                </div>
                {isPro && (
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm shadow-lg" title={t("therapist_profile.premium")}>⚡</span>
                )}
                {!isPro && th.verified && (
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#b86ef9] shadow-lg" title={t("therapist_profile.verified")}>
                    <BadgeCheck className="h-4 w-4 text-white" />
                  </span>
                )}
              </motion.div>

              {/* Infos */}
              <motion.div
                variants={FADE_UP} initial="hidden" animate="show"
                transition={{ delay: 0.1, duration: 0.4 }}
                className="flex-1 min-w-0"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">{fullName}</h1>
                  {th.verified && (
                    <span className="flex items-center gap-1 rounded-full bg-[rgba(184,110,249,0.15)] border border-[rgba(184,110,249,0.3)] px-2.5 py-0.5 text-xs font-medium text-[#b86ef9]">
                      <BadgeCheck className="h-3 w-3" /> {t("therapist_profile.verified")}
                    </span>
                  )}
                </div>

                <p className="text-[#b86ef9] font-medium mb-2">
                  {th.title}{th.city ? ` · ${th.city}${th.canton ? ` (${th.canton})` : ""}` : ""}
                </p>

                {th.short_bio && (
                  <p className="mb-3 max-w-3xl text-sm sm:text-[15px] leading-relaxed text-[rgba(255,255,255,0.78)]">
                    {th.short_bio}
                  </p>
                )}

                {/* En-tête : uniquement les repères de confiance synthétiques
                    (Pro, Vérifié, Formateur). La liste des diplômes reste dans
                    sa section dédiée pour ne pas surcharger la présentation. */}
                {heroBadges.length > 0 && (
                  <TrustBadges badges={heroBadges} lang={lang} className="mb-3" />
                )}


                <SocialLinksRow socialLinks={(th as any).social_links} name={fullName} className="mb-3" />

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[rgba(255,255,255,0.5)]">
                  {avg && (
                    <span className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-white font-semibold">{avg}</span>
                      <span>({t("therapist_profile.reviews_count", { count: reviews?.length })})</span>
                    </span>
                  )}
                  {th.years_experience && (
                    <span className="flex items-center gap-1.5">
                      🏆 {t("therapist_profile.experience", { n: th.years_experience })}
                    </span>
                  )}
                  {th.website && (
                    <a href={th.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[#5cc8fa] transition">
                      <Globe className="h-3.5 w-3.5" /> {t("therapist_profile.website")}
                    </a>
                  )}
                  {th.price_min && (
                    <span className="flex items-center gap-1 text-[rgba(255,255,255,0.7)]">
                      💶 {th.price_min}{th.price_max ? `–${th.price_max}` : ""} {th.currency ?? "CHF"} {t("therapist_profile.per_session")}
                    </span>
                  )}
                </div>

                {specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {specialties.map((s) => (
                      <span key={s} className="rounded-full bg-[rgba(184,110,249,0.1)] border border-[rgba(184,110,249,0.25)] px-3 py-1 text-xs text-[rgba(255,255,255,0.7)]">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-2 shrink-0"
              >
                <button type="button" onClick={share} aria-label={copied ? t("therapist_profile.copied") : t("therapist_profile.share")} className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] transition" title={copied ? t("therapist_profile.copied") : t("therapist_profile.share")}>
                  {copied ? <span className="text-[10px] font-bold text-[#5cc8fa]">✓</span> : <Share2 className="h-4 w-4" />}
                </button>
                <FavoriteButton therapistId={th.id} />
                {(th.city || th.address) && (
                  <ItineraryButton
                    address={th.address}
                    city={th.city}
                    canton={th.canton}
                    postalCode={th.postal_code}
                    title={t("therapist_profile.itinerary")}
                  />
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-6">

          {/* ── COLONNE GAUCHE ── */}
          <div className="space-y-6 min-w-0">

            {/* À propos */}
            {th.bio && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">{t("therapist_profile.about")}</h2>
                <p
                  className={`whitespace-pre-line text-[rgba(255,255,255,0.72)] leading-relaxed text-sm ${
                    bioIsLong && !bioExpanded ? "line-clamp-3" : ""
                  }`}
                >
                  {th.bio}
                </p>
                {bioIsLong && (
                  <button
                    onClick={() => setBioExpanded((v) => !v)}
                    className="mt-3 text-xs font-semibold text-[#b86ef9] hover:text-white transition"
                  >
                    {bioExpanded ? t("therapist_profile.read_less") : t("therapist_profile.read_more")}
                  </button>
                )}
              </motion.section>
            )}

            {/* Galerie photos (Premium) */}
            {showGallery && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#1a0a2e] to-[#1f1235] p-6"
              >
                <div className="mb-4 flex items-center gap-2">
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">⚡ Premium</span>
                  <h2 className="text-lg font-bold text-white">{t("therapist_profile.gallery_title")}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gallery.slice(0, 6).map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(url)}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-[rgba(184,110,249,0.15)] focus:outline-none focus:ring-2 focus:ring-[#b86ef9]"
                      aria-label={t("therapist_profile.gallery_open")}
                    >
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Langues parlées */}
            {languages.length > 0 && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-4 text-lg font-bold text-white">{t("therapist_profile.languages_title")}</h2>
                <div className="flex flex-wrap gap-2">
                  {languages.map((code) => {
                    const meta = SPOKEN_LANGUAGES.find((l) => l.code === code);
                    const label = meta?.label ?? code;
                    const flag = LANG_FLAG[code] ?? "🌐";
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(92,200,250,0.25)] bg-[rgba(92,200,250,0.08)] px-3 py-1.5 text-sm text-white"
                      >
                        <span aria-hidden className="text-base leading-none">{flag}</span>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* Services / tarifs */}
            {services.length > 0 && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 className="mb-1 text-lg font-bold text-white">{t("therapist_profile.services_title")}</h2>
                <p className="mb-5 text-xs text-[rgba(255,255,255,0.45)]">
                  {t("therapist_profile.services_subtitle", { defaultValue: "Séances individuelles et forfaits d'accompagnement." })}
                </p>

                {sessions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.55)]">
                      <Sparkles className="h-3.5 w-3.5 text-[#b86ef9]" />
                      {t("therapist_profile.sessions_group", { defaultValue: "Séances" })}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sessions.map((s, i) => (
                        <ServiceCard key={`s-${i}`} service={s} variant="session" tLang={lang} />
                      ))}
                    </div>
                  </div>
                )}

                {packages.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                      <PackageIcon className="h-3.5 w-3.5" />
                      {t("therapist_profile.packages_group", { defaultValue: "Forfaits d'accompagnement" })}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {packages.map((s, i) => (
                        <ServiceCard key={`p-${i}`} service={s} variant="package" tLang={lang} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Accréditations */}
            {trustBadges.some((b) => b.kind === "certification" || b.kind === "accreditation") && (
              <motion.div variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <CertificationsShowcase
                  title={t("therapist_profile.certifications_title")}
                  badges={trustBadges.filter((b) => b.kind === "certification" || b.kind === "accreditation")}
                  labels={{
                    expand: t("therapist_profile.certifications_expand", { defaultValue: "Voir tous les diplômes" }),
                    collapse: t("therapist_profile.certifications_collapse", { defaultValue: "Réduire" }),
                  }}
                  notice={
                    trustBadges.some((b) => (b.kind === "certification" || b.kind === "accreditation") && !b.verified)
                      ? t("therapist_profile.declared_notice", {
                          defaultValue:
                            "Les éléments en gris sont déclarés par le praticien et n'ont pas encore été vérifiés par Holiswiss.",
                        })
                      : null
                  }
                />
              </motion.div>
            )}


            {/* Événements & Voix d'experts — côte à côte sur desktop */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Événements à venir */}
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-4 lg:p-5"
              >
                <h2 className="mb-3 text-base font-bold text-white">
                  {t("therapist_profile.events_title", { defaultValue: "Événements à venir" })}
                </h2>

                {therapistEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(184,110,249,0.18)] bg-[rgba(255,255,255,0.02)] p-6 text-center">
                    <Calendar className="mb-2 h-6 w-6 text-[rgba(184,110,249,0.35)]" />
                    <p className="max-w-xs text-xs text-[rgba(255,255,255,0.55)]">
                      {t("therapist_profile.events_empty", { defaultValue: "Aucun événement à venir pour le moment." })}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {therapistEvents.map((e, i) => {
                      const eventMeta = [
                        e.event_date
                          ? new Date(`${e.event_date}T00:00:00`).toLocaleDateString(lang, {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : null,
                        e.start_time ? e.start_time.slice(0, 5) : null,
                      ].filter(Boolean).join(" · ");

                      const eventDescription = [
                        e.location,
                        e.is_paid && e.price != null ? `${e.price} CHF` : null,
                      ].filter(Boolean).join(" · ");

                      return (
                        <ContentCard
                          key={e.id}
                          imageUrl={e.image_signed_url}
                          alt={e.title}
                          to="/$lang/evenements/$id"
                          params={{ lang, id: e.id }}
                          badge={e.category || t("therapist_profile.event_badge", { defaultValue: "Événement" })}
                          title={e.title}
                          meta={eventMeta}
                          description={eventDescription || null}
                          cta={t("therapist_profile.event_cta", { defaultValue: "Voir" })}
                          index={i}
                          placeholderIcon="calendar"
                          compact
                        />
                      );
                    })}
                  </div>
                )}
              </motion.section>

              {/* Voix d'experts */}
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-4 lg:p-5"
              >
                <h2 className="mb-3 text-base font-bold text-white">
                  {t("therapist_profile.articles_title", { defaultValue: "Voix d'experts" })}
                </h2>

                {therapistArticles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(184,110,249,0.18)] bg-[rgba(255,255,255,0.02)] p-6 text-center">
                    <FileText className="mb-2 h-6 w-6 text-[rgba(184,110,249,0.35)]" />
                    <p className="max-w-xs text-xs text-[rgba(255,255,255,0.55)]">
                      {t("therapist_profile.articles_empty", { defaultValue: "Aucune publication disponible pour le moment." })}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {therapistArticles.map((a, i) => {
                      const articleMeta = a.date_publication
                        ? new Date(a.date_publication).toLocaleDateString(lang, {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : undefined;

                      return (
                        <ContentCard
                          key={a.id}
                          imageUrl={a.image_couverture}
                          alt={a.titre}
                          to="/$lang/paroles/$slug"
                          params={{ lang, slug: a.slug }}
                          badge={(a as any).category || null}
                          title={a.titre}
                          meta={articleMeta}
                          description={a.extrait}
                          cta={t("therapist_profile.article_cta", { defaultValue: "Lire" })}
                          index={i}
                          placeholderIcon="article"
                          compact
                        />
                      );
                    })}
                  </div>
                )}
              </motion.section>
            </div>


            {/* FAQ — entre les prestations et les avis : le visiteur a compris
                l'offre et lève ses derniers doutes avant de réserver. Rendue
                côté serveur, donc lisible par les crawlers sans JavaScript. */}
            {faqs.length > 0 && (
              <motion.section
                variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                aria-labelledby="faq-title"
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <h2 id="faq-title" className="mb-1 text-lg font-bold text-white">
                  {t("therapist_profile.faq_title", { defaultValue: "Questions fréquentes" })}
                </h2>
                <p className="mb-5 text-sm text-[#d4c4e0]">
                  {t("therapist_profile.faq_subtitle", {
                    defaultValue: "Ce que l'on me demande le plus souvent avant un premier rendez-vous.",
                  })}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {faqs.map((f, i) => (
                    <details
                      key={i}
                      className="group overflow-hidden rounded-xl border border-[rgba(168,85,247,0.25)] bg-[#2d1b4e] transition-colors hover:border-[rgba(168,85,247,0.5)]"
                    >
                      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 text-[0.97rem] font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#22d3ee]">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[rgba(168,85,247,0.16)] text-[#a855f7] transition-transform duration-200 ease-out group-open:rotate-45 group-open:bg-[rgba(34,211,238,0.18)] group-open:text-[#22d3ee]"
                        >+</span>
                        <span>{f.question}</span>
                      </summary>
                      <p className="mx-4 mb-4 whitespace-pre-wrap text-sm text-[#d4c4e0]">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Avis */}
            <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">{t("therapist_profile.reviews_title")}</h2>
                  {avg && (
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-white">{avg}</span>
                      <div>
                        <StarRow rating={Math.round(Number(avg))} size={4} />
                        <p className="text-xs text-[rgba(255,255,255,0.45)] mt-0.5">{t("therapist_profile.reviews_count", { count: reviews!.length })}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mb-5">
                  <ReviewForm therapistId={th.id} />
                </div>
                {(reviews?.length ?? 0) > 0 && (
                <>
                <div className="mb-5 space-y-1.5">
                  {dist.map(({ n, count }) => (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-right text-[rgba(255,255,255,0.5)]">{n}</span>
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] transition-all"
                          style={{ width: reviews!.length ? `${(count / reviews!.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="w-6 text-[rgba(255,255,255,0.4)]">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {reviews!.map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-[rgba(184,110,249,0.12)] bg-[rgba(184,110,249,0.04)] p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#b86ef9] to-[#5cc8fa] flex items-center justify-center text-xs font-bold text-white">
                            {(r.author_name?.[0] ?? "C").toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white">{r.author_name || "Client vérifié"}</span>
                            <StarRow rating={r.rating} size={3} />
                          </div>
                        </div>
                        <span className="text-xs text-[rgba(255,255,255,0.35)]">
                          {new Date(r.created_at).toLocaleDateString(reviewLocale, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {(r.comment ?? r.body) && (
                        <p className="text-sm text-[rgba(255,255,255,0.72)] leading-relaxed">{r.comment ?? r.body}</p>
                      )}
                      {r.therapist_reply && r.therapist_reply_status === "approved" && (
                        <div className="mt-3 rounded-lg border-l-2 border-[#5cc8fa] bg-[rgba(92,200,250,0.06)] p-3">
                          <p className="text-xs font-semibold text-[#5cc8fa]">Réponse du praticien</p>
                          <p className="mt-0.5 text-sm text-[rgba(255,255,255,0.75)]">{r.therapist_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </>
                )}
              </motion.section>

            {/* Mini carte */}
            {th.latitude && th.longitude && (
              <motion.section variants={FADE_UP} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] overflow-hidden"
              >
                <div className="p-4 border-b border-[rgba(184,110,249,0.12)]">
                  <h2 className="text-lg font-bold text-white">{t("therapist_profile.map_title")}</h2>
                  <p className="text-sm text-[rgba(255,255,255,0.45)] mt-0.5">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />{th.city}{th.canton ? ` (${th.canton})` : ""}, {t("therapist_profile.country")}
                  </p>
                </div>
                <div style={{ height: 220 }}>
                  <Suspense fallback={<div className="h-full bg-[#1a1035] animate-pulse" />}>
                    <TherapistMiniMap
                      therapists={[th]}
                      selectedId={th.id}
                      onSelect={() => {}}
                      lang={lang}
                    />
                  </Suspense>
                </div>
              </motion.section>
            )}
          </div>

          {/* ── SIDEBAR DROITE ── */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

            <div className="rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur">
              <BookingWidget
                therapistId={th.id}
                therapistName={fullName}
                services={services.map((s) => ({
                  name: s.name,
                  duration: (s as any).duration_min ?? s.duration,
                  price: (s as any).price_chf ?? s.price,
                  format: s.format,
                  color: s.color,
                  description: s.description,
                }))}
              />
            </div>

            <div className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur space-y-3">
              <h3 className="font-semibold text-white text-sm">{t("therapist_profile.contact_title")}</h3>
              {th.phone && (
                <div>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> {t("therapist_profile.phone_protected")}
                  </p>
                  {phoneVisible ? (
                    <p className="text-sm font-semibold text-[#5cc8fa]">{th.phone}</p>
                  ) : (
                    <button
                      onClick={() => setPhoneVisible(true)}
                      className="text-sm font-semibold text-[#b86ef9] hover:text-white transition"
                    >
                      {t("therapist_profile.phone_show")}
                    </button>
                  )}
                </div>
              )}
              {th.email && (
                <a href={`mailto:${th.email}`} className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.6)] hover:text-[#5cc8fa] transition">
                  {t("therapist_profile.email_send")}
                </a>
              )}
            </div>

            {(th.city || th.canton) && (
              <div className="rounded-2xl border border-[rgba(184,110,249,0.18)] bg-[rgba(13,7,30,0.85)] p-5 backdrop-blur">
                <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1">{t("therapist_profile.zone_label")}</p>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#b86ef9]" />
                  {th.city}{th.canton ? ` · ${th.canton}` : ""}{th.postal_code ? `, ${th.postal_code}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="mx-auto mt-12 max-w-2xl px-4 text-center text-[13px] italic text-[rgba(255,255,255,0.3)] leading-relaxed">
        {t("therapist_profile.disclaimer")}
      </p>

      {showTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Revenir en haut de la page"
          className="fixed bottom-24 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#b86ef9] text-white shadow-[0_4px_20px_rgba(184,110,249,0.4)] hover:bg-[#a055e8] transition"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Card premium pour séance ou forfait.
   Utilisée dans la section « Services / tarifs » du profil public.
   ───────────────────────────────────────────────────────────── */
function ServiceCard({
  service,
  variant,
  tLang,
}: {
  service: ServiceEntry;
  variant: "session" | "package";
  tLang: string;
}) {
  const { t } = useTranslation();
  const s: any = service;
  const duration = s.duration_min ?? s.duration;
  const price = s.price_chf ?? s.price;
  const currency = "CHF";
  const formatKey = s.format as string | undefined;
  const formatLabel = formatKey
    ? (t(`therapist_profile.format_${formatKey}`, { defaultValue: "" }) || formatKey)
    : t("therapist_profile.service_format_default");
  const FormatIcon = formatKey === "online" ? Video : formatKey === "hybrid" ? Users : MapPin;
  const detail = s.description || s.short_description;
  const isPackage = variant === "package";
  const sessionsCount = s.sessions_count as number | undefined;
  const sessionDur = s.session_duration_min as number | undefined;

  return (
    <article
      className={`group relative flex flex-col gap-3 rounded-2xl border p-4 transition ${
        isPackage
          ? "border-amber-400/30 bg-gradient-to-br from-[#1f1330] to-[#1a0a2e] shadow-[0_0_0_1px_rgba(251,191,36,0.05)_inset]"
          : "border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] hover:border-[rgba(184,110,249,0.35)]"
      }`}
    >
      {/* header */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {isPackage && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <PackageIcon className="h-3 w-3" />
              {t("therapist_profile.service_kind_package", { defaultValue: "Programme d'accompagnement" })}
            </span>
          )}
          <h4 className="text-[15px] font-semibold text-white leading-snug">{s.name}</h4>
        </div>
        {detail && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("therapist_profile.service_more", { defaultValue: "En savoir plus" })}
                className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(184,110,249,0.25)] text-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] transition"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 border-[rgba(184,110,249,0.3)] bg-[#1a0a2e] text-[#e6d7f5]">
              <p className="text-sm font-semibold text-white">{s.name}</p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[rgba(255,255,255,0.78)]">{detail}</p>
            </PopoverContent>
          </Popover>
        )}
      </header>

      {/* short description */}
      {s.short_description && (
        <p className="text-xs leading-relaxed text-[rgba(255,255,255,0.65)] line-clamp-2">
          {s.short_description}
        </p>
      )}

      {/* meta line */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[rgba(255,255,255,0.6)]">
        {isPackage && sessionsCount ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-white font-medium">{sessionsCount}</span>
            {t("therapist_profile.package_sessions_short", { defaultValue: "séances" })}
            {sessionDur ? <span className="text-[rgba(255,255,255,0.45)]">· {sessionDur} min</span> : null}
          </span>
        ) : (
          duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {duration} min
            </span>
          )
        )}
        {formatKey && (
          <span className="inline-flex items-center gap-1 capitalize">
            <FormatIcon className="h-3.5 w-3.5" />
            {formatLabel}
          </span>
        )}
      </div>

      {/* price */}
      <footer className="flex items-end justify-between border-t border-[rgba(184,110,249,0.12)] pt-3">
        <div>
          {price != null && price !== "" ? (
            <>
              <div className="text-lg font-bold text-white leading-none">
                {price} <span className="text-xs font-medium text-[rgba(255,255,255,0.5)]">{currency}</span>
              </div>
              {isPackage && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-300/80">
                  {t("therapist_profile.package_total_price", { defaultValue: "Tarif global" })}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs italic text-[rgba(255,255,255,0.35)]">
              {t("therapist_profile.value_missing", { defaultValue: "À renseigner" })}
            </span>
          )}
        </div>
        {detail && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-xs font-medium text-[#b86ef9] hover:text-white transition"
              >
                {t("therapist_profile.service_more", { defaultValue: "En savoir plus" })} →
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 border-[rgba(184,110,249,0.3)] bg-[#1a0a2e] text-[#e6d7f5]">
              <p className="text-sm font-semibold text-white">{s.name}</p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[rgba(255,255,255,0.78)]">{detail}</p>
            </PopoverContent>
          </Popover>
        )}
      </footer>
    </article>
  );
}
