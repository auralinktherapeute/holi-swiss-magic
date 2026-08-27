import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Camera, X, Plus, Search, MapPin, Phone, Globe, Link2, ShieldCheck,
  FileText, Trash2, Pencil, Upload, Clock, Save, Eye, EyeOff, Check, BadgeCheck,
  ArrowUp, ArrowDown, Package as PackageIcon, Mail, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import {
  CANTONS, SPOKEN_LANGUAGES, THERAPY_SPECIALTIES, type TherapistService,
  ACCREDITATION_ORGS, type Accreditation, normalizeSwissIde,
} from "@/lib/constants";
import {
  addMyTherapistDocument,
  deleteMyTherapistDocument,
  saveMyTherapistProfile,
  updateMyTherapistDocument,
} from "@/lib/dashboard.functions";
import { updateMyNewsletterConsent, getMyNewsletterConsent } from "@/lib/newsletter-consent.functions";
import ProfilePhotoUploader from "@/components/dashboard/ProfilePhotoUploader";
import CabinetPhotosUploader from "@/components/dashboard/CabinetPhotosUploader";
import CertificationsUploader from "@/components/dashboard/CertificationsUploader";
import FaqEditor from "@/components/dashboard/FaqEditor";
import { SocialLinksEditor, EMPTY_SOCIAL_FORM, type SocialFormState } from "@/components/dashboard/SocialLinksEditor";
import { normalizeSocialUrl, SOCIAL_NETWORKS, parseSocialLinks } from "@/lib/social-links";
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";
import { useHashFocus } from "@/hooks/use-hash-focus";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftSavedIndicator } from "@/components/drafts/DraftBanner";
import { hasSessionState, useSessionState } from "@/hooks/use-session-state";
import {
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
  buildGeneratedSeoTitle,
  evaluateSeoTitle,
  resolveSeoTitle,
} from "@/lib/seo-title";
import {
  SEO_DESC_MAX,
  SEO_DESC_MIN,
  evaluateSeoDescription,
  resolveSeoDescription,
} from "@/lib/seo-description";
import PaymentMethodsPanel from "@/components/dashboard/PaymentMethodsPanel";
import QrCodePanel from "@/components/dashboard/QrCodePanel";
import { TaxonomySpecialtyPicker } from "@/components/dashboard/TaxonomySpecialtyPicker";
import { listAllSpecialties } from "@/lib/specialties.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshShowcaseAfterSave, formatAnalysisDate } from "@/lib/showcase-cache";


export const Route = createFileRoute("/dashboard/profil")({ component: ProfilePage });

// Extract the object path from a Supabase storage public URL, if applicable.
function pathFromPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/therapist-photos\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function resolveOwnerPhotoPreview(url: string): Promise<string> {
  const path = pathFromPhotoUrl(url);
  if (!path) return url;
  const { data } = await supabase.storage.from("therapist-photos").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? url;
}

type DocRow = {
  id: string;
  file_url: string;
  file_name: string;
  label: string | null;
  is_public: boolean;
};

