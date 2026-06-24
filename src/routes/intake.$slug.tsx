import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getIntakeHeader, submitIntake, type IntakeHeader } from "@/lib/intake.functions";

export const Route = createFileRoute("/intake/$slug")({
  loader: async ({ params }) => {
    const header = await getIntakeHeader({ data: { slug: params.slug } });
    if (!header) throw notFound();
    return { header };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Formulaire d'admission — ${loaderData?.header?.first_name ?? ""} ${loaderData?.header?.last_name ?? ""} | HoliSwiss` },
      { name: "description", content: "Remplissez votre questionnaire pré-séance en toute confidentialité." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  notFoundComponent: () => (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-[#0F0F23] text-white">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Lien introuvable</h1>
        <p className="text-white/60">Ce formulaire d'admission n'existe pas ou n'est plus actif.</p>
      </div>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-[#0F0F23] text-white">
      <p className="text-red-300">Erreur : {error.message}</p>
    </main>
  ),
  component: IntakePage,
});

type Form = {
  first_name: string; last_name: string; email: string; phone: string;
  birth_date: string; consultation_reason: string; medical_history: string;
  medications: string; allergies: string;
  consent_rgpd: boolean; consent_signature: string;
};

const empty = (): Form => ({
  first_name: "", last_name: "", email: "", phone: "", birth_date: "",
  consultation_reason: "", medical_history: "", medications: "", allergies: "",
  consent_rgpd: false, consent_signature: "",
});

function IntakePage() {
  const { header } = Route.useLoaderData() as { header: IntakeHeader };
  const submitFn = useServerFn(submitIntake);
  const [form, setForm] = useState<Form>(empty);
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.consent_rgpd) throw new Error("Vous devez accepter la politique de confidentialité.");
      if (!form.consent_signature.trim()) throw new Error("La signature est requise.");
      return submitFn({ data: {
        therapist_id: header.id,
        first_name: form.first_name, last_name: form.last_name, email: form.email,
        phone: form.phone || null, birth_date: form.birth_date || null,
        consultation_reason: form.consultation_reason || null,
        medical_history: form.medical_history || null,
        medications: form.medications || null,
        allergies: form.allergies || null,
        consent_signature: form.consent_signature,
      } });
    },
    onSuccess: () => { setDone(true); toast.success("Formulaire envoyé !"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));

  if (done) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-br from-[#0F0F23] via-[#1a0a2e] to-[#0F0F23] text-white">
        <div className="max-w-md text-center bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Merci !</h1>
          <p className="text-white/70">Votre questionnaire a bien été transmis à {header.first_name} {header.last_name}. Vous serez recontacté(e) prochainement.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-gradient-to-br from-[#0F0F23] via-[#1a0a2e] to-[#0F0F23] text-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-6">
          {header.photo_url
            ? <img src={header.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border border-white/10" />
            : <div className="h-14 w-14 rounded-full bg-purple-500/30 flex items-center justify-center text-lg font-semibold">{header.first_name?.[0]}{header.last_name?.[0]}</div>}
          <div className="min-w-0">
            <p className="text-white/60 text-xs uppercase tracking-wide flex items-center gap-1.5"><FileText className="h-3 w-3" /> Formulaire d'admission</p>
            <h1 className="text-xl font-semibold truncate">{header.first_name} {header.last_name}</h1>
            {header.title && <p className="text-white/60 text-sm truncate">{header.title}{header.city ? ` · ${header.city}` : ""}</p>}
          </div>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
              className="space-y-5 bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <p className="text-sm text-white/70">Merci de remplir ce questionnaire avant votre première séance. Vos réponses sont confidentielles et accessibles uniquement à votre thérapeute.</p>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-purple-300">Vos informations</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Prénom *"><Input required value={form.first_name} onChange={e => set("first_name", e.target.value)} className="bg-white/5 border-white/10 text-white" /></Field>
              <Field label="Nom *"><Input required value={form.last_name} onChange={e => set("last_name", e.target.value)} className="bg-white/5 border-white/10 text-white" /></Field>
              <Field label="Email *"><Input required type="email" value={form.email} onChange={e => set("email", e.target.value)} className="bg-white/5 border-white/10 text-white" /></Field>
              <Field label="Téléphone"><Input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-white/5 border-white/10 text-white" /></Field>
              <Field label="Date de naissance"><Input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} className="bg-white/5 border-white/10 text-white" /></Field>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-purple-300">Motif & antécédents</h2>
            <Field label="Motif de consultation"><Textarea rows={3} value={form.consultation_reason} onChange={e => set("consultation_reason", e.target.value)} className="bg-white/5 border-white/10 text-white resize-none" placeholder="Ce qui vous amène à consulter…" /></Field>
            <Field label="Antécédents médicaux"><Textarea rows={3} value={form.medical_history} onChange={e => set("medical_history", e.target.value)} className="bg-white/5 border-white/10 text-white resize-none" placeholder="Pathologies, opérations, suivis en cours…" /></Field>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-purple-300">Santé</h2>
            <Field label="Médicaments actuels"><Textarea rows={2} value={form.medications} onChange={e => set("medications", e.target.value)} className="bg-white/5 border-white/10 text-white resize-none" placeholder="Nom, dosage, fréquence…" /></Field>
            <Field label="Allergies"><Textarea rows={2} value={form.allergies} onChange={e => set("allergies", e.target.value)} className="bg-white/5 border-white/10 text-white resize-none" placeholder="Alimentaires, médicamenteuses, autres…" /></Field>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-4">
            <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Consentement & signature</h2>
            <label className="flex items-start gap-2 text-sm text-white/80 cursor-pointer">
              <input type="checkbox" checked={form.consent_rgpd} onChange={e => set("consent_rgpd", e.target.checked)} className="mt-1 accent-purple-500" />
              <span>J'accepte que mes données soient transmises et conservées par {header.first_name} {header.last_name} dans le cadre de ma prise en charge, conformément à la politique de confidentialité (RGPD).</span>
            </label>
            <Field label="Signature (votre nom complet) *">
              <Input required value={form.consent_signature} onChange={e => set("consent_signature", e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="Ex : Marie Dupont" />
            </Field>
          </section>

          <Button type="submit" disabled={mut.isPending} className="w-full bg-purple-600 hover:bg-purple-500 h-11">
            {mut.isPending ? "Envoi…" : "Envoyer mon questionnaire"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/70">{label}</Label>
      {children}
    </div>
  );
}