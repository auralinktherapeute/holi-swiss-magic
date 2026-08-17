// Contrôle des liens d'une newsletter avant approbation.
// Aucune écriture : lecture seule, réutilise les tables existantes.

import { findFeature } from "./holiswiss-features.shared";
import { isRealInternalRoute, isExternalUrl } from "./internal-routes.shared";

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

export type LinkCheck = {
  key: string;
  label: string;
  severity: "ok" | "warn" | "error";
  detail: string;
};

export type IssueForLinkAudit = {
  feature_key: string | null;
  target_route: string | null;
  email_button_url: string | null;
  email_button_label: string | null;
  email_body: string | null;
  resource_body: string | null;
  cta: string | null;
  slug: string | null;
  published_at: string | null;
  linked_resource_slug: string | null;
  linked_article_id: string | null;
  linked_article_kind: string | null;
};

function checkUrlValue(value: string | null, label: string, key: string): LinkCheck {
  const v = (value ?? "").trim();
  if (!v) return { key, label, severity: "error", detail: "Lien à configurer." };
  if (isRealInternalRoute(v)) return { key, label, severity: "ok", detail: v };
  if (isExternalUrl(v))
    return { key, label, severity: "warn", detail: `Lien externe non vérifiable : ${v}` };
  return { key, label, severity: "error", detail: `Route inexistante dans Holiswiss : ${v}` };
}

const URL_RE = /https?:\/\/[^\s")<>]+/gi;

export async function auditIssueLinks(
  client: AnyClient,
  issue: IssueForLinkAudit,
): Promise<{ checks: LinkCheck[]; blocking: boolean }> {
  const checks: LinkCheck[] = [];

  // 1. Fonctionnalité mise en avant
  const feature = findFeature(issue.feature_key);
  if (!issue.feature_key) {
    checks.push({
      key: "feature",
      label: "Fonctionnalité existante",
      severity: "warn",
      detail: "Aucune fonctionnalité Holiswiss sélectionnée.",
    });
  } else if (!feature) {
    checks.push({
      key: "feature",
      label: "Fonctionnalité existante",
      severity: "error",
      detail: `Fonctionnalité inconnue : ${issue.feature_key}.`,
    });
  } else if (feature.status === "a_configurer") {
    checks.push({
      key: "feature",
      label: "Fonctionnalité existante",
      severity: "warn",
      detail: `${feature.label} — module à configurer, aucune destination réelle.`,
    });
  } else {
    checks.push({
      key: "feature",
      label: "Fonctionnalité existante",
      severity: "ok",
      detail: feature.label,
    });
  }

  // 2. Lien principal (bouton de l'email) — bloquant
  checks.push(checkUrlValue(issue.email_button_url, "URL principale valide", "main_url"));

  // 3. Page de destination du brief
  if ((issue.target_route ?? "").trim()) {
    checks.push(checkUrlValue(issue.target_route, "Route disponible", "target_route"));
  } else {
    checks.push({
      key: "target_route",
      label: "Route disponible",
      severity: "warn",
      detail: "Lien à configurer.",
    });
  }

  // 4. CTA configuré
  const ctaOk = !!(issue.cta ?? "").trim() || !!(issue.email_button_label ?? "").trim();
  checks.push({
    key: "cta",
    label: "CTA configuré",
    severity: ctaOk ? "ok" : "error",
    detail: ctaOk ? (issue.email_button_label || issue.cta)! : "Aucun appel à l'action.",
  });

  // 5. Page ressource liée ou propre page ressource
  const slug = (issue.linked_resource_slug ?? "").trim() || (issue.slug ?? "").trim();
  if (!slug) {
    checks.push({
      key: "resource",
      label: "Page ressource publiée",
      severity: "warn",
      detail: "Aucune page ressource associée.",
    });
  } else if (!issue.linked_resource_slug && !issue.published_at) {
    checks.push({
      key: "resource",
      label: "Page ressource publiée",
      severity: "warn",
      detail: "La page ressource de cette édition n'est pas encore publiée.",
    });
  } else {
    const { data: row } = await client
      .from("newsletter_issues")
      .select("slug,published_at,status")
      .eq("slug", slug)
      .maybeSingle();
    const published = !!row?.published_at && row?.status !== "archivee";
    checks.push({
      key: "resource",
      label: "Page ressource publiée",
      severity: published ? "ok" : "error",
      detail: published ? `/lettre/${slug}` : `Page ressource introuvable ou non publiée : ${slug}`,
    });
  }

  // 6. Contenu expert lié
  if (issue.linked_article_id) {
    if (issue.linked_article_kind === "expert") {
      const { data: a } = await client
        .from("therapist_articles")
        .select("slug,statut")
        .eq("id", issue.linked_article_id)
        .maybeSingle();
      const ok = a?.statut === "publie";
      checks.push({
        key: "article",
        label: "Contenu lié publié",
        severity: ok ? "ok" : "error",
        detail: ok ? `/paroles/${a.slug}` : "Article expert non publié.",
      });
    } else {
      const { data: a } = await client
        .from("articles")
        .select("slug,status")
        .eq("id", issue.linked_article_id)
        .maybeSingle();
      const ok = a?.status === "validated";
      checks.push({
        key: "article",
        label: "Contenu lié publié",
        severity: ok ? "ok" : "error",
        detail: ok ? `/blog/${a.slug}` : "Article non publié.",
      });
    }
  }

  // 7. Aucun lien fictif dans les textes
  const text = `${issue.email_body ?? ""}\n${issue.resource_body ?? ""}`;
  const bad = Array.from(text.matchAll(URL_RE))
    .map((m) => m[0].replace(/[.,;:)]+$/, ""))
    .filter((u) => !isExternalUrl(u) && !isRealInternalRoute(u));
  checks.push({
    key: "no_fake_links",
    label: "Aucun lien fictif",
    severity: bad.length ? "error" : "ok",
    detail: bad.length ? `Liens Holiswiss inexistants : ${bad.slice(0, 5).join(", ")}` : "Vérifié.",
  });

  return { checks, blocking: checks.some((c) => c.severity === "error") };
}

export const LINK_AUDIT_COLUMNS =
  "feature_key,target_route,email_button_url,email_button_label,email_body,resource_body,cta,slug,published_at,linked_resource_slug,linked_article_id,linked_article_kind";
