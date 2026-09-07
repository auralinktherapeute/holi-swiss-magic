/**
 * Inspection Search Console depuis l'edge function — compte de service Google.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Jusqu'au 07/09/2026, RIEN ne faisait avancer `indexed_urls.status` côté
 *   serveur : l'inspection ne vivait que dans la tâche Claude locale, qui ne
 *   tourne que si le Mac est ouvert (12 exécutions en 50 jours). Le pipeline
 *   poussait donc à l'aveugle — il ne savait jamais qu'une page était acquise,
 *   donc n'archivait rien, donc repoussait les mêmes URLs indéfiniment.
 *   L'archivage introduit le 07/09 casse la boucle, mais il reste à moitié
 *   aveugle tant que personne ne CONSTATE l'état réel. C'est ce que fait ce
 *   module, et c'est ce qui rend `newly_indexed` autre chose que zéro.
 *
 * CE QUE L'API FAIT — ET NE FAIT PAS
 *   L'API URL Inspection **LIT** l'état d'indexation. Elle ne le force pas :
 *   le « Demander une indexation » de l'interface Search Console n'est exposé
 *   par aucune API. Ne jamais présenter une inspection comme un forçage.
 *
 * AUTHENTIFICATION
 *   Compte de service Google + JWT signé RS256, échangé contre un jeton d'accès.
 *   Le compte de service doit être ajouté comme utilisateur de la propriété
 *   `sc-domain:holiswiss.ch` dans Search Console — sans cela, l'API répond 403
 *   même avec un jeton parfaitement valide.
 *
 *   La clé privée vit dans le secret Supabase `GSC_SERVICE_ACCOUNT_JSON`
 *   (le JSON du compte de service, tel que téléchargé). Absent = ce module se
 *   désactive proprement, le reste du cycle continue.
 *
 * QUOTA
 *   2 000 inspections par jour, ~600 par minute. On en fait 30 par exécution :
 *   très en dessous, et suffisant pour couvrir la file utile en quelques jours.
 */

const GSC_API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export type Inspection = {
  url: string;
  verdict: string | null;
  coverageState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
};

function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PEM PKCS#8 → clé de signature RSASSA-PKCS1-v1_5 / SHA-256. */
async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Jeton d'accès à partir du compte de service (flux JWT bearer).
 * Renvoie `null` sur toute défaillance — l'appelant se désactive alors sans
 * faire échouer le cycle entier.
 */
export async function accessToken(serviceAccountJson: string): Promise<string | null> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON n'est pas un JSON valide");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON : client_email ou private_key manquant");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await importKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${b64url(sig)}`;

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Jeton Google HTTP ${r.status} — ${body.slice(0, 200)}`);
  }
  const { access_token } = (await r.json()) as { access_token?: string };
  return access_token ?? null;
}

/** Inspecte UNE URL. `null` = échec de cette URL, pas du lot. */
export async function inspect(
  token: string,
  siteUrl: string,
  url: string,
): Promise<Inspection | null> {
  const r = await fetch(GSC_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "fr" }),
  });
  if (!r.ok) return null;
  const d = (await r.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        lastCrawlTime?: string;
        googleCanonical?: string;
        robotsTxtState?: string;
        indexingState?: string;
      };
    };
  };
  const i = d.inspectionResult?.indexStatusResult;
  if (!i) return null;
  return {
    url,
    verdict: i.verdict ?? null,
    coverageState: i.coverageState ?? null,
    lastCrawlTime: i.lastCrawlTime ?? null,
    googleCanonical: i.googleCanonical ?? null,
    robotsTxtState: i.robotsTxtState ?? null,
    indexingState: i.indexingState ?? null,
  };
}

/**
 * Verdict Google → `indexed_urls.status`.
 *
 * L'ordre des tests compte : un blocage robots.txt ou un `noindex` prime sur la
 * couverture, et un canonical différent prime sur « non indexée » — c'est une
 * information plus actionnable (la page n'a pas à être poussée, Google a déjà
 * choisi une autre adresse pour ce contenu).
 */
export function toStatus(i: Inspection, url: string): string {
  if (i.robotsTxtState === "DISALLOWED") return "blocked_robots";
  if (i.indexingState === "BLOCKED_BY_META_TAG" || i.indexingState === "BLOCKED_BY_HTTP_HEADER") {
    return "noindex";
  }
  if (i.verdict === "PASS") return "indexed";
  if (i.googleCanonical && i.googleCanonical !== url) return "canonical_other";

  const c = (i.coverageState ?? "").toLowerCase();
  if (c.includes("unknown")) return "discovered";
  if (c.includes("discovered")) return "discovered_not_crawled";
  if (c.includes("crawled") || c.includes("soft 404")) return "crawled_not_indexed";
  return "discovered";
}