const CURRENCIES = ["CHF", "EUR", "USD"];
const CONSULTATION_MODES = [
  { value: "in_person", label: "Au cabinet" },
  { value: "online", label: "En visio" },
  { value: "home", label: "À domicile" },
] as const;
const SERVICE_COLORS = ["#3b82f6", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#ef4444"];
// NOTE: `phone` and `email` are column-restricted at the database level and
// cannot be read directly by the authenticated role. The owner's phone is
// fetched via the security-definer RPC `get_my_therapist_contact()` below.
const THERAPIST_PROFILE_SELECT = [
  "id", "slug", "photo_url", "first_name", "last_name", "title", "city", "postal_code", "address",
  "canton", "languages", "price_min", "price_max", "currency", "years_experience",
  "specialties", "services", "short_bio", "bio", "google_reviews_url", "website",
  "ide_verified", "accreditations", "meta_title", "meta_description", "consultation_modes",
  "is_trainer", "trainer_subjects", "trainer_institution", "trainer_since", "social_links",
].join(",");

/** Convertit la valeur en base vers l'état du formulaire (champs toujours présents). */
function socialFormFromDb(raw: unknown): SocialFormState {
  const parsed = parseSocialLinks(raw);
  const next = { ...EMPTY_SOCIAL_FORM };
  for (const network of SOCIAL_NETWORKS) {
    const entry = parsed[network];
    if (entry) next[network] = { url: entry.url, visible: entry.visible };
  }
  return next;
}

/** Ne persiste que les liens valides ; l'affichage suit l'interrupteur. */
function socialPayload(form: SocialFormState) {
  const out: Record<string, { url: string; visible: boolean }> = {};
  for (const network of SOCIAL_NETWORKS) {
    const entry = form[network];
    const url = entry ? normalizeSocialUrl(network, entry.url) : null;
    if (url) out[network] = { url, visible: !!entry.visible };
  }
  return out;
}

function profileDraftScore(draft: unknown) {
  if (!draft || typeof draft !== "object") return 0;
  const d = draft as Record<string, unknown>;
  return [
    "firstName", "lastName", "city", "postalCode", "address", "phone", "priceMin", "priceMax",
    "yearsExperience", "shortBio", "bio", "googleReviewsUrl", "website", "ide",
  ].reduce((score, key) => score + (String(d[key] ?? "").trim() ? 1 : 0), 0)
    + (Array.isArray(d.langs) ? d.langs.length : 0)
    + (Array.isArray(d.specialties) ? d.specialties.length : 0)
    + (Array.isArray(d.services) ? d.services.length * 2 : 0)
    + (Array.isArray(d.accreditations) ? d.accreditations.length : 0);
}

function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileStatePrefix = user?.id ? `dashboard.profile.${user.id}` : "dashboard.profile.pending";
  const saveProfile = useServerFn(saveMyTherapistProfile);
  const addDocument = useServerFn(addMyTherapistDocument);
  const updateDocument = useServerFn(updateMyTherapistDocument);
  const deleteDocument = useServerFn(deleteMyTherapistDocument);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Identity
  const [rowId, setRowId] = useSessionState<string | null>(`${profileStatePrefix}.rowId`, null);
  const [photoUrl, setPhotoUrl] = useSessionState<string>(`${profileStatePrefix}.photoUrl`, "");
  // The canonical public URL we persist to the DB (works on the public site once active).
  const [photoPublicUrl, setPhotoPublicUrl] = useSessionState<string>(`${profileStatePrefix}.photoPublicUrl`, "");
  const [firstName, setFirstName] = useSessionState(`${profileStatePrefix}.firstName`, "");
  const [lastName, setLastName] = useSessionState(`${profileStatePrefix}.lastName`, "");
  const [proTitle, setProTitle] = useSessionState(`${profileStatePrefix}.proTitle`, "");
  const [publicSlug, setPublicSlug] = useSessionState(`${profileStatePrefix}.publicSlug`, "");
  const [city, setCity] = useSessionState(`${profileStatePrefix}.city`, "");
  const [postalCode, setPostalCode] = useSessionState(`${profileStatePrefix}.postalCode`, "");
  const [address, setAddress] = useSessionState(`${profileStatePrefix}.address`, "");
  const [phone, setPhone] = useSessionState(`${profileStatePrefix}.phone`, "");

  // Approaches
  const [canton, setCanton] = useSessionState(`${profileStatePrefix}.canton`, "GE");
  const [langs, setLangs] = useSessionState<string[]>(`${profileStatePrefix}.langs`, []);
  const [priceMin, setPriceMin] = useSessionState<number | "">(`${profileStatePrefix}.priceMin`, "");
  const [priceMax, setPriceMax] = useSessionState<number | "">(`${profileStatePrefix}.priceMax`, "");
  const [currency, setCurrency] = useSessionState(`${profileStatePrefix}.currency`, "CHF");
  const [sessionDuration, setSessionDuration] = useSessionState<number | "">(`${profileStatePrefix}.sessionDuration`, 60);
  const [yearsExperience, setYearsExperience] = useSessionState<number | "">(`${profileStatePrefix}.yearsExperience`, "");

  // Specialties
  const [specialties, setSpecialties] = useSessionState<string[]>(`${profileStatePrefix}.specialties`, []);
  const [specialtyIds, setSpecialtyIds] = useSessionState<string[]>(`${profileStatePrefix}.specialtyIds`, []);
  const [specSearch, setSpecSearch] = useSessionState(`${profileStatePrefix}.specSearch`, "");
  const [customSpec, setCustomSpec] = useSessionState(`${profileStatePrefix}.customSpec`, "");
  const [customSpecs, setCustomSpecs] = useSessionState<string[]>(`${profileStatePrefix}.customSpecs`, []);

  // Load taxonomy in parent (reuses same cache key as the picker) so we can
  // distinguish predefined vs custom (free-text) specialties in the DB.
  const fetchAllSpecs = useServerFn(listAllSpecialties);
  const taxQuery = useQuery({ queryKey: ["taxonomy-public"], queryFn: () => fetchAllSpecs(), staleTime: 5 * 60 * 1000 });
  const taxLabelSet = useMemo(() => {
    const list = ((taxQuery.data as any)?.specialties ?? []) as Array<{ name_fr: string }>;
    return new Set(list.map((s) => (s.name_fr || "").toLowerCase()));
  }, [taxQuery.data]);
  const customSpecsInitRef = useRef(false);
  useEffect(() => {
    if (customSpecsInitRef.current) return;
    if (taxLabelSet.size === 0) return;
    customSpecsInitRef.current = true;
    const detected = specialties.filter((s) => !taxLabelSet.has((s || "").toLowerCase()));
    if (detected.length > 0) setCustomSpecs((prev) => (prev.length > 0 ? prev : detected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxLabelSet]);

  // Services
  const [services, setServices] = useSessionState<TherapistService[]>(`${profileStatePrefix}.services`, []);

  // Texts
  const [shortBio, setShortBio] = useSessionState(`${profileStatePrefix}.shortBio`, "");
  const [bio, setBio] = useSessionState(`${profileStatePrefix}.bio`, "");
  const [googleReviewsUrl, setGoogleReviewsUrl] = useSessionState(`${profileStatePrefix}.googleReviewsUrl`, "");
  const [metaTitle, setMetaTitle] = useSessionState(`${profileStatePrefix}.metaTitle`, "");
  const [metaDescription, setMetaDescription] = useSessionState(`${profileStatePrefix}.metaDescription`, "");
  const [consultationModes, setConsultationModes] = useSessionState<string[]>(`${profileStatePrefix}.consultationModes`, []);
  const [website, setWebsite] = useSessionState(`${profileStatePrefix}.website`, "");

  // Title SEO : même résolution que la page publique et que l'audit.
  const seoTitleResolution = resolveSeoTitle(
    metaTitle,
    buildGeneratedSeoTitle({ first_name: firstName, last_name: lastName, title: proTitle, city, canton }),
  );
  const seoTitleStatus = evaluateSeoTitle(seoTitleResolution, { expectedLang: null });

  // Meta description : même résolution et mêmes seuils que la page publique
  // et que l'audit de visibilité.
  const seoDescResolution = resolveSeoDescription({
    meta_description: metaDescription,
    bio,
    short_bio: shortBio,
  });
  const seoDescStatus = evaluateSeoDescription(seoDescResolution);

  // SIRET
  // Swiss IDE / UID (CHE-XXX.XXX.XXX)
  const [ide, setIde] = useSessionState(`${profileStatePrefix}.ide`, "");
  const [ideVerified, setIdeVerified] = useSessionState(`${profileStatePrefix}.ideVerified`, false);
  const [showIde, setShowIde] = useState(false);

  // Accreditations (ASCA, RME, OrTra TC, ...)
  const [accreditations, setAccreditations] = useSessionState<Accreditation[]>(`${profileStatePrefix}.accreditations`, []);

  // Réseaux sociaux — lien conservé même lorsque l'affichage est coupé.
  const [socialLinks, setSocialLinks] = useSessionState<SocialFormState>(`${profileStatePrefix}.socialLinks`, EMPTY_SOCIAL_FORM);

  // Formateur — déclaratif, comme les accréditations.
  const [isTrainer, setIsTrainer] = useSessionState<boolean>(`${profileStatePrefix}.isTrainer`, false);
  const [trainerSubjects, setTrainerSubjects] = useSessionState(`${profileStatePrefix}.trainerSubjects`, "");
  const [trainerInstitution, setTrainerInstitution] = useSessionState(`${profileStatePrefix}.trainerInstitution`, "");
  const [trainerSince, setTrainerSince] = useSessionState(`${profileStatePrefix}.trainerSince`, "");

  // Documents
  const [documents, setDocuments] = useSessionState<DocRow[]>(`${profileStatePrefix}.documents`, []);

  // Newsletter consent
  const [newsletterOptIn, setNewsletterOptIn] = useSessionState<boolean>(`${profileStatePrefix}.newsletterOptIn`, false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterOptInAt, setNewsletterOptInAt] = useState<string | null>(null);
  const [newsletterPrefsOpen, setNewsletterPrefsOpen] = useState(false);
  const [newsletterUnsubOpen, setNewsletterUnsubOpen] = useState(false);
  const updateNewsletterConsent = useServerFn(updateMyNewsletterConsent);
  const fetchNewsletterConsent = useServerFn(getMyNewsletterConsent);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchNewsletterConsent({ data: undefined as never });
        if (cancelled || !res) return;
        setNewsletterOptIn(res.optIn ?? false);
        setNewsletterOptInAt(res.optInAt ?? null);
      } catch {
        /* état newsletter non bloquant pour l'édition du profil */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyNewsletterConsent = async (next: boolean) => {
    setNewsletterLoading(true);
    try {
      const res = await updateNewsletterConsent({ data: { optIn: next } });
      setNewsletterOptIn(next);
      setNewsletterOptInAt(res?.optInAt ?? null);
      toast.success(
        next
          ? res?.alreadySubscribed
            ? t("profile_edit.newsletter_already_subscribed")
            : t("profile_edit.newsletter_subscribed")
          : t("profile_edit.newsletter_unsubscribed")
      );
      return true;
    } catch {
      toast.error(t("profile_edit.newsletter_error"));
      return false;
    } finally {
      setNewsletterLoading(false);
    }
  };

  const docInputRef = useRef<HTMLInputElement>(null);

  // ---- Auto-save draft ----
  const formSnapshot = useMemo(() => ({
    firstName, lastName, city, postalCode, address, phone, canton, langs,
    priceMin, priceMax, currency, sessionDuration, yearsExperience, specialties, services,
    shortBio, bio, googleReviewsUrl, website, ide, accreditations, socialLinks,
    isTrainer, trainerSubjects, trainerInstitution, trainerSince,
  }), [firstName, lastName, city, postalCode, address, phone, canton, langs,
      priceMin, priceMax, currency, sessionDuration, yearsExperience, specialties, services,
      shortBio, bio, googleReviewsUrl, website, ide, accreditations, socialLinks,
      isTrainer, trainerSubjects, trainerInstitution, trainerSince]);

  const { initialDraft, status: draftStatus, savedAt, clearDraft, dismissDraft } = useFormDraft({
    formType: "therapist_profile",
    data: formSnapshot,
    enabled: !loading && dirty,
    getCompletenessScore: profileDraftScore,
  });

  const autoRestoredRef = useRef(false);
  const profileBaselineScoreRef = useRef(0);

  const applyDraft = (d: typeof formSnapshot) => {
    const keepText = (next: unknown, current: string, fallback = "") => {
      if (next === undefined || next === null) return current || fallback;
      const value = String(next);
      return value.trim() || !current.trim() ? value : current;
    };
    const keepNumber = (next: number | "" | undefined, current: number | "", fallback: number | "" = "") => (
      next === undefined || next === "" ? (current === "" ? fallback : current) : next
    );
    const keepArray = <V,>(next: V[] | undefined, current: V[]) => (
      Array.isArray(next) && (next.length > 0 || current.length === 0) ? next : current
    );

    setFirstName(keepText(d.firstName, firstName));
    setLastName(keepText(d.lastName, lastName));
    setCity(keepText(d.city, city));
    setPostalCode(keepText(d.postalCode, postalCode));
    setAddress(keepText(d.address, address));
    setPhone(keepText(d.phone, phone));
    setCanton(d.canton ?? "GE");
    setLangs(keepArray(d.langs, langs));
    setPriceMin(keepNumber(d.priceMin, priceMin));
    setPriceMax(keepNumber(d.priceMax, priceMax));
    setCurrency(d.currency ?? "CHF");
    setSessionDuration(d.sessionDuration ?? 60);
    setYearsExperience(keepNumber(d.yearsExperience, yearsExperience));
    setSpecialties(keepArray(d.specialties, specialties));
    setServices(keepArray(d.services, services));
    setShortBio(keepText(d.shortBio, shortBio));
    setBio(keepText(d.bio, bio));
    setGoogleReviewsUrl(keepText(d.googleReviewsUrl, googleReviewsUrl));
    setWebsite(keepText(d.website, website));
    setIde(keepText(d.ide, ide));
    setAccreditations(keepArray(d.accreditations, accreditations));
    if (d.socialLinks && typeof d.socialLinks === "object") setSocialLinks({ ...EMPTY_SOCIAL_FORM, ...d.socialLinks });
    if (typeof d.isTrainer === "boolean") setIsTrainer(d.isTrainer);
    setTrainerSubjects(keepText(d.trainerSubjects, trainerSubjects));
    setTrainerInstitution(keepText(d.trainerInstitution, trainerInstitution));
    setTrainerSince(keepText(d.trainerSince, trainerSince));
    setDirty(true);
  };

  // Auto-restore draft as soon as it is loaded (after DB fetch), so the user
  // never sees empty fields when a draft exists.
  useEffect(() => {
    if (loading) return;
    if (autoRestoredRef.current) return;
    if (!initialDraft) return;
    const draftScore = profileDraftScore(initialDraft);
    const currentScore = profileDraftScore(formSnapshot);
    if (draftScore <= 0 || (currentScore >= 2 && draftScore < currentScore)) {
      autoRestoredRef.current = true;
      dismissDraft();
      return;
    }
    autoRestoredRef.current = true;
    applyDraft(initialDraft as typeof formSnapshot);
    dismissDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialDraft]);

  // Load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("therapists")
        .select(THERAPIST_PROFILE_SELECT)
        .eq("user_id", user.id)
        .maybeSingle() as any;
      // Fetch the owner's phone via a controlled security-definer RPC.
      const { data: contact } = await (supabase as any).rpc("get_my_therapist_contact");
      const ownerPhone: string = (Array.isArray(contact) ? contact[0]?.phone : contact?.phone) ?? "";
      if (data) {
        (data as any).phone = ownerPhone;
        const hasProfileSession = hasSessionState(`${profileStatePrefix}.rowId`) || hasSessionState(`${profileStatePrefix}.firstName`);
        profileBaselineScoreRef.current = profileDraftScore({
          firstName: data.first_name ?? "",
          lastName: data.last_name ?? "",
          city: data.city ?? "",
          postalCode: data.postal_code ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          canton: data.canton ?? "GE",
          langs: data.languages ?? [],
          priceMin: data.price_min ?? "",
          priceMax: data.price_max ?? "",
          currency: data.currency ?? "CHF",
          sessionDuration,
          yearsExperience: (data as any).years_experience ?? "",
          specialties: data.specialties ?? [],
          services: ((data as any).services as TherapistService[]) ?? [],
          shortBio: data.short_bio ?? "",
          bio: data.bio ?? "",
          googleReviewsUrl: (data as any).google_reviews_url ?? "",
          website: data.website ?? "",
          ide: "",
          accreditations: ((data as any).accreditations as Accreditation[]) ?? [],
          socialLinks: socialFormFromDb((data as any).social_links),
          isTrainer: (data as any).is_trainer ?? false,
          trainerSubjects: (data as any).trainer_subjects ?? "",
          trainerInstitution: (data as any).trainer_institution ?? "",
          trainerSince: (data as any).trainer_since ? String((data as any).trainer_since) : "",
        });
        if (hasProfileSession) {
          setLoading(false);
          return;
        }
        setRowId(data.id);
        setPhotoPublicUrl(data.photo_url ?? "");
        if (data.photo_url) {
          setPhotoUrl(await resolveOwnerPhotoPreview(data.photo_url));
        } else {
          setPhotoUrl("");
        }
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setPublicSlug((data as any).slug ?? "");
        setCity(data.city ?? "");
        setPostalCode(data.postal_code ?? "");
        setAddress(data.address ?? "");
        setPhone(data.phone ?? "");
        setCanton(data.canton ?? "GE");
        setLangs(data.languages ?? []);
        setPriceMin(data.price_min ?? "");
        setPriceMax(data.price_max ?? "");
        setCurrency(data.currency ?? "CHF");
        setYearsExperience((data as any).years_experience ?? "");
        setSpecialties(data.specialties ?? []);
        setServices(((data as any).services as TherapistService[]) ?? []);
        setShortBio(data.short_bio ?? "");
        setBio(data.bio ?? "");
        setGoogleReviewsUrl((data as any).google_reviews_url ?? "");
        setProTitle((data as any).title ?? "");
        setMetaTitle((data as any).meta_title ?? "");
        setMetaDescription((data as any).meta_description ?? "");
        setConsultationModes(((data as any).consultation_modes as string[]) ?? []);
        setWebsite(data.website ?? "");
        setIdeVerified((data as any).ide_verified ?? false);
        setAccreditations(((data as any).accreditations as Accreditation[]) ?? []);
        setSocialLinks(socialFormFromDb((data as any).social_links));
        setIsTrainer((data as any).is_trainer ?? false);
        setTrainerSubjects((data as any).trainer_subjects ?? "");
        setTrainerInstitution((data as any).trainer_institution ?? "");
        setTrainerSince((data as any).trainer_since ? String((data as any).trainer_since) : "");
        const { data: privateIds } = await supabase
          .from("therapist_private_identifiers" as any)
          .select("ide")
          .eq("therapist_id", data.id)
          .eq("user_id", user.id)
          .maybeSingle() as any;
        setIde(privateIds?.ide ?? "");

        const { data: docs } = await supabase
          .from("therapist_documents" as any)
          .select("id, file_url, file_name, label, is_public")
          .eq("therapist_id", data.id)
          .order("created_at", { ascending: false });
        setDocuments((docs as any) ?? []);
      }
      setLoading(false);
    })();
  }, [user, profileStatePrefix]);

  useHashFocus(!loading);

  const markDirty = () => setDirty(true);

  // Specialty helpers
  const filteredSpecs = useMemo(() => {
    const q = specSearch.trim().toLowerCase();
    if (!q) return THERAPY_SPECIALTIES;
    return THERAPY_SPECIALTIES.filter((s) => s.toLowerCase().includes(q));
  }, [specSearch]);

  const toggleSpec = (s: string) => {
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    markDirty();
  };
  const addCustomSpec = () => {
    const v = customSpec.trim();
    if (!v || specialties.includes(v)) return;
    setSpecialties((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCustomSpecs((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCustomSpec("");
    markDirty();
  };
  const removeSpec = (s: string) => {
    setSpecialties((prev) => prev.filter((x) => x !== s));
    setCustomSpecs((prev) => prev.filter((x) => x !== s));
    markDirty();
  };

  const toggleLang = (code: string) => {
    setLangs((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
    markDirty();
  };


  // Document upload
  const onDocSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !rowId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5 Mo");
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("therapist-documents").upload(path, file);
    if (error) return toast.error(t("profile_edit.upload_error"));
    const { data: pub } = supabase.storage.from("therapist-documents").getPublicUrl(path);
    try {
      const { row } = await addDocument({ data: { file_url: pub.publicUrl, file_name: file.name, label: file.name.split(".")[0], is_public: false } });
      setDocuments((prev) => [row as DocRow, ...prev]);
    } catch {
      return toast.error(t("profile_edit.upload_error"));
    }
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const updateDoc = async (id: string, patch: Partial<DocRow>) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    await updateDocument({ data: { id, label: patch.label, is_public: patch.is_public } });
  };
  const deleteDoc = async (id: string) => {
    if (!confirm(t("profile_edit.delete_confirm"))) return;
    await deleteDocument({ data: { id } });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Save profile
  const onSave = async () => {
    if (!user) return;
    const currentScore = profileDraftScore(formSnapshot);
    const baselineScore = profileBaselineScoreRef.current;
    if (baselineScore >= 4 && currentScore <= baselineScore * 0.6) {
      toast.error("Sauvegarde bloquée : le formulaire semble incomplet. Rechargez la page avant d’enregistrer.");
      return;
    }
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      first_name: firstName || (user.email?.split("@")[0] ?? "Thérapeute"),
      last_name: lastName || "",
      slug: rowId
        ? undefined
        : (`${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + user.id.slice(0, 6)).replace(/^-+|-+$/g, ""),
      photo_url: photoPublicUrl || null,
      city, postal_code: postalCode, address, phone,
      canton, languages: langs,
      price_min: priceMin === "" ? null : Number(priceMin),
      price_max: priceMax === "" ? null : Number(priceMax),
      currency,
      years_experience: yearsExperience === "" ? null : Number(yearsExperience),
      specialties,
      services,
      short_bio: shortBio || null,
      bio: bio || null,
      google_reviews_url: googleReviewsUrl || null,
      website: website || null,
      accreditations,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    try {
      const { id } = await saveProfile({
        data: {
          rowId,
          public_slug: publicSlug ? publicSlug.trim() : null,
          photo_url: payload.photo_url,
          first_name: payload.first_name,
          last_name: payload.last_name,
          city,
          postal_code: postalCode,
          address,
          phone,
          canton,
          languages: langs,
          price_min: payload.price_min,
          price_max: payload.price_max,
          currency,
          years_experience: payload.years_experience,
          specialties,
          specialty_ids: specialtyIds,
          services,
          short_bio: payload.short_bio,
          bio: payload.bio,
          google_reviews_url: payload.google_reviews_url,
          website: payload.website,
          title: proTitle.trim() || null,
          meta_title: metaTitle.trim() || null,
          meta_description: metaDescription.trim() || null,
          consultation_modes: consultationModes,
          accreditations,
          social_links: socialPayload(socialLinks),
          // Formateur. L'année vide devient null plutôt que NaN : la contrainte
          // en base rejetterait NaN, et le champ est facultatif.
          is_trainer: isTrainer,
          trainer_subjects: trainerSubjects.trim() || null,
          trainer_institution: trainerInstitution.trim() || null,
          trainer_since: trainerSince.trim() === "" ? null : Number(trainerSince),
          ide: ide || null,
        },
      });
      if (!rowId) setRowId(id);
    } catch (error) {
      setSaving(false);
      return toast.error(t("profile_edit.save_error") + " — " + (error instanceof Error ? error.message : "Erreur"));
    }
    setDirty(false);
    await clearDraft();
    // Sauvegarde confirmée côté serveur : on invalide profil + audit, puis on
    // relance l'audit depuis les données persistées (score, catégories,
    // actions prioritaires et éléments manquants recalculés).
    const analyzedAt = await refreshShowcaseAfterSave(queryClient);
    setSaving(false);
    const when = formatAnalysisDate(analyzedAt);
    toast.success(
      `${t("profile_edit.saved_toast")} Votre score a été recalculé.`,
      when ? { description: `Nouvelle analyse : ${when}` } : undefined,
    );
  };

  const verifyIde = () => {
    const normalized = normalizeSwissIde(ide);
    if (!normalized) {
      toast.error(t("profile_edit.ide_invalid"));
      return;
    }
    setIde(normalized);
    setIdeVerified(true);
    markDirty();
    toast.success(t("profile_edit.ide_active"));
    // Open official UID register so user can confirm publicly
    window.open(`https://www.uid.admin.ch/Search.aspx?uid_id=${normalized}`, "_blank", "noopener");
  };

  const toggleAccreditation = (code: string) => {
    setAccreditations((prev) =>
      prev.find((a) => a.org === code)
        ? prev.filter((a) => a.org !== code)
        : [...prev, { org: code, number: "" }],
    );
    markDirty();
  };
  const updateAccreditationNumber = (code: string, number: string) => {
    setAccreditations((prev) => prev.map((a) => (a.org === code ? { ...a, number } : a)));
    markDirty();
  };

  if (loading) {
    return <div className="min-h-screen bg-[#1a0a2e] p-10 text-[#d4c4e0]">{t("profile_edit.loading")}</div>;
  }

  const initial = (firstName || "T").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#2a0f44] to-[#1a0a2e] pb-48 md:pb-32 text-[#e6d7f5]">
      <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.5)] p-6 backdrop-blur-md">
          <h1 className="font-bold tracking-tight text-white text-2xl sm:text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
            {t("profile_edit.page_title")}
          </h1>
          <p className="mt-2 text-sm text-[#a89bc4]">{t("profile_edit.page_subtitle")}</p>
          <div className="mt-3 flex justify-end">
            <DraftSavedIndicator status={draftStatus} savedAt={savedAt} />
          </div>
        </header>

        {/* Score de complétion — mis à jour en direct pendant l'édition */}
        <div className="mt-6">
          <ProfileCompletionCard
            profile={{
              photo_url: photoPublicUrl || photoUrl,
              first_name: firstName,
              last_name: lastName,
              short_bio: shortBio,
              bio,
              languages: langs,
              specialties,
              price_min: priceMin === "" ? null : Number(priceMin),
              city,
              canton,
              phone,
              accreditations,
              website,
              google_reviews_url: googleReviewsUrl,
            }}
          />
        </div>

        {/* Photos du cabinet & certifications (agent Santé de Profil) */}
        <Section id="photos-cabinet">
          <CabinetPhotosUploader userId={user!.id} />
          <Divider />
          <div id="certifications">
            <CertificationsUploader userId={user!.id} />
          </div>
          <Divider />
          <div id="faq">
            <FaqEditor />
          </div>
        </Section>

        {/* Identity */}
        <Section id="identite">
          <div id="photo">
          <ProfilePhotoUploader
            userId={user!.id}
            currentPhotoUrl={photoUrl}
            initial={initial}
            onPhotoUpdated={(pub, prev) => {
              setPhotoPublicUrl(pub);
              setPhotoUrl(prev);
              markDirty();
            }}
          />
          </div>

          <Divider />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("profile_edit.first_name") + " *"}>
              <Input value={firstName} onChange={(e) => { setFirstName(e.target.value); markDirty(); }} className={inputClass} />
            </Field>
            <Field label={t("profile_edit.last_name") + " *"}>
              <Input value={lastName} onChange={(e) => { setLastName(e.target.value); markDirty(); }} className={inputClass} />
            </Field>
          </div>

          <div className="mt-5">
            <Field label={<label htmlFor="pro-title">Titre professionnel *</label>}>
              <Input
                id="pro-title"
                value={proTitle}
                maxLength={80}
                onChange={(e) => { setProTitle(e.target.value); markDirty(); }}
                placeholder="Naturopathe · Praticienne en hypnose"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-[#a89bc4]">
                Affiché sous votre nom sur la fiche publique. Requis pour valider le critère « Nom et titre professionnel ».
              </p>
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  Slug public
                  <span className="text-xs font-normal text-[#a89bc4]">(URL de votre profil & formulaire d'admission)</span>
                </span>
              }
            >
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89bc4]" />
                <Input
                  value={publicSlug}
                  onChange={(e) => {
                    const v = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/^-+/, "")
                      .slice(0, 80);
                    setPublicSlug(v);
                    markDirty();
                  }}
                  placeholder="mon-cabinet-geneve"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <p className="mt-2 text-xs text-[#a89bc4]">
                holiswiss.ch/therapeute/<span className="text-[#b86ef9]">{publicSlug || "votre-slug"}</span> · holiswiss.ch/intake/<span className="text-[#b86ef9]">{publicSlug || "votre-slug"}</span>
              </p>
            </Field>
            <div className="mt-5">
              <QrCodePanel slug={publicSlug} />
            </div>
          </div>

          <div id="localisation" className="mt-5 grid gap-5 sm:grid-cols-3">
            <Field label={t("profile_edit.city") + " *"}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89bc4]" />
                <Input value={city} onChange={(e) => { setCity(e.target.value); markDirty(); }} className={`${inputClass} pl-9`} />
              </div>
            </Field>
            <Field label={t("profile_edit.postal_code")}>
              <Input value={postalCode} onChange={(e) => { setPostalCode(e.target.value); markDirty(); }} className={inputClass} />
            </Field>
            <Field label={t("profile_edit.address")}>
              <Input value={address} onChange={(e) => { setAddress(e.target.value); markDirty(); }} className={inputClass} />
            </Field>
          </div>

          <div id="contact" className="mt-5">
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  {t("profile_edit.phone")}
                  <span className="text-xs font-normal text-[#a89bc4]">{t("profile_edit.phone_visibility")}</span>
                </span>
              }
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89bc4]" />
                <Input value={phone} onChange={(e) => { setPhone(e.target.value); markDirty(); }} className={`${inputClass} pl-9`} />
              </div>
              <p className="mt-2 text-xs text-[#a89bc4]">{t("profile_edit.phone_protected_note")}</p>
            </Field>
          </div>
        </Section>

        {/* Approaches & languages */}
        <Section id="langues" title={t("profile_edit.section_approaches")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div id="canton">
            <Field label={t("profile_edit.canton")}>
              <Select value={canton} onValueChange={(v) => { setCanton(v); markDirty(); }}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {CANTONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            </div>
            <Field label={t("profile_edit.languages")}>
              <div className="flex flex-wrap gap-2">
                {SPOKEN_LANGUAGES.map((l) => {
                  const active = langs.includes(l.label);
                  return (
                    <button key={l.code} type="button" onClick={() => toggleLang(l.label)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        active
                          ? "border-[#b86ef9] bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white shadow-md shadow-[#b86ef9]/40"
                          : "border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.45)] text-[#d4c4e0] hover:border-[#b86ef9]"
                      }`}>
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div id="tarifs" className="mt-5">
            <Label className="text-sm font-medium text-white/90">{t("profile_edit.price_label")}</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_180px]">
              <Input type="number" placeholder={t("profile_edit.price_min")} value={priceMin} onChange={(e) => { setPriceMin(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
              <Input type="number" placeholder={t("profile_edit.price_max")} value={priceMax} onChange={(e) => { setPriceMax(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
              <Select value={currency} onValueChange={(v) => { setCurrency(v); markDirty(); }}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c === "EUR" ? "€ (EUR)" : c === "USD" ? "$ (USD)" : "CHF"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-[#a89bc4]">
              {t("profile_edit.price_helper", { min: priceMin || "—", max: priceMax || "—" })}
            </p>
          </div>

          <div id="experience" className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={t("profile_edit.session_duration")}>
              <Input type="number" value={sessionDuration} onChange={(e) => { setSessionDuration(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
            </Field>
            <Field label={t("profile_edit.years_experience")}>
              <Input type="number" value={yearsExperience} onChange={(e) => { setYearsExperience(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Specialties */}
        <Section id="specialites" title={t("profile_edit.section_specialties") + " *"}>
          <TaxonomySpecialtyPicker
            selectedIds={specialtyIds}
            onChange={(ids) => { setSpecialtyIds(ids); markDirty(); }}
            onLabelsChange={(labels) => {
              // Merge taxonomy labels with user-added custom specialties (dedup, case-insensitive).
              const seen = new Set<string>();
              const merged: string[] = [];
              for (const l of [...labels, ...customSpecs]) {
                const k = (l || "").toLowerCase();
                if (!l || seen.has(k)) continue;
                seen.add(k);
                merged.push(l);
              }
              setSpecialties(merged);
            }}
          />

          {/* Custom (free-text) specialty */}
          <div className="mt-5 rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.35)] p-4">
            <p className="mb-2 text-sm font-medium text-white">
              {t("profile_edit.custom_specialty_title", { defaultValue: "Ajouter une spécialité personnalisée" })}
            </p>
            <p className="mb-3 text-xs text-[#a89bc4]">
              {t("profile_edit.custom_specialty_help", { defaultValue: "Si votre spécialité n'apparaît pas dans la liste ci-dessus, ajoutez-la ici." })}
            </p>
            <div className="flex gap-2">
              <Input
                value={customSpec}
                onChange={(e) => setCustomSpec(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSpec(); } }}
                placeholder={t("profile_edit.custom_specialty_placeholder", { defaultValue: "Ex : Soins égyptiens" })}
                className={inputClass}
              />
              <Button type="button" onClick={addCustomSpec} className="shrink-0 bg-[#b86ef9] hover:bg-[#a855f7] text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t("profile_edit.add", { defaultValue: "Ajouter" })}
              </Button>
            </div>
            {customSpecs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {customSpecs.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/15 px-3 py-1 text-xs text-white">
                    {s}
                    <button type="button" onClick={() => removeSpec(s)} className="opacity-60 hover:opacity-100" aria-label={`Retirer ${s}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Modes de consultation */}
        <Section
          id="modes"
          title="Modes de consultation"
          subtitle="Indiquez comment vos client·es peuvent vous rencontrer. Ces modes apparaissent sur votre fiche publique."
        >
          <div className="flex flex-wrap gap-2.5">
            {CONSULTATION_MODES.map((m) => {
              const active = consultationModes.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setConsultationModes((prev) =>
                      prev.includes(m.value) ? prev.filter((x) => x !== m.value) : [...prev, m.value],
                    );
                    markDirty();
                  }}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]/60 ${
                    active
                      ? "border-[#b86ef9] bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white shadow-md shadow-[#b86ef9]/40"
                      : "border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.45)] text-[#d4c4e0] hover:border-[#b86ef9]"
                  }`}
                >
                  {active && <Check className="h-4 w-4" aria-hidden="true" />}
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#a89bc4]">
            Au moins un mode est nécessaire pour que le visiteur sache comment réserver.
          </p>
        </Section>

        {/* Services */}
        <Section id="prestations" title={t("profile_edit.section_services")} action={
          <ServiceDialog onAdd={(s) => { setServices((prev) => [...prev, s]); markDirty(); }} />
        } subtitle={t("profile_edit.services_help")}>
          <div className="space-y-3">
            {services.length === 0 && (
              <p className="text-sm text-[#a89bc4]">—</p>
            )}
            {services.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.5)] p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-white">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color || "#3b82f6" }} />
                    {s.kind === "package" && (
                      <span className="rounded-full bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        {t("profile_edit.service_kind_package", { defaultValue: "Forfait" })}
                      </span>
                    )}
                    <span className="font-semibold">{s.name}</span>
                    {s.visible === false && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.15)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#a89bc4]">
                        <EyeOff className="h-3 w-3" />
                        {t("profile_edit.service_hidden", { defaultValue: "Masqué" })}
                      </span>
                    )}
                  </div>
                  {s.short_description && (
                    <p className="mt-1 text-xs text-[#c9b8e0] line-clamp-1">{s.short_description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#a89bc4]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {s.kind === "package" && s.sessions_count
                        ? `${s.sessions_count} × ${s.session_duration_min ?? s.duration_min} ${t("profile_edit.min_short")}`
                        : `${s.duration_min} ${t("profile_edit.min_short")}`}
                    </span>
                    {s.price_chf != null && (
                      <span className="text-[#5cc8fa] font-medium">· {s.price_chf} CHF</span>
                    )}
                    {s.format && (
                      <span className="capitalize">· {t(`profile_edit.format_${s.format}`, { defaultValue: s.format })}</span>
                    )}
                    {s.description && <span className="truncate">· {s.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      setServices((prev) => {
                        if (i === 0) return prev;
                        const next = [...prev];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return next.map((x, idx) => ({ ...x, order: idx }));
                      });
                      markDirty();
                    }}
                    className="rounded-md p-2 text-[#a89bc4] hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Monter"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === services.length - 1}
                    onClick={() => {
                      setServices((prev) => {
                        if (i === prev.length - 1) return prev;
                        const next = [...prev];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        return next.map((x, idx) => ({ ...x, order: idx }));
                      });
                      markDirty();
                    }}
                    className="rounded-md p-2 text-[#a89bc4] hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Descendre"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <ServiceDialog
                    initial={s}
                    trigger={<button type="button" className="rounded-md p-2 text-[#a89bc4] hover:bg-white/5 hover:text-white"><Pencil className="h-4 w-4" /></button>}
                    onAdd={(updated) => { setServices((prev) => prev.map((x, idx) => (idx === i ? updated : x))); markDirty(); }}
                  />
                  <button type="button" onClick={() => { setServices((prev) => prev.filter((_, idx) => idx !== i)); markDirty(); }}
                    className="rounded-md p-2 text-[#ef4444] hover:bg-[#ef4444]/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Bio + links */}
        <Section id="presentation">
          <div id="accroche">
          <Field label={t("profile_edit.short_bio")}>
            <Input value={shortBio} maxLength={150} onChange={(e) => { setShortBio(e.target.value); markDirty(); }} className={inputClass} />
            <p className="mt-1.5 text-xs text-[#a89bc4]">{shortBio.length}/150</p>
          </Field>
          </div>

          <div className="mt-5">
            <Field label={t("profile_edit.full_description")}>
              <Textarea value={bio} onChange={(e) => { setBio(e.target.value); markDirty(); }} rows={6} className={`${inputClass} resize-y`} />
            </Field>
          </div>

          <div id="liens" className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={<span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4" />{t("profile_edit.google_reviews_link")}</span>}>
              <Input value={googleReviewsUrl} onChange={(e) => { setGoogleReviewsUrl(e.target.value); markDirty(); }} placeholder="https://g.page/..." className={inputClass} />
            </Field>
            <Field label={<span className="inline-flex items-center gap-2"><Globe className="h-4 w-4" />{t("profile_edit.website_link")}</span>}>
              <Input value={website} onChange={(e) => { setWebsite(e.target.value); markDirty(); }} placeholder="https://" className={inputClass} />
            </Field>
          </div>

          <Divider />

          <div id="ide">
          <Field label={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#b86ef9]" />
              <span className="font-semibold text-white">{t("profile_edit.ide_label")}</span>
              <span className="text-xs font-normal text-[#a89bc4]">{t("profile_edit.ide_visibility")}</span>
            </span>
          }>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showIde ? "text" : "password"}
                  value={ide}
                  placeholder="CHE-123.456.789"
                  onChange={(e) => { setIde(e.target.value); setIdeVerified(false); markDirty(); }}
                  className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowIde((v: boolean) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#a89bc4] hover:bg-white/5">
                  {showIde ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" onClick={verifyIde} variant="outline"
                className="border-[#b86ef9]/40 bg-transparent text-[#d4a5f9] hover:bg-[#b86ef9]/10">
                {t("profile_edit.ide_verify")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[#a89bc4]">{t("profile_edit.ide_helper")}</p>
            {ideVerified && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-2.5 text-sm text-[#86efac]">
                <ShieldCheck className="h-4 w-4" />{t("profile_edit.ide_active")}
              </div>
            )}
          </Field>
          </div>

          <Divider />

          {/* Accreditations */}
          <Field label={
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-[#b86ef9]" />
              <span className="font-semibold text-white">{t("profile_edit.accreditations_label")}</span>
            </span>
          }>
            <p className="mb-3 text-xs text-[#a89bc4]">{t("profile_edit.accreditations_helper")}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ACCREDITATION_ORGS.map((org) => {
                const sel = accreditations.find((a) => a.org === org.code);
                const active = !!sel;
                return (
                  <div
                    key={org.code}
                    className={`rounded-xl border p-3 transition ${
                      active
                        ? "border-[#b86ef9] bg-[#b86ef9]/10"
                        : "border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.4)]"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleAccreditation(org.code)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                          active
                            ? "border-[#b86ef9] bg-[#b86ef9] text-white"
                            : "border-[#b86ef9]/40 bg-transparent"
                        }`}
                        aria-label={org.label}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{org.label}</div>
                        <div className="text-xs text-[#a89bc4]">{org.description}</div>
                      </div>
                    </label>
                    {active && (
                      <Input
                        value={sel?.number ?? ""}
                        onChange={(e) => updateAccreditationNumber(org.code, e.target.value)}
                        placeholder={t("profile_edit.accreditation_number_placeholder")}
                        className={`${inputClass} mt-3`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Field>

          <Divider />

          {/* Réseaux sociaux */}
          <Field label={
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold text-white">Réseaux sociaux</span>
            </span>
          }>
            <div id="reseaux-sociaux">
              <SocialLinksEditor
                value={socialLinks}
                onChange={(next) => { setSocialLinks(next); markDirty(); }}
                inputClass={inputClass}
              />
            </div>
          </Field>

          <Divider />

          {/* Formateur — déclaratif, comme les accréditations juste au-dessus. */}
          <Field label={
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#b86ef9]" />
              <span className="font-semibold text-white">Formations dispensées</span>
            </span>
          }>
            <div className="flex items-center gap-2.5">
              <Switch
                id="is-trainer"
                checked={isTrainer}
                onCheckedChange={(v) => { setIsTrainer(v); setDirty(true); }}
              />
              <Label htmlFor="is-trainer" className="cursor-pointer text-sm">
                Je dispense des formations
              </Label>
            </div>

            {isTrainer && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="trainer-subjects" className="text-xs">Matières enseignées</Label>
                  <Input
                    id="trainer-subjects"
                    value={trainerSubjects}
                    maxLength={300}
                    placeholder="Naturopathie, phytothérapie"
                    onChange={(e) => { setTrainerSubjects(e.target.value); setDirty(true); }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                  <div>
                    <Label htmlFor="trainer-institution" className="text-xs">
                      École ou organisme <span className="text-[#a89bc4]">(facultatif)</span>
                    </Label>
                    <Input
                      id="trainer-institution"
                      value={trainerInstitution}
                      maxLength={200}
                      placeholder="École de Naturopathie de Sion"
                      onChange={(e) => { setTrainerInstitution(e.target.value); setDirty(true); }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trainer-since" className="text-xs">
                      Depuis <span className="text-[#a89bc4]">(facultatif)</span>
                    </Label>
                    <Input
                      id="trainer-since"
                      type="number"
                      inputMode="numeric"
                      min={1950}
                      max={new Date().getFullYear() + 1}
                      value={trainerSince}
                      placeholder="2019"
                      onChange={(e) => { setTrainerSince(e.target.value); setDirty(true); }}
                    />
                  </div>
                </div>

                {/* L'état réel, dit sans détour : cocher ne suffit pas. */}
                <p className="text-xs text-[#a89bc4]" role="status">
                  {trainerSubjects.trim()
                    ? "Le badge « Formateur » apparaîtra sur votre fiche publique, présenté comme une information que vous déclarez — Holiswiss ne la vérifie pas."
                    : "Renseignez les matières enseignées pour que le badge apparaisse : un badge « Formateur » seul n'apprendrait rien à un visiteur."}
                </p>
              </div>
            )}
          </Field>

          {!dirty && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#b86ef9]/30 bg-[rgba(20,8,40,0.3)] px-4 py-3 text-sm text-[#d4a5f9]">
              <Check className="h-4 w-4" />{t("profile_edit.no_changes")}
            </div>
          )}
        </Section>

        {/* SEO */}
        <Section
          id="seo"
          title={<span className="inline-flex items-center gap-2"><Globe className="h-5 w-5 text-[#b86ef9]" />Référencement (SEO)</span>}
          subtitle="Le titre et la description affichés par Google pour votre fiche. Laissez vide pour utiliser le texte généré automatiquement."
        >
          <div id="seo-title">
          <Field
            label={
              <label htmlFor="meta-title" className="inline-flex items-center gap-2">
                Title SEO
                {seoTitleStatus.passed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(159,216,168,0.15)] px-2 py-0.5 text-[11px] font-medium text-[#9fd8a8]">
                    <BadgeCheck className="h-3 w-3" aria-hidden="true" />Validé
                  </span>
                )}
              </label>
            }
          >
            <Input
              id="meta-title"
              value={metaTitle}
              maxLength={70}
              onChange={(e) => { setMetaTitle(e.target.value); markDirty(); }}
              placeholder="Prénom Nom — Thérapeute à Genève"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-[#a89bc4]">
              {seoTitleResolution.length} caractères · règle : {SEO_TITLE_MIN} à {SEO_TITLE_MAX} caractères.
              {seoTitleResolution.source === "generated" && " Titre généré automatiquement (champ vide)."}
            </p>
            <p className={`mt-1 text-xs ${seoTitleStatus.passed ? "text-[#9fd8a8]" : "text-[#f0b26b]"}`}>
              {seoTitleStatus.message}
            </p>
            {seoTitleResolution.value && (
              <p className="mt-1 truncate text-xs text-[#a89bc4]">
                Valeur publiée : « {seoTitleResolution.value} »
              </p>
            )}
          </Field>
          </div>

          <div id="seo-description" className="mt-5">
            <Field label={<label htmlFor="meta-description">Meta description</label>}>
              <Textarea
                id="meta-description"
                value={metaDescription}
                maxLength={170}
                rows={3}
                onChange={(e) => { setMetaDescription(e.target.value); markDirty(); }}
                placeholder="Accompagnement en… à … . Séances au cabinet ou en visio, sur rendez-vous."
                className={`${inputClass} h-auto resize-y py-2`}
              />
              <p className="mt-1.5 text-xs text-[#a89bc4]">
                {metaDescription.length}/170 · visez {SEO_DESC_MIN} à {SEO_DESC_MAX} caractères.
              </p>
              <p className={`mt-1 text-xs ${seoDescStatus.passed ? "text-[#9fd8a8]" : "text-[#f0b26b]"}`}>
                {seoDescStatus.message}
              </p>
            </Field>
          </div>

          {/* Aperçu du résultat de recherche */}
          <div className="mt-5 rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.45)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#a89bc4]">Aperçu dans les résultats de recherche</p>
            <p className="mt-2 truncate text-xs text-[#9fd8a8]">holiswiss.ch › thérapeute</p>
            <p className="mt-0.5 line-clamp-2 text-base text-[#8ab4f8]">
              {seoTitleResolution.value || "Titre de votre fiche"}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-[#c7bcd8]">
              {seoDescResolution.value || "La description affichée sous votre titre dans Google."}
            </p>
          </div>
        </Section>

        {/* Payment methods (private, used only on invoices) */}
        <Section
          title={<span className="inline-flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[#b86ef9]" />Moyens de paiement</span>}
          subtitle="Configurez vos liens de paiement. Vous choisirez ensuite, facture par facture, lesquels y faire apparaître."
        >
          <PaymentMethodsPanel />
        </Section>

        {/* Documents */}
        <Section
          title={<span className="inline-flex items-center gap-2"><FileText className="h-5 w-5 text-[#b86ef9]" />{t("profile_edit.section_documents")}</span>}
          subtitle={t("profile_edit.documents_subtitle")}
          action={
            <>
              <input ref={docInputRef} type="file" accept=".pdf,image/png,image/jpeg" className="hidden" onChange={onDocSelected} />
              <Button type="button" onClick={() => docInputRef.current?.click()} variant="outline"
                className="border-[#b86ef9]/40 bg-transparent text-[#d4a5f9] hover:bg-[#b86ef9]/10">
                <Plus className="mr-1.5 h-4 w-4" />{t("profile_edit.add_document")}
              </Button>
            </>
          }
        >
          <div className="rounded-xl border border-dashed border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.3)] p-4 text-center text-xs text-[#a89bc4]">
            {t("profile_edit.documents_help")}
          </div>

          {documents.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(184,110,249,0.18)]">
              <div className="grid grid-cols-[2fr_2fr_1.5fr_auto] gap-3 border-b border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.5)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#a89bc4]">
                <span>{t("profile_edit.col_document")}</span>
                <span>{t("profile_edit.col_label")}</span>
                <span>{t("profile_edit.col_visibility")}</span>
                <span className="text-right">{t("profile_edit.col_actions")}</span>
              </div>
              {documents.map((d) => (
                <div key={d.id} className="grid grid-cols-[2fr_2fr_1.5fr_auto] items-center gap-3 border-b border-[rgba(184,110,249,0.12)] px-4 py-3 last:border-0">
                  <a href={d.file_url} target="_blank" rel="noreferrer"
                    className="truncate rounded-md border border-[#b86ef9]/30 bg-[#b86ef9]/10 px-2.5 py-1 text-xs text-[#d4a5f9] hover:bg-[#b86ef9]/20">
                    {d.file_name}
                  </a>
                  <Input
                    value={d.label ?? ""}
                    onChange={(e) => setDocuments((prev) => prev.map((doc) => (doc.id === d.id ? { ...doc, label: e.target.value } : doc)))}
                    onBlur={(e) => updateDocument({ data: { id: d.id, label: e.target.value, is_public: d.is_public } })}
                    className={inputClass}
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#d4c4e0]">
                    <Switch checked={d.is_public} onCheckedChange={(v) => updateDoc(d.id, { is_public: v })} />
                    <span>{d.is_public ? t("profile_edit.visible_to_visitors") : t("profile_edit.hidden_from_visitors")}</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => deleteDoc(d.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#ef4444]/40 bg-transparent px-3 py-1.5 text-xs text-[#ef4444] hover:bg-[#ef4444]/10">
                      <Trash2 className="h-3.5 w-3.5" />{t("profile_edit.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Newsletter */}
        <Section
          title={<span className="inline-flex items-center gap-2"><Mail className="h-5 w-5 text-[#b86ef9]" />{t("profile_edit.newsletter_title")}</span>}
          subtitle={t("profile_edit.newsletter_subtitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-[rgba(184,110,249,0.15)] bg-[rgba(20,8,40,0.4)] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b86ef9]" />
              <div>
                <p className="font-medium text-white">{t("profile_edit.newsletter_benefit_1_title")}</p>
                <p className="text-sm text-[#a89bc4]">{t("profile_edit.newsletter_benefit_1_body")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[rgba(184,110,249,0.15)] bg-[rgba(20,8,40,0.4)] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b86ef9]" />
              <div>
                <p className="font-medium text-white">{t("profile_edit.newsletter_benefit_2_title")}</p>
                <p className="text-sm text-[#a89bc4]">{t("profile_edit.newsletter_benefit_2_body")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[rgba(184,110,249,0.15)] bg-[rgba(20,8,40,0.4)] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b86ef9]" />
              <div>
                <p className="font-medium text-white">{t("profile_edit.newsletter_benefit_3_title")}</p>
                <p className="text-sm text-[#a89bc4]">{t("profile_edit.newsletter_benefit_3_body")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[rgba(184,110,249,0.15)] bg-[rgba(20,8,40,0.4)] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b86ef9]" />
              <div>
                <p className="font-medium text-white">{t("profile_edit.newsletter_benefit_4_title")}</p>
                <p className="text-sm text-[#a89bc4]">{t("profile_edit.newsletter_benefit_4_body")}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.6)] p-4 sm:p-5">
            {newsletterOptIn && (
              <div className="mb-4">
                <p className="flex items-start gap-2 rounded-lg border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] p-3 text-sm text-[#7de3b8]">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t("profile_edit.newsletter_status_active")}
                    {newsletterOptInAt
                      ? ` ${t("profile_edit.newsletter_status_since")} ${new Date(newsletterOptInAt).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" })}.`
                      : ""}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setNewsletterPrefsOpen((v) => !v)}
                    aria-expanded={newsletterPrefsOpen}
                  >
                    {t("profile_edit.newsletter_manage_prefs")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[44px] text-[#ff8f8f] hover:bg-[rgba(239,68,68,0.12)] hover:text-[#ffb1b1]"
                    disabled={newsletterLoading}
                    onClick={() => setNewsletterUnsubOpen(true)}
                  >
                    {t("profile_edit.newsletter_unsubscribe_action")}
                  </Button>
                </div>
              </div>
            )}

            {(!newsletterOptIn || newsletterPrefsOpen) && (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                disabled={newsletterLoading}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (!next) {
                    setNewsletterUnsubOpen(true);
                    return;
                  }
                  void applyNewsletterConsent(true);
                }}
                className="mt-1 h-5 w-5 shrink-0 rounded border-[rgba(184,110,249,0.4)] bg-[rgba(20,8,40,0.5)] text-[#b86ef9] focus:ring-[#b86ef9] focus:ring-offset-0"
              />
              <div className="space-y-1">
                <span className="block text-sm font-medium text-white">{t("profile_edit.newsletter_consent_label")}</span>
                <span className="block text-xs text-[#a89bc4]">
                  {t("profile_edit.newsletter_consent_note")}{" "}
                  <a href={`/fr/confidentialite`} target="_blank" rel="noreferrer" className="underline hover:text-[#d4a5f9]">
                    {t("profile_edit.newsletter_privacy_link")}
                  </a>
                  .
                </span>
              </div>
            </label>
            )}
          </div>

          <Dialog open={newsletterUnsubOpen} onOpenChange={setNewsletterUnsubOpen}>
            <DialogContent className="border-[rgba(184,110,249,0.25)] bg-[#1a0b2e] text-white">
              <DialogHeader>
                <DialogTitle>{t("profile_edit.newsletter_unsub_confirm_title")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[#a89bc4]">{t("profile_edit.newsletter_unsub_confirm_body")}</p>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => setNewsletterUnsubOpen(false)}
                >
                  {t("profile_edit.newsletter_unsub_cancel")}
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] bg-[#ef4444] text-white hover:bg-[#dc2626]"
                  disabled={newsletterLoading}
                  onClick={async () => {
                    const ok = await applyNewsletterConsent(false);
                    if (ok) {
                      setNewsletterUnsubOpen(false);
                      setNewsletterPrefsOpen(false);
                    }
                  }}
                >
                  {t("profile_edit.newsletter_unsub_confirm_cta")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.85)] backdrop-blur-xl md:bottom-0 md:z-40"
        style={{ touchAction: "manipulation" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Button type="button" variant="ghost" className="min-h-11 text-[#d4c4e0] hover:bg-white/5">
            {t("profile_edit.cancel_btn")}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}
            className="min-h-11 gap-2 bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white shadow-lg shadow-[#b86ef9]/30 transition-transform hover:opacity-95 active:scale-[0.98]">
            <Save className="h-4 w-4" />{saving ? "…" : t("profile_edit.save_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.55)] px-3 text-white placeholder:text-[#a89bc4] focus:border-[#b86ef9] focus-visible:ring-2 focus-visible:ring-[#b86ef9]/40";
const selectClass =
  "h-11 w-full rounded-xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.55)] px-3 text-white focus:ring-2 focus:ring-[#b86ef9]/40 [&>span]:text-white";

function Section({
  id, title, subtitle, action, children,
}: {
  id?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-6 rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.5)] p-6 backdrop-blur-md sm:p-8">
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-[#a89bc4]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-gradient-to-r from-transparent via-[#b86ef9]/30 to-transparent" />;
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-white/90">{label}</Label>
      {children}
    </div>
  );
}

function ServiceDialog({
  initial, onAdd, trigger,
}: {
  initial?: TherapistService;
  onAdd: (s: TherapistService) => void;
  trigger?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const serviceStateKey = `dashboard.profile.service.${initial?.id ?? "new"}`;
  const [open, setOpen] = useSessionState(`${serviceStateKey}.open`, false);
  const [name, setName] = useSessionState(`${serviceStateKey}.name`, initial?.name ?? "");
  const [dur, setDur] = useSessionState<number | "">(`${serviceStateKey}.duration`, initial?.duration_min ?? 60);
  const [price, setPrice] = useSessionState<number | "">(`${serviceStateKey}.price`, initial?.price_chf ?? "");
  const [format, setFormat] = useSessionState<"in_person" | "online" | "hybrid">(`${serviceStateKey}.format`, initial?.format ?? "in_person");
  const [desc, setDesc] = useSessionState(`${serviceStateKey}.description`, initial?.description ?? "");
  const [color, setColor] = useSessionState(`${serviceStateKey}.color`, initial?.color ?? SERVICE_COLORS[1]);
  const [kind, setKind] = useSessionState<"session" | "package">(`${serviceStateKey}.kind`, initial?.kind ?? "session");
  const [shortDesc, setShortDesc] = useSessionState(`${serviceStateKey}.short_description`, initial?.short_description ?? "");
  const [visible, setVisible] = useSessionState<boolean>(`${serviceStateKey}.visible`, initial?.visible !== false);
  const [sessionsCount, setSessionsCount] = useSessionState<number | "">(`${serviceStateKey}.sessions_count`, initial?.sessions_count ?? "");
  const [sessionDurationMin, setSessionDurationMin] = useSessionState<number | "">(`${serviceStateKey}.session_duration_min`, initial?.session_duration_min ?? "");

  const submit = () => {
    if (!name.trim() || !dur) return;
    onAdd({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      duration_min: Number(dur),
      price_chf: price === "" ? undefined : Number(price),
      format,
      description: desc.trim() || undefined,
      color,
      kind,
      short_description: shortDesc.trim() || undefined,
      visible,
      sessions_count: kind === "package" && sessionsCount !== "" ? Number(sessionsCount) : undefined,
      session_duration_min: kind === "package" && sessionDurationMin !== "" ? Number(sessionDurationMin) : undefined,
      order: initial?.order,
    });
    setOpen(false);
    if (!initial) {
      setName(""); setDur(60); setPrice(""); setFormat("in_person"); setDesc("");
      setShortDesc(""); setKind("session"); setVisible(true);
      setSessionsCount(""); setSessionDurationMin("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" className="border-[#b86ef9]/40 bg-transparent text-[#d4a5f9] hover:bg-[#b86ef9]/10">
            <Plus className="mr-1.5 h-4 w-4" />{t("profile_edit.add_btn")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-[#b86ef9]/30 bg-[#1a0a2e] text-[#e6d7f5] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-[#b86ef9]/15 shrink-0">
          <DialogTitle className="text-white">
            {initial ? t("profile_edit.edit") : t("profile_edit.add_service")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto px-6 py-4 flex-1 min-h-0">
          <Field label={t("profile_edit.service_kind", { defaultValue: "Type" })}>
            <div className="flex gap-2">
              {(["session", "package"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    kind === k
                      ? "border-[#b86ef9] bg-[rgba(184,110,249,0.15)] text-white"
                      : "border-[rgba(184,110,249,0.2)] bg-transparent text-[#a89bc4] hover:text-white"
                  }`}
                >
                  {k === "session"
                    ? t("profile_edit.service_kind_session", { defaultValue: "Séance" })
                    : t("profile_edit.service_kind_package", { defaultValue: "Forfait" })}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("profile_edit.service_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profile_edit.service_min_placeholder")} className={inputClass} />
          </Field>
          <Field label={t("profile_edit.service_short_description", { defaultValue: "Description courte (SEO)" })}>
            <Input
              value={shortDesc}
              maxLength={160}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder={t("profile_edit.service_short_desc_placeholder", { defaultValue: "Résumé en une phrase, visible dans la liste" })}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-[#a89bc4]">{shortDesc.length}/160</p>
          </Field>
          <Field label={t("profile_edit.service_duration")}>
            <Input type="number" value={dur} onChange={(e) => setDur(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
          </Field>
          {kind === "package" && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
              <Field label={t("profile_edit.package_sessions_count", { defaultValue: "Nombre de séances incluses" })}>
                <Input
                  type="number"
                  min={1}
                  value={sessionsCount}
                  onChange={(e) => setSessionsCount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 5"
                  className={inputClass}
                />
              </Field>
              <Field label={t("profile_edit.package_session_duration", { defaultValue: "Durée par séance (min)" })}>
                <Input
                  type="number"
                  min={5}
                  value={sessionDurationMin}
                  onChange={(e) => setSessionDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex: 60"
                  className={inputClass}
                />
              </Field>
              <p className="sm:col-span-2 text-xs text-amber-200/80">
                {t("profile_edit.package_helper", { defaultValue: "Le tarif au-dessus est le prix global du forfait. La durée renseignée dans « Durée » est la durée totale d'accompagnement (facultative)." })}
              </p>
            </div>
          )}
          <Field label={t("profile_edit.service_price", { defaultValue: "Tarif (CHF)" })}>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Ex: 120"
              className={inputClass}
            />
          </Field>
          <Field label={t("profile_edit.service_format", { defaultValue: "Format" })}>
            <Select value={format} onValueChange={(v) => setFormat(v as "in_person" | "online" | "hybrid")}>
              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">{t("profile_edit.format_in_person", { defaultValue: "Présentiel" })}</SelectItem>
                <SelectItem value="online">{t("profile_edit.format_online", { defaultValue: "En ligne" })}</SelectItem>
                <SelectItem value="hybrid">{t("profile_edit.format_hybrid", { defaultValue: "Hybride" })}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("profile_edit.service_description")}>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("profile_edit.service_desc_placeholder")} className={`${inputClass} resize-y`} />
          </Field>
          <Field label={t("profile_edit.service_color")}>
            <div className="flex gap-2">
              {SERVICE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.5)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-white">
              {visible ? <Eye className="h-4 w-4 text-[#5cc8fa]" /> : <EyeOff className="h-4 w-4 text-[#a89bc4]" />}
              <span>{t("profile_edit.service_visible", { defaultValue: "Visible sur le profil public" })}</span>
            </div>
            <Switch checked={visible} onCheckedChange={setVisible} />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-[#b86ef9]/15 shrink-0 bg-[#1a0a2e]">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-[#d4c4e0]">
            {t("profile_edit.cancel_btn")}
          </Button>
          <Button type="button" onClick={submit} className="bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white">
            <Save className="mr-1.5 h-4 w-4" />{t("profile_edit.save_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}