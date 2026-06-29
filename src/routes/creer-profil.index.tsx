import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInvitationByToken, completeInvitationSignup } from "@/lib/invitations.functions";

type Entry = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  specialty: string | null;
  canton: string | null;
};

export const Route = createFileRoute("/creer-profil/")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: CreerProfilPage,
});

function CreerProfilPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const validate = useServerFn(getInvitationByToken);
  const complete = useServerFn(completeInvitationSignup);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [canton, setCanton] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien invalide.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await validate({ data: { token } });
        if (!res.valid) {
          setError(
            res.reason === "expired"
              ? "Cette invitation a expiré. Contactez-nous à contact@holiswiss.ch"
              : res.reason === "already_registered"
              ? "Un compte a déjà été créé avec cette invitation. Vous pouvez vous connecter."
              : "Cette invitation est invalide. Contactez-nous à contact@holiswiss.ch",
          );
        } else {
          setEntry(res.entry);
          setFirstName(res.entry.first_name ?? "");
          setLastName(res.entry.last_name ?? "");
          setPhone(res.entry.phone ?? "");
          setSpecialty(res.entry.specialty ?? "");
          setCanton(res.entry.canton ?? "");
        }
      } catch {
        setError("Impossible de vérifier l'invitation.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, validate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setSubmitting(true);
    try {
      await complete({
        data: {
          token,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || undefined,
          specialty: specialty.trim() || undefined,
          canton: canton.trim() || undefined,
        },
      });
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: entry.email,
        password,
      });
      if (signErr) {
        toast.success("Compte créé. Connectez-vous pour continuer.");
        navigate({ to: "/fr/connexion" });
        return;
      }
      toast.success("Bienvenue sur HoliSwiss ! 🎉");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#080514] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#b86ef9]" />
      </div>
    );
  }
  if (error || !entry) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#080514] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#0f0a1e] p-8 text-center">
          <h1 className="text-xl font-bold mb-2">Invitation indisponible</h1>
          <p className="text-white/70 text-sm leading-relaxed">{error}</p>
          <Button asChild className="mt-6" style={{ background: "linear-gradient(135deg,#b86ef9,#5cc8fa)", border: 0 }}>
            <a href="mailto:contact@holiswiss.ch">Nous contacter</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#080514] text-white px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="text-center mb-8">
          <p className="inline-block rounded-full bg-[#b86ef9]/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#b86ef9] mb-3">
            ✨ Accès Fondateur
          </p>
          <h1 className="text-3xl font-bold">Créez votre profil HoliSwiss</h1>
          <p className="mt-2 text-sm text-white/60">
            Bienvenue {entry.first_name || ""} — finalisez votre inscription gratuitement.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-[#0f0a1e] p-6">
          <div>
            <Label className="text-white/80">Email</Label>
            <Input value={entry.email} disabled className="mt-1 bg-white/5 border-white/10 text-white/70" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/80">Prénom *</Label>
              <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/80">Nom *</Label>
              <Input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/80">Téléphone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/80">Canton</Label>
              <Input value={canton} onChange={(e) => setCanton(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white" />
            </div>
          </div>
          <div>
            <Label className="text-white/80">Spécialité principale</Label>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-white/80">Mot de passe * (8 caractères min.)</Label>
            <Input type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-white/5 border-white/10 text-white" />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 font-semibold"
            style={{ background: "linear-gradient(135deg,#b86ef9,#5cc8fa)", border: 0, color: "#fff" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Créer mon compte gratuitement
          </Button>
          <p className="text-xs text-white/40 text-center pt-2">
            En créant votre compte, vous obtenez l'accès Fondateur 100% gratuit jusqu'au lancement officiel.
          </p>
        </form>
      </div>
    </div>
  );
}