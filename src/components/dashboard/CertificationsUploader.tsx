import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, FileText, Upload, ExternalLink, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyCertifications,
  addCertification,
  deleteCertification,
} from "@/lib/therapist-profile-extra.functions";
import {
  autoCheckCertification,
  AUTOCHECK_DISCLAIMER,
  CREDENTIAL_TYPE_LABELS,
  type AutoCheckResult,
  type CredentialType,
} from "@/lib/certification-autocheck";
import {
  CERTIFICATION_DECLARATION_TEXT,
  CERTIFICATION_RESPONSIBILITY_NOTICE,
  certificationStateLabel,
  certificationTrustState,
} from "@/lib/certification-labels";
import { OFFICIAL_REGISTRY_DOMAINS_LABEL, validateRegistryUrl } from "@/lib/certification-registry-url";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const BUCKET = "therapist-docs";

const TYPES: CredentialType[] = ["asca", "rme", "federal", "other"];

const inputClass =
  "min-h-[44px] w-full rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#5cc8fa]";
const labelClass = "mb-1 block text-xs font-medium text-white/80";

/** Certifications / diplômes (PDF ou image, privés). userId = auth.users.id */
export default function CertificationsUploader({ userId }: { userId: string }) {
  const fetchList = useServerFn(listMyCertifications);
  const add = useServerFn(addCertification);
  const del = useServerFn(deleteCertification);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<
    {
      id: string;
      name: string;
      issuer: string | null;
      year: number | null;
      fileUrl: string | null;
      status?: "declared" | "verified" | "rejected" | "needs_information";
      verifiedAt?: string | null;
      rejectionReason?: string | null;
      credentialType?: string | null;
      registrationNumber?: string | null;
      holderName?: string | null;
      expiresAt?: string | null;
      officialProfileUrl?: string | null;
      registryCheckResult?: string | null;
      registryCheckedAt?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [credentialType, setCredentialType] = useState<CredentialType | "">("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  // Case JAMAIS précochée : la déclaration doit être un geste explicite.
  const [declaration, setDeclaration] = useState(false);
  const [submitted, setSubmitted] = useState<AutoCheckResult | null>(null);

  // Masque la section tant que la table n'existe pas côté base.
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchList();
      setRows(res.rows);
      if ((res as any).supported === false) setSupported(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pré-vérification en temps réel, purement locale (aucun appel réseau).
  const check = useMemo(
    () =>
      autoCheckCertification({
        name,
        issuer,
        year: year ? Number(year) : null,
        hasFile: !!file,
        credentialType: credentialType || null,
        registrationNumber,
        holderName,
        expiresAt: expiresAt || null,
      }),
    [name, issuer, year, file, credentialType, registrationNumber, holderName, expiresAt],
  );

  const touched = !!(name || issuer || year || file || credentialType || registrationNumber || holderName || expiresAt);

  // Validation locale du lien officiel : miroir exact du contrôle serveur.
  const urlCheck = officialUrl.trim() ? validateRegistryUrl(officialUrl) : null;
  const urlError = urlCheck && !urlCheck.ok ? urlCheck.error : null;

  const submit = async () => {
    if (!name.trim()) return toast.error("Indiquez l'intitulé du diplôme.");
    if (!credentialType) return toast.error("Sélectionnez le type / l'organisme.");
    if (!holderName.trim()) return toast.error("Indiquez le nom exact figurant sur le document.");
    if (urlError) return toast.error(urlError);
    if (!declaration) return toast.error("Cochez la déclaration d'exactitude pour soumettre votre dossier.");
    setBusy(true);
    try {
      let filePath: string | null = null;
      if (file) {
        if (!ACCEPTED.includes(file.type)) {
          setBusy(false);
          return toast.error("Format : PDF, JPG, PNG ou WEBP.");
        }
        if (file.size > 10 * 1024 * 1024) {
          setBusy(false);
          return toast.error("Fichier trop lourd (max 10 Mo).");
        }
        const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
        filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: false, contentType: file.type });
        if (upErr) {
          setBusy(false);
          return toast.error(`Upload refusé : ${upErr.message}`);
        }
      }
      const res = await add({
        data: {
          name: name.trim(),
          issuer: issuer.trim() || null,
          year: year ? Number(year) : null,
          file_path: filePath,
          credential_type: credentialType,
          registration_number: registrationNumber.trim() || null,
          holder_name: holderName.trim() || null,
          expires_at: expiresAt || null,
          official_profile_url: urlCheck?.ok ? urlCheck.url : null,
          declaration_accepted: true,
        },
      });
      toast.success("Diplôme soumis — en attente de validation Holiswiss.");
      setSubmitted((res as any)?.autoCheck ?? null);
      // Le formulaire n'est vidé qu'après un enregistrement réussi.
      setName(""); setIssuer(""); setYear(""); setFile(null);
      setCredentialType(""); setRegistrationNumber(""); setHolderName(""); setExpiresAt("");
      setOfficialUrl(""); setDeclaration(false);
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Ajout impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  if (!supported) return null;

  const verdictStyles: Record<AutoCheckResult["verdict"], string> = {
    recognized: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    plausible: "border-sky-400/40 bg-sky-500/10 text-sky-200",
    incomplete: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  };

  const VerdictIcon = ({ verdict }: { verdict: AutoCheckResult["verdict"] }) =>
    verdict === "incomplete" ? (
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
    ) : (
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
    );

  const renderCheck = (r: AutoCheckResult, title: string) => (
    <div className={`rounded-xl border p-3 text-sm ${verdictStyles[r.verdict]}`}>
      <p className="flex items-center gap-2 font-semibold">
        <VerdictIcon verdict={r.verdict} />
        {title} : {r.label}
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {r.passed.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
        {r.missing.map((m) => (
          <li key={m} className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>À compléter : {m}</span>
          </li>
        ))}
        {r.notes.map((n) => (
          <li key={n} className="flex items-start gap-1.5 text-white/70">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-white/70">{AUTOCHECK_DISCLAIMER}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">Certifications &amp; diplômes</h3>
        <p className="text-xs text-[#a89bc4]">
          Documents privés (PDF ou image), jamais publiés. {AUTOCHECK_DISCLAIMER}.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (
        <ul className="mb-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="flex min-w-0 flex-col gap-1 text-white/85">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[#5cc8fa]" />
                  <span className="truncate">
                    {r.name}
                    {r.issuer ? <span className="text-white/45"> · {r.issuer}</span> : null}
                    {r.year ? <span className="text-white/45"> · {r.year}</span> : null}
                  </span>
                </span>
                {(r.credentialType || r.registrationNumber || r.holderName || r.expiresAt) && (
                  <span className="pl-6 text-xs text-white/45">
                    {[
                      r.credentialType
                        ? (CREDENTIAL_TYPE_LABELS[r.credentialType as CredentialType] ?? r.credentialType)
                        : null,
                      r.holderName,
                      r.registrationNumber ? `N° ${r.registrationNumber}` : null,
                      r.expiresAt ? `expire le ${r.expiresAt}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                  {r.status === "verified" && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">
                      Diplôme vérifié
                    </span>
                  )}
                  {(!r.status || r.status === "declared") && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                      En attente de validation Holiswiss
                    </span>
                  )}
                  {r.status === "needs_information" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300">
                      Informations complémentaires demandées
                    </span>
                  )}
                  {r.status === "rejected" && (
                    <>
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-300">Refusé</span>
                      {r.rejectionReason && <span className="text-white/50">{r.rejectionReason}</span>}
                    </>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-cyan-300"
                    aria-label={`Voir le document « ${r.name} »`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label={`Supprimer « ${r.name} »`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-white/40 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-white/40">Aucune certification pour l'instant.</li>}
        </ul>
      )}

      {/* Formulaire d'ajout */}
      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cert-name" className={labelClass}>
            Intitulé du diplôme <span aria-hidden>*</span>
          </label>
          <input id="cert-name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label htmlFor="cert-type" className={labelClass}>
            Type / organisme <span aria-hidden>*</span>
          </label>
          <select
            id="cert-type"
            value={credentialType}
            onChange={(e) => setCredentialType(e.target.value as CredentialType | "")}
            required
            className={inputClass}
          >
            <option value="">— Sélectionner —</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {CREDENTIAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cert-holder" className={labelClass}>
            Nom exact figurant sur le document <span aria-hidden>*</span>
          </label>
          <input id="cert-holder" value={holderName} onChange={(e) => setHolderName(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label htmlFor="cert-issuer" className={labelClass}>
            Organisme délivrant (ex. ASCA, RME)
          </label>
          <input id="cert-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="cert-number" className={labelClass}>
            Numéro d'enregistrement (optionnel)
          </label>
          <input
            id="cert-number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cert-year" className={labelClass}>
            Année d'obtention
          </label>
          <input
            id="cert-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="cert-expires" className={labelClass}>
            Date d'expiration (optionnelle)
          </label>
          <input id="cert-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="cert-file" className={labelClass}>
            Justificatif (PDF ou image, max 10 Mo)
          </label>
          <label
            htmlFor="cert-file"
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-[#1a0a2e] px-3 py-2 text-sm text-white/70"
          >
            <Upload className="h-4 w-4" aria-hidden />
            <span className="truncate">{file ? file.name : "Choisir un fichier"}</span>
          </label>
          <input
            id="cert-file"
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Pré-vérification en temps réel */}
        <div className="sm:col-span-2" aria-live="polite">
          {touched && renderCheck(check, "Pré-vérification")}
        </div>

        <div className="sm:col-span-2">
          <button
            type="button" onClick={submit} disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            Soumettre à la validation Holiswiss
          </button>
        </div>

        {/* Résultat renvoyé par le serveur après soumission */}
        <div className="sm:col-span-2" role="status" aria-live="polite">
          {submitted && (
            <>
              {renderCheck(submitted, "Dossier soumis")}
              <p className="mt-2 text-xs text-white/60">
                Statut du dossier : en attente de validation Holiswiss. Un administrateur examine votre justificatif.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
