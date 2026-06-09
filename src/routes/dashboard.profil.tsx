import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export const Route = createFileRoute("/dashboard/profil")({ component: Page });

const SPECS = ["Sophrologie", "Méditation", "Naturopathie", "Hypnose", "Coaching", "Reiki", "Yoga thérapeutique", "Réflexologie"];
const LANGS = ["Français", "Deutsch", "Italiano", "English"];

function Page() {
  const [selected, setSelected] = useState<string[]>(["Sophrologie", "Méditation"]);
  const [langs, setLangs] = useState<string[]>(["Français", "English"]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Profil enregistré (démo)");
  };

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
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="firstname">Prénom</Label><Input id="firstname" defaultValue="Claire" /></div>
              <div className="space-y-2"><Label htmlFor="lastname">Nom</Label><Input id="lastname" defaultValue="Dupont" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="title">Titre / fonction</Label><Input id="title" defaultValue="Sophrologue certifiée" /></div>
            <div className="space-y-2">
              <Label htmlFor="bio">Présentation</Label>
              <Textarea id="bio" rows={6} defaultValue="J'accompagne les personnes vers une meilleure connaissance de soi à travers la sophrologie et la méditation." />
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
              <div className="space-y-2"><Label htmlFor="city">Ville</Label><Input id="city" defaultValue="Lausanne" /></div>
              <div className="space-y-2">
                <Label htmlFor="canton">Canton</Label>
                <Select defaultValue="VD">
                  <SelectTrigger id="canton"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["GE","VD","VS","FR","NE","BE","ZH","TI"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="address">Adresse du cabinet</Label><Input id="address" defaultValue="Rue du Lac 12, 1003 Lausanne" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="price">Tarif / séance (CHF)</Label><Input id="price" type="number" defaultValue={120} /></div>
              <div className="space-y-2"><Label htmlFor="duration">Durée (min)</Label><Input id="duration" type="number" defaultValue={60} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost">Annuler</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}
