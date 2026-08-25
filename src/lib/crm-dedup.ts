/**
 * Helpers purs de normalisation et de détection de doublons CRM.
 * Miroir exact des colonnes générées / fonctions SQL (crm_norm_email, crm_norm_phone, name_norm).
 * Aucun accès réseau : testable unitairement.
 */

export type DedupLevel = "certain" | "probable" | "review";

export type DedupCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  canton: string | null;
  specialty: string | null;
  source: string;
  status: string;
  converted_therapist_id: string | null;
  created_at: string;
  dedup_status: string;
};

export function normEmail(v: string | null | undefined): string | null {
  if (!v) return null;
  const out = v.trim().toLowerCase();
  return out.length ? out : null;
}

export function normPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("41")) return digits;
  if (digits.startsWith("0")) return `41${digits.slice(1)}`;
  return digits;
}

/** minuscules, sans accents, sans ponctuation, espaces normalisés */
export function normName(first: string | null | undefined, last: string | null | undefined): string | null {
  const raw = `${first ?? ""} ${last ?? ""}`;
  const out = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return out.length ? out : null;
}

export function normPlace(v: string | null | undefined): string | null {
  return normName(v, null);
}

/** Distance de Levenshtein bornée (comparaison de noms proches). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

export type DuplicateGroup = {
  key: string;
  level: DedupLevel;
  score: number;
  reason: string;
  leadIds: string[];
};

/**
 * Regroupe des fiches en groupes de doublons gradués.
 * - certain : même email normalisé, même therapist_id, ou même téléphone + nom cohérent
 * - probable : même nom + même ville/canton
 * - review   : noms très proches (Levenshtein <= 2) sur des sources différentes
 * Les fiches déjà fusionnées sont ignorées.
 */
export function detectDuplicateGroups(rows: DedupCandidate[]): DuplicateGroup[] {
  const active = rows.filter((r) => r.dedup_status !== "merged");
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  const push = (key: string, level: DedupLevel, score: number, reason: string, ids: string[]) => {
    if (ids.length < 2) return;
    const sorted = [...new Set(ids)].sort();
    const sig = sorted.join("|");
    if (seen.has(sig)) return;
    seen.add(sig);
    groups.push({ key, level, score, reason, leadIds: sorted });
  };

  const byKey = (fn: (r: DedupCandidate) => string | null) => {
    const map = new Map<string, DedupCandidate[]>();
    active.forEach((r) => {
      const k = fn(r);
      if (!k) return;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    });
    return map;
  };

  // certain — therapist_id
  byKey((r) => r.converted_therapist_id).forEach((list, k) =>
    push(`th:${k}`, "certain", 100, "Même profil thérapeute rattaché", list.map((r) => r.id)),
  );
  // certain — email
  byKey((r) => normEmail(r.email)).forEach((list, k) =>
    push(`email:${k}`, "certain", 100, `Même adresse email (${k})`, list.map((r) => r.id)),
  );
  // certain — téléphone + nom cohérent
  byKey((r) => normPhone(r.phone)).forEach((list, k) => {
    const names = new Set(list.map((r) => normName(r.first_name, r.last_name) ?? ""));
    const coherent = names.size === 1;
    if (coherent) {
      push(`phone:${k}`, "certain", 95, `Même téléphone (${k}) et même nom`, list.map((r) => r.id));
    } else {
      push(`phone:${k}`, "probable", 70, `Même téléphone (${k}) mais noms différents`, list.map((r) => r.id));
    }
  });
  // probable — nom + ville/canton
  byKey((r) => {
    const n = normName(r.first_name, r.last_name);
    const p = normPlace(r.canton);
    return n && p ? `${n}@${p}` : null;
  }).forEach((list, k) =>
    push(`namecity:${k}`, "probable", 75, "Même nom et même ville/canton", list.map((r) => r.id)),
  );

  // review — noms très proches
  const named = active
    .map((r) => ({ id: r.id, n: normName(r.first_name, r.last_name), src: r.source }))
    .filter((x): x is { id: string; n: string; src: string } => !!x.n);
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i];
      const b = named[j];
      if (a.n === b.n) continue;
      const d = levenshtein(a.n, b.n);
      if (d > 0 && d <= 2) {
        push(`near:${a.id}:${b.id}`, "review", 45, `Noms proches : « ${a.n} » / « ${b.n} »`, [a.id, b.id]);
      }
    }
  }

  const order: Record<DedupLevel, number> = { certain: 0, probable: 1, review: 2 };
  return groups.sort((x, y) => order[x.level] - order[y.level] || y.score - x.score);
}

export const DEDUP_LEVEL_LABEL: Record<DedupLevel, string> = {
  certain: "Certain",
  probable: "Probable",
  review: "À examiner",
};

export const DEDUP_LEVEL_COLOR: Record<DedupLevel, string> = {
  certain: "#ef4444",
  probable: "#fb923c",
  review: "#facc15",
};
