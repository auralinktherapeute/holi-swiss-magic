// Suggestions de sujets pour « La Lettre Holiswiss ».
// Uniquement des AGRÉGATS : aucune donnée individuelle de thérapeute n'est lue ni stockée.

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

export type GeneratedSuggestion = {
  subject: string;
  audience: string | null;
  pillar: string | null;
  feature_key: string | null;
  objective: string | null;
  rationale: string | null;
  priority: "basse" | "moyenne" | "haute";
};

async function countTherapists(
  client: AnyClient,
  apply: (q: any) => any = (q) => q,
): Promise<number> {
  const base = client
    .from("therapists")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const { count } = await apply(base);
  return count ?? 0;
}

function priorityFor(share: number): "basse" | "moyenne" | "haute" {
  if (share >= 0.4) return "haute";
  if (share >= 0.15) return "moyenne";
  return "basse";
}

const SEASONS: Record<number, string> = {
  0: "Nouvelle année : remettre son profil à jour avant la reprise",
  3: "Printemps : relancer sa visibilité locale",
  6: "Été : préparer la rentrée de son cabinet",
  8: "Rentrée : réactiver les demandes de rendez-vous",
  10: "Fin d'année : boucler sa facturation sereinement",
};

/** Construit les suggestions à partir des données réellement présentes. */
export async function buildSuggestions(client: AnyClient): Promise<GeneratedSuggestion[]> {
  const total = await countTherapists(client);
  const out: GeneratedSuggestion[] = [];
  if (total === 0) return out;

  const gaps: Array<{
    count: number;
    subject: string;
    audience: string;
    feature_key: string;
    pillar: string;
    objective: string;
  }> = [
    {
      count: await countTherapists(client, (q) => q.is("photo_url", null)),
      subject: "Une photo professionnelle change tout sur votre profil",
      audience: "Thérapeutes sans photo de profil",
      feature_key: "profil_public",
      pillar: "Visibilité",
      objective: "Faire ajouter une photo de profil de qualité.",
    },
    {
      count: await countTherapists(client, (q) => q.is("bio", null)),
      subject: "Votre présentation dit-elle clairement ce que vous faites ?",
      audience: "Thérapeutes sans présentation",
      feature_key: "profil_public",
      pillar: "Visibilité",
      objective: "Faire rédiger une présentation claire des méthodes.",
    },
    {
      count: await countTherapists(client, (q) => q.is("price_min", null)),
      subject: "Afficher ses tarifs rassure et fait gagner du temps",
      audience: "Thérapeutes sans tarifs affichés",
      feature_key: "profil_public",
      pillar: "Développer sa pratique",
      objective: "Faire renseigner une fourchette de tarifs.",
    },
    {
      count: await countTherapists(client, (q) => q.eq("onboarding_complete", false)),
      subject: "Votre profil est-il prêt à recevoir ses premières demandes ?",
      audience: "Thérapeutes avec profil incomplet",
      feature_key: "sante_profil",
      pillar: "Accompagnement numérique",
      objective: "Faire terminer le parcours d'onboarding.",
    },
  ];

  for (const g of gaps) {
    if (g.count === 0) continue;
    out.push({
      subject: g.subject,
      audience: g.audience,
      pillar: g.pillar,
      feature_key: g.feature_key,
      objective: g.objective,
      rationale: `${g.count} thérapeute(s) actif(s) concerné(s) sur ${total}.`,
      priority: priorityFor(g.count / total),
    });
  }

  // Agenda : thérapeutes sans aucune disponibilité déclarée.
  const { data: availRows } = await client.from("availabilities").select("therapist_id").limit(5000);
  const withAvail = new Set(((availRows ?? []) as { therapist_id: string }[]).map((r) => r.therapist_id));
  const withoutAvail = Math.max(total - withAvail.size, 0);
  if (withoutAvail > 0) {
    out.push({
      subject: "Ouvrir ses premières disponibilités en 10 minutes",
      audience: "Thérapeutes sans disponibilité déclarée",
      pillar: "Gestion du cabinet",
      feature_key: "agenda",
      objective: "Faire déclarer au moins une plage de disponibilité.",
      rationale: `${withoutAvail} thérapeute(s) sans disponibilité sur ${total}.`,
      priority: priorityFor(withoutAvail / total),
    });
  }

  // Voix d'experts : thérapeutes sans article publié.
  const { data: artRows } = await client
    .from("therapist_articles")
    .select("therapist_id")
    .eq("statut", "publie")
    .limit(5000);
  const authors = new Set(((artRows ?? []) as { therapist_id: string }[]).map((r) => r.therapist_id));
  const withoutContent = Math.max(total - authors.size, 0);
  if (withoutContent > 0) {
    out.push({
      subject: "Partager son expertise dans Voix d'experts",
      audience: "Thérapeutes sans contenu expert",
      pillar: "Voix d'experts",
      feature_key: "voix_experts",
      objective: "Faire proposer un premier article éditorial.",
      rationale: `${withoutContent} thérapeute(s) sans article publié sur ${total}.`,
      priority: priorityFor(withoutContent / total),
    });
  }

  // Score de visibilité faible.
  const { count: lowScore } = await client
    .from("therapist_health_scores")
    .select("therapist_id", { count: "exact", head: true })
    .lt("score_total", 50);
  if ((lowScore ?? 0) > 0) {
    out.push({
      subject: "Trois réglages qui améliorent la santé de votre profil",
      audience: "Thérapeutes avec un score de visibilité faible",
      pillar: "Accompagnement numérique",
      feature_key: "sante_profil",
      objective: "Faire progresser le score de santé du profil.",
      rationale: `${lowScore} profil(s) sous 50 points.`,
      priority: "moyenne",
    });
  }

  // Saisonnalité.
  const season = SEASONS[new Date().getMonth()];
  if (season) {
    out.push({
      subject: season,
      audience: "Tous les thérapeutes abonnés",
      pillar: "Actualités Holiswiss",
      feature_key: null,
      objective: "Proposer un temps fort éditorial saisonnier.",
      rationale: "Suggestion saisonnière.",
      priority: "basse",
    });
  }

  // Pages ressources publiées récemment, à remettre en avant.
  const { data: resources } = await client
    .from("newsletter_issues")
    .select("resource_title,slug,published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(3);
  for (const r of (resources ?? []) as { resource_title: string | null; slug: string }[]) {
    if (!r.resource_title) continue;
    out.push({
      subject: `Remettre en avant : ${r.resource_title}`,
      audience: "Tous les thérapeutes abonnés",
      pillar: "Actualités Holiswiss",
      feature_key: null,
      objective: "Relayer une page ressource déjà publiée.",
      rationale: `Page ressource /lettre/${r.slug}.`,
      priority: "basse",
    });
  }

  return out;
}
