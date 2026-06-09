import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/profil")({ component: Page });

const SPECS = ["Sophrologie", "Méditation", "Naturopathie", "Hypnose", "Coaching", "Reiki", "Yoga thérapeutique", "Réflexologie"];
const LANGS = ["Français", "Deutsch", "Italiano", "English"];

function Page() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [canton, setCanton] = useState("VD");
  const [price, setPrice] = useState<number>(120);
  const [selected, setSelected] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!error && data) {
        setRowId(data.id);
        setDisplayName(data.display_name ?? "");
        setSlug(data.slug ?? "");
        setBio(data.bio ?? "");
        setCanton(data.canton_id ?? "VD");
        setPrice(data.price_per_session ?? 0);
        setSelected(data.specialty_ids ?? []);
        setLangs(data.languages ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      slug: slug || (displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + user.id.slice(0, 6)),
      display_name: displayName || user.email!,
      bio,
      canton_id: canton,
      price_per_session: price,
      specialty_ids: selected,
      languages: langs,
      status: "active",
    };
    const { error } = rowId
      ? await supabase.from("therapists").update(payload).eq("id", rowId)
      : await supabase.from("therapists").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil enregistré");
  };

  if (loading) {
    return <div className="p-10 text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mon profil</h1>
        <p className="text-muted-foreground mt-1">Visible publiquement sur votre fiche thérapeute</p>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>Photo & présentation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary-xlight border border-primary/30" />
              <Button type="button" variant="secondary" size="sm"><Upload className="h-4 w-4 mr-2" />Changer la photo</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="name">Nom affiché</Label><Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="slug">Slug (URL publique)</Label><Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="claire-dupont" /></div>
            <div className="space-y-2">
              <Label htmlFor="bio">Présentation</Label>
              <Textarea id="bio" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>Approches & langues</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Approches proposées</Label>
              <div className="flex flex-wrap gap-2">
                {SPECS.map((s) => (
                  <Badge key={s} onClick={() => toggle(selected, s, setSelected)}
                    className={`cursor-pointer ${selected.includes(s) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-foreground/70 hover:bg-primary-xlight"}`}>
                    {s} {selected.includes(s) && <X className="h-3 w-3 ml-1 inline" />}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Langues parlées</Label>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <Badge key={l} onClick={() => toggle(langs, l, setLangs)}
                    className={`cursor-pointer ${langs.includes(l) ? "bg-primary text-primary-foreground" : "bg-surface-alt text-foreground/70 hover:bg-primary-xlight"}`}>
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>Cabinet & tarifs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="canton">Canton</Label>
                <Select value={canton} onValueChange={setCanton}>
                  <SelectTrigger id="canton"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["GE","VD","VS","FR","NE","BE","ZH","TI"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="price">Tarif / séance (CHF)</Label><Input id="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost">Annuler</Button>
          <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">{saving ? "…" : "Enregistrer"}</Button>
        </div>
      </form>
    </div>
  );
}
