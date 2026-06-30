import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Camera, X, Plus, Search, MapPin, Phone, Globe, Link2, ShieldCheck,
  FileText, Trash2, Pencil, Upload, Clock, Save, Eye, EyeOff, Check, BadgeCheck,
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
import ProfilePhotoUploader from "@/components/dashboard/ProfilePhotoUploader";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DraftSavedIndicator } from "@/components/drafts/DraftBanner";
import { hasSessionState, useSessionState } from "@/hooks/use-session-state";
import PaymentMethodsPanel from "@/components/dashboard/PaymentMethodsPanel";
import QrCodePanel from "@/components/dashboard/QrCodePanel";


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
const SERVICE_COLORS = ["#3b82f6", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#ef4444"];
const THERAPIST_PROFILE_SELECT = [
  "id", "slug", "photo_url", "first_name", "last_name", "city", "postal_code", "address", "phone",
  "canton", "languages", "price_min", "price_max", "currency", "years_experience",
  "specialties", "services", "short_bio", "bio", "google_reviews_url", "website",
  "ide_verified", "accreditations",
].join(",");

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
  const [specSearch, setSpecSearch] = useSessionState(`${profileStatePrefix}.specSearch`, "");
  const [customSpec, setCustomSpec] = useSessionState(`${profileStatePrefix}.customSpec`, "");

  // Services
  const [services, setServices] = useSessionState<TherapistService[]>(`${profileStatePrefix}.services`, []);

  // Texts
  const [shortBio, setShortBio] = useSessionState(`${profileStatePrefix}.shortBio`, "");
  const [bio, setBio] = useSessionState(`${profileStatePrefix}.bio`, "");
  const [googleReviewsUrl, setGoogleReviewsUrl] = useSessionState(`${profileStatePrefix}.googleReviewsUrl`, "");
  const [website, setWebsite] = useSessionState(`${profileStatePrefix}.website`, "");

  // SIRET
  // Swiss IDE / UID (CHE-XXX.XXX.XXX)
  const [ide, setIde] = useSessionState(`${profileStatePrefix}.ide`, "");
  const [ideVerified, setIdeVerified] = useSessionState(`${profileStatePrefix}.ideVerified`, false);
  const [showIde, setShowIde] = useState(false);

  // Accreditations (ASCA, RME, OrTra TC, ...)
  const [accreditations, setAccreditations] = useSessionState<Accreditation[]>(`${profileStatePrefix}.accreditations`, []);

  // Documents
  const [documents, setDocuments] = useSessionState<DocRow[]>(`${profileStatePrefix}.documents`, []);

  const docInputRef = useRef<HTMLInputElement>(null);

  // ---- Auto-save draft ----
  const formSnapshot = useMemo(() => ({
    firstName, lastName, city, postalCode, address, phone, canton, langs,
    priceMin, priceMax, currency, sessionDuration, yearsExperience, specialties, services,
    shortBio, bio, googleReviewsUrl, website, ide, accreditations,
  }), [firstName, lastName, city, postalCode, address, phone, canton, langs,
      priceMin, priceMax, currency, sessionDuration, yearsExperience, specialties, services,
      shortBio, bio, googleReviewsUrl, website, ide, accreditations]);

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
      if (data) {
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
        setWebsite(data.website ?? "");
        setIdeVerified((data as any).ide_verified ?? false);
        setAccreditations(((data as any).accreditations as Accreditation[]) ?? []);
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
    setSpecialties((prev) => [...prev, v]);
    setCustomSpec("");
    markDirty();
  };
  const removeSpec = (s: string) => {
    setSpecialties((prev) => prev.filter((x) => x !== s));
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
          services,
          short_bio: payload.short_bio,
          bio: payload.bio,
          google_reviews_url: payload.google_reviews_url,
          website: payload.website,
          accreditations,
          ide: ide || null,
        },
      });
      if (!rowId) setRowId(id);
    } catch (error) {
      setSaving(false);
      return toast.error(t("profile_edit.save_error") + " — " + (error instanceof Error ? error.message : "Erreur"));
    }
    setSaving(false);
    setDirty(false);
    await clearDraft();
    toast.success(t("profile_edit.saved_toast"));
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
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#2a0f44] to-[#1a0a2e] pb-32 text-[#e6d7f5]">
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

        {/* Identity */}
        <Section>
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
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
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

          <div className="mt-5">
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
        <Section title={t("profile_edit.section_approaches")}>
          <div className="grid gap-5 sm:grid-cols-2">
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

          <div className="mt-5">
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

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={t("profile_edit.session_duration")}>
              <Input type="number" value={sessionDuration} onChange={(e) => { setSessionDuration(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
            </Field>
            <Field label={t("profile_edit.years_experience")}>
              <Input type="number" value={yearsExperience} onChange={(e) => { setYearsExperience(e.target.value === "" ? "" : Number(e.target.value)); markDirty(); }} className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Specialties */}
        <Section title={t("profile_edit.section_specialties") + " *"}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89bc4]" />
            <Input value={specSearch} onChange={(e) => setSpecSearch(e.target.value)} placeholder={t("profile_edit.search_specialty")} className={`${inputClass} pl-9`} />
          </div>

          {specialties.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm text-[#a89bc4]">{t("profile_edit.selected_count", { count: specialties.length })}</p>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => {
                  const isCustom = !THERAPY_SPECIALTIES.includes(s);
                  return (
                    <div key={s} className={`group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      isCustom
                        ? "border-[#5cc8fa]/50 bg-[#5cc8fa]/10 text-[#9be0ff]"
                        : "border-[#b86ef9]/40 bg-[#b86ef9]/10 text-white"
                    }`}>
                      <span>{s}</span>
                      {isCustom && (
                        <span className="rounded bg-[#5cc8fa]/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#9be0ff]">
                          {t("profile_edit.custom_badge")}
                        </span>
                      )}
                      <button type="button" onClick={() => removeSpec(s)} className="opacity-60 transition group-hover:opacity-100">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {filteredSpecs.map((s) => {
              const active = specialties.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggleSpec(s)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "border-[#b86ef9] bg-gradient-to-br from-[#b86ef9] to-[#a855f7] text-white shadow-md shadow-[#b86ef9]/30"
                      : "border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.5)] text-[#d4c4e0] hover:border-[#b86ef9]/60 hover:bg-[rgba(60,20,90,0.5)]"
                  }`}>
                  {active && <Check className="h-4 w-4" />}
                  {s}
                </button>
              );
            })}
          </div>

          <Divider />

          <Label className="text-sm font-medium text-white/90">{t("profile_edit.add_custom_specialty")}</Label>
          <div className="mt-2 flex gap-2">
            <Input value={customSpec} onChange={(e) => setCustomSpec(e.target.value)} placeholder={t("profile_edit.custom_placeholder")} className={inputClass}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSpec(); } }} />
            <Button type="button" onClick={addCustomSpec} variant="outline"
              className="border-[#b86ef9]/40 bg-transparent text-[#d4a5f9] hover:bg-[#b86ef9]/10">
              <Plus className="mr-1.5 h-4 w-4" />{t("profile_edit.add_btn")}
            </Button>
          </div>
        </Section>

        {/* Services */}
        <Section title={t("profile_edit.section_services")} action={
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
                    <span className="font-semibold">{s.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#a89bc4]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{s.duration_min} {t("profile_edit.min_short")}</span>
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
        <Section>
          <Field label={t("profile_edit.short_bio")}>
            <Input value={shortBio} maxLength={150} onChange={(e) => { setShortBio(e.target.value); markDirty(); }} className={inputClass} />
            <p className="mt-1.5 text-xs text-[#a89bc4]">{shortBio.length}/150</p>
          </Field>

          <div className="mt-5">
            <Field label={t("profile_edit.full_description")}>
              <Textarea value={bio} onChange={(e) => { setBio(e.target.value); markDirty(); }} rows={6} className={`${inputClass} resize-y`} />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={<span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4" />{t("profile_edit.google_reviews_link")}</span>}>
              <Input value={googleReviewsUrl} onChange={(e) => { setGoogleReviewsUrl(e.target.value); markDirty(); }} placeholder="https://g.page/..." className={inputClass} />
            </Field>
            <Field label={<span className="inline-flex items-center gap-2"><Globe className="h-4 w-4" />{t("profile_edit.website_link")}</span>}>
              <Input value={website} onChange={(e) => { setWebsite(e.target.value); markDirty(); }} placeholder="https://" className={inputClass} />
            </Field>
          </div>

          <Divider />

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

          {!dirty && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#b86ef9]/30 bg-[rgba(20,8,40,0.3)] px-4 py-3 text-sm text-[#d4a5f9]">
              <Check className="h-4 w-4" />{t("profile_edit.no_changes")}
            </div>
          )}
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
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.85)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Button type="button" variant="ghost" className="text-[#d4c4e0] hover:bg-white/5">
            {t("profile_edit.cancel_btn")}
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}
            className="gap-2 bg-gradient-to-r from-[#b86ef9] to-[#a855f7] text-white shadow-lg shadow-[#b86ef9]/30 hover:opacity-95">
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
  title, subtitle, action, children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.5)] p-6 backdrop-blur-md sm:p-8">
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
    });
    setOpen(false);
    if (!initial) { setName(""); setDur(60); setPrice(""); setFormat("in_person"); setDesc(""); }
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
      <DialogContent className="border-[#b86ef9]/30 bg-[#1a0a2e] text-[#e6d7f5]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initial ? t("profile_edit.edit") : t("profile_edit.add_service")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("profile_edit.service_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profile_edit.service_min_placeholder")} className={inputClass} />
          </Field>
          <Field label={t("profile_edit.service_duration")}>
            <Input type="number" value={dur} onChange={(e) => setDur(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} />
          </Field>
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
        </div>
        <DialogFooter>
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