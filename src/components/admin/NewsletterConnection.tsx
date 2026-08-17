import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HOLISWISS_FEATURES,
  findFeature,
  ACTION_DIFFICULTIES,
  ACTION_DIFFICULTY_LABELS,
  CONNECTION_PRIORITIES,
  PRIORITY_LABELS,
} from "@/lib/holiswiss-features.shared";
import { isRealInternalRoute, isExternalUrl } from "@/lib/internal-routes.shared";
import { NEWSLETTER_SEGMENTS } from "@/lib/newsletter-send.shared";
import { listLinkableContent, checkNewsletterLinks } from "@/lib/newsletter-connection.functions";

const inputCls =
  "bg-white/5 border-white/10 text-white placeholder:text-white/35 focus-visible:ring-[#b86ef9]";
const selectCls =
  "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]";

export type ConnectionKey =
  | "feature_key"
  | "target_route"
  | "action_label"
  | "action_difficulty"
  | "action_minutes"
  | "linked_article_id"
  | "linked_article_kind"
  | "linked_resource_slug"
  | "segment_key"
  | "connection_priority"
  | "connection_notes";

type Props = {
  issueId: string;
  values: Record<ConnectionKey, string>;
  set: (key: ConnectionKey, value: string) => void;
  disabled?: boolean;
  subject: string;
  audience: string;
  cta: string;
  recipientCount: number | null;
};

function RouteState({ value }: { value: string }) {
  const v = value.trim();
  if (!v)
    return (
      <p className="text-xs text-[#fbbf24] flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Lien à configurer
      </p>
    );
  if (isRealInternalRoute(v))
    return (
      <p className="text-xs text-[#4ade80] flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Route Holiswiss valide
      </p>
    );
  if (isExternalUrl(v))
    return (
      <p className="text-xs text-[#fbbf24] flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Lien externe : à vérifier
        manuellement
      </p>
    );
  return (
    <p className="text-xs text-[#f87171] flex items-center gap-1.5">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Cette route n'existe pas — lien à
      configurer
    </p>
  );
}

export function NewsletterConnection(props: Props) {
  const { values, set, disabled, subject, audience, cta, recipientCount } = props;
  const loadContent = useServerFn(listLinkableContent);
  const content = useQuery({
    queryKey: ["newsletter-linkable-content"],
    queryFn: () => loadContent(),
  });

  const feature = findFeature(values.feature_key);
  const segmentLabel = useMemo(
    () => NEWSLETTER_SEGMENTS.find((s) => s.key === values.segment_key)?.label ?? "—",
    [values.segment_key],
  );

  const applyFeature = (key: string) => {
    set("feature_key", key);
    const f = findFeature(key);
    if (!f) return;
    set("target_route", f.status === "disponible" && f.route ? f.route : "");
    if (!values.action_label) set("action_label", f.ctaLabel);
  };

  return (
    <Card className="bg-[#1d0d3d] border-[#b86ef9]/30">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#b86ef9]" aria-hidden="true" />
          <h2 className="font-semibold">Connexion avec Holiswiss</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-feature" className="text-white/85">
              Fonctionnalité mise en avant
            </Label>
            <select
              id="c-feature"
              disabled={disabled}
              value={values.feature_key}
              className={selectCls}
              onChange={(e) => applyFeature(e.target.value)}
            >
              <option value="" className="bg-[#1d0d3d]">
                —
              </option>
              {HOLISWISS_FEATURES.map((f) => (
                <option key={f.key} value={f.key} className="bg-[#1d0d3d]">
                  {f.label}
                  {f.status === "a_configurer" ? " (à configurer)" : ""}
                </option>
              ))}
            </select>
            {feature && (
              <p className="text-xs text-white/50">
                {feature.description}
                {feature.status === "a_configurer" && (
                  <span className="block text-[#fbbf24] mt-1">
                    Module non livré : la destination doit être marquée « à configurer ».
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-route" className="text-white/85">
              Page de destination
            </Label>
            <Input
              id="c-route"
              disabled={disabled}
              value={values.target_route}
              placeholder="/dashboard/profil"
              onChange={(e) => set("target_route", e.target.value)}
              className={inputCls}
            />
            <RouteState value={values.target_route} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-action" className="text-white/85">
              Action attendue après lecture
            </Label>
            <Input
              id="c-action"
              disabled={disabled}
              value={values.action_label}
              placeholder="Ajouter une présentation claire de ses méthodes"
              onChange={(e) => set("action_label", e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-diff" className="text-white/85">
                Difficulté
              </Label>
              <select
                id="c-diff"
                disabled={disabled}
                value={values.action_difficulty}
                className={selectCls}
                onChange={(e) => set("action_difficulty", e.target.value)}
              >
                <option value="" className="bg-[#1d0d3d]">
                  —
                </option>
                {ACTION_DIFFICULTIES.map((d) => (
                  <option key={d} value={d} className="bg-[#1d0d3d]">
                    {ACTION_DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-min" className="text-white/85">
                Temps estimé (min)
              </Label>
              <Input
                id="c-min"
                type="number"
                min={0}
                max={600}
                disabled={disabled}
                value={values.action_minutes}
                onChange={(e) => set("action_minutes", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-content" className="text-white/85">
              Ressource liée (contenu expert ou article)
            </Label>
            <select
              id="c-content"
              disabled={disabled}
              value={values.linked_article_id ? `${values.linked_article_kind}:${values.linked_article_id}` : ""}
              className={selectCls}
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                set("linked_article_kind", id ? kind : "");
                set("linked_article_id", id ?? "");
              }}
            >
              <option value="" className="bg-[#1d0d3d]">
                Aucune
              </option>
              {(content.data?.expert ?? []).map((a: { id: string; title: string }) => (
                <option key={a.id} value={`expert:${a.id}`} className="bg-[#1d0d3d]">
                  Voix d'experts — {a.title}
                </option>
              ))}
              {(content.data?.blog ?? []).map((a: { id: string; title: string }) => (
                <option key={a.id} value={`blog:${a.id}`} className="bg-[#1d0d3d]">
                  Article — {a.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">
              Seuls les contenus déjà publiés sont proposés. L'email n'affiche qu'un extrait et un
              bouton « Lire l'article ».
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-resource" className="text-white/85">
              Page ressource liée
            </Label>
            <select
              id="c-resource"
              disabled={disabled}
              value={values.linked_resource_slug}
              className={selectCls}
              onChange={(e) => set("linked_resource_slug", e.target.value)}
            >
              <option value="" className="bg-[#1d0d3d]">
                Page ressource de cette édition
              </option>
              {(content.data?.resources ?? []).map((r: { id: string; slug: string; title: string | null }) => (
                <option key={r.id} value={r.slug} className="bg-[#1d0d3d]">
                  {r.title || r.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-segment" className="text-white/85">
              Segment lié
            </Label>
            <select
              id="c-segment"
              disabled={disabled}
              value={values.segment_key}
              className={selectCls}
              onChange={(e) => set("segment_key", e.target.value)}
            >
              <option value="" className="bg-[#1d0d3d]">
                —
              </option>
              {NEWSLETTER_SEGMENTS.map((s) => (
                <option key={s.key} value={s.key} className="bg-[#1d0d3d]">
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/45">
              Le segment sert uniquement au ciblage : aucune donnée individuelle n'apparaît dans
              l'email.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-priority" className="text-white/85">
              Niveau de priorité
            </Label>
            <select
              id="c-priority"
              disabled={disabled}
              value={values.connection_priority}
              className={selectCls}
              onChange={(e) => set("connection_priority", e.target.value)}
            >
              <option value="" className="bg-[#1d0d3d]">
                —
              </option>
              {CONNECTION_PRIORITIES.map((p) => (
                <option key={p} value={p} className="bg-[#1d0d3d]">
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-notes" className="text-white/85">
            Notes administratives (jamais publiques)
          </Label>
          <Textarea
            id="c-notes"
            rows={3}
            disabled={disabled}
            value={values.connection_notes}
            onChange={(e) => set("connection_notes", e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          <div className="font-semibold text-white/85">Aperçu</div>
          <dl className="grid gap-2 sm:grid-cols-2 text-white/70">
            <div>
              <dt className="text-xs text-white/45">Sujet</dt>
              <dd>{subject || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">Audience</dt>
              <dd>{audience || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">Fonctionnalité</dt>
              <dd>{feature?.label ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">CTA</dt>
              <dd>{cta || feature?.ctaLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">Page de destination</dt>
              <dd className="break-all">{values.target_route || "Lien à configurer"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">Segment · destinataires estimés</dt>
              <dd>
                {segmentLabel} · {recipientCount ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export function NewsletterLinkCheck({ issueId }: { issueId: string }) {
  const check = useServerFn(checkNewsletterLinks);
  const q = useQuery({
    queryKey: ["newsletter-link-check", issueId],
    queryFn: () => check({ data: { id: issueId } }),
  });

  const icon = (severity: string) =>
    severity === "ok" ? (
      <CheckCircle2 className="h-4 w-4 text-[#4ade80] mt-0.5" aria-hidden="true" />
    ) : severity === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-[#fbbf24] mt-0.5" aria-hidden="true" />
    ) : (
      <XCircle className="h-4 w-4 text-[#f87171] mt-0.5" aria-hidden="true" />
    );

  return (
    <Card className="bg-[#1d0d3d] border-white/10">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Contrôle des liens</h2>
          <div className="flex items-center gap-2">
            {q.data?.blocking && (
              <Badge className="bg-[#f87171]/15 text-[#f87171] border-0">
                Approbation bloquée
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => q.refetch()}
              className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
            >
              Revérifier
            </Button>
          </div>
        </div>
        {q.isLoading && <p className="text-sm text-white/60">Vérification…</p>}
        {q.error && (
          <p className="text-sm text-[#f87171]">
            {q.error instanceof Error ? q.error.message : "Vérification impossible."}
          </p>
        )}
        <ul className="space-y-2.5">
          {(q.data?.checks ?? []).map((c) => (
            <li key={c.key} className="flex items-start gap-2.5 text-sm">
              {icon(c.severity)}
              <div className="min-w-0">
                <div className="text-white/85">{c.label}</div>
                <div className="text-white/50 break-words">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
