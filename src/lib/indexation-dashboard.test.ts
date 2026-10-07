import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  buildMyPageStatus,
  computeIndexationMetrics,
  indexationWarnings,
  myPageUrl,
  type IndexedUrlRow,
} from "@/lib/indexation-metrics";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const row = (p: Partial<IndexedUrlRow>): IndexedUrlRow => ({
  id: crypto.randomUUID(),
  url: "https://holiswiss.ch/fr",
  lang: "fr",
  page_type: "static",
  status: "discovered",
  coverage_state: null,
  last_crawl_at: null,
  last_checked_at: "2026-10-07T05:00:00Z",
  priority: 5,
  check_count: 1,
  archived_at: null,
  archive_reason: null,
  last_submitted_at: null,
  ...p,
});
const read = (p: string) => readFileSync(p, "utf8");

describe("métriques d'indexation", () => {
  const urls = [
    row({
      url: "https://holiswiss.ch/fr/a",
      status: "indexed",
      last_submitted_at: "2026-10-01T00:00:00Z",
    }),
    row({ url: "https://holiswiss.ch/fr/b", status: "crawled_not_indexed" }),
    row({ url: "https://holiswiss.ch/fr/c", status: "discovered_not_crawled" }),
    row({
      url: "https://holiswiss.ch/fr/d",
      coverage_state: "URL is unknown to Google",
      last_submitted_at: "2026-10-05T00:00:00Z",
    }),
    row({ url: "https://holiswiss.ch/fr/e", coverage_state: "Soft 404" }),
    row({ url: "https://holiswiss.ch/fr/f", last_checked_at: null }),
    row({ url: "https://holiswiss.ch/fr/g", last_checked_at: "2026-08-01T00:00:00Z" }),
    row({
      url: "https://holiswiss.ch/fr/old",
      archived_at: "2026-09-01T00:00:00Z",
      status: "indexed",
    }),
  ];
  const expected = ["a", "b", "c", "d", "e", "f", "new"].map((s) => `https://holiswiss.ch/fr/${s}`);
  const m = computeIndexationMetrics({
    urls,
    reports: [],
    expectedUrls: expected,
    expectedComputedAt: "x",
    now: NOW,
  });

  it("compte chaque état séparément, IndexNow distinct de l'indexation", () => {
    expect(m).toMatchObject({
      expected: 7,
      trackedActive: 7,
      trackedArchived: 1,
      missingFromTracking: 1,
      trackedNotInSitemap: 1,
      submittedIndexNow: 2,
      indexed: 1,
      crawledNotIndexed: 1,
      discoveredNotIndexed: 1,
      unknownToGoogle: 1,
      errors: 1,
      neverChecked: 1,
      staleChecked: 1,
    });
  });

  it("source inaccessible → null (donnée indisponible), jamais zéro", () => {
    const x = computeIndexationMetrics({
      urls: null,
      reports: null,
      expectedUrls: null,
      expectedComputedAt: null,
      now: NOW,
    });
    expect(Object.values(x).every((v) => v === null)).toBe(true);
    const w = indexationWarnings({
      m: x,
      reports: null,
      trackingError: "e",
      sitemapError: "e",
      now: NOW,
    });
    expect(w.join(" ")).toMatch(/inaccessible/);
    expect(w.join(" ")).toMatch(/indisponible/);
  });

  it("signale l'ancienne version déployée (sitemap suspect) et un rapport ancien", () => {
    const reports = [
      {
        id: "1",
        run_at: "2026-10-01T05:00:00Z",
        trigger: "cron",
        urls_total: 0,
        urls_checked: 0,
        newly_indexed: 0,
        newly_discovered: 0,
        not_indexed: 0,
        blocked: 0,
        errors: 1,
        quota_used: 0,
        summary_md: "Sitemap suspect (7 URLs < 200)",
      },
    ];
    const mm = computeIndexationMetrics({
      urls,
      reports,
      expectedUrls: expected,
      expectedComputedAt: "x",
      now: NOW,
    });
    const w = indexationWarnings({
      m: mm,
      reports,
      trackingError: null,
      sitemapError: null,
      now: NOW,
    }).join(" ");
    expect(w).toMatch(/7 parties/);
    expect(w).toMatch(/ancien/);
  });
});

describe("état de la page du thérapeute", () => {
  it("non publiée, non suivie, inaccessible → inconnu/indisponible, jamais indexée", () => {
    for (const s of [
      buildMyPageStatus({ published: false, row: null, fetchFailed: false, now: NOW }),
      buildMyPageStatus({ published: true, row: null, fetchFailed: false, now: NOW }),
      buildMyPageStatus({ published: true, row: null, fetchFailed: true, now: NOW }),
    ]) {
      expect(s.state).not.toBe("indexed");
      expect(s.label).toMatch(/indisponible|inconnu/i);
      expect(s.lastCheckedAt).toBeNull();
    }
  });
  it("indexée uniquement sur constat Search Console, avec date", () => {
    const s = buildMyPageStatus({
      published: true,
      row: {
        status: "indexed",
        coverage_state: "Submitted and indexed",
        last_checked_at: "2026-10-07T05:00:00Z",
      },
      fetchFailed: false,
      now: NOW,
    });
    expect(s).toMatchObject({
      state: "indexed",
      lastCheckedAt: "2026-10-07T05:00:00Z",
      stale: false,
    });
    const p = buildMyPageStatus({
      published: true,
      row: { status: "discovered", coverage_state: null, last_checked_at: null },
      fetchFailed: false,
      now: NOW,
    });
    expect(p.state).toBe("pending");
  });
  it("URL construite côté serveur à partir du slug du profil", () => {
    expect(myPageUrl("carine-9ffd3d")).toBe("https://holiswiss.ch/fr/therapeute/carine-9ffd3d");
  });
});

describe("frontières d'accès (contrôle du code)", () => {
  const fn = read("src/lib/indexation-dashboard.functions.ts");
  const block = (name: string) =>
    fn.slice(
      fn.indexOf(`export const ${name}`),
      fn.indexOf("export const", fn.indexOf(`export const ${name}`) + 10) >>> 0 || undefined,
    );

  it("vue admin et recontrôle : session + assertAdmin", () => {
    for (const n of ["getIndexationDashboard", "requestUrlRecheck"]) {
      const b = block(n);
      expect(b).toContain("requireSupabaseAuth");
      expect(b).toContain("assertAdmin(context.userId)");
    }
  });
  it("vue thérapeute : profil déduit de la session, aucun slug accepté du navigateur", () => {
    const b = block("getMyPageIndexStatus");
    expect(b).toContain("requireSupabaseAuth");
    expect(b).toContain('.eq("user_id", context.userId)');
    expect(b).not.toContain("inputValidator");
    expect(b).not.toMatch(/data\.slug/);
  });
  it("aucun accès navigateur direct au projet dédié sur les deux écrans", () => {
    for (const p of [
      "src/routes/admin.indexation.tsx",
      "src/routes/dashboard.visibilite.tsx",
      "src/components/dashboard/MyPageVisibilityCard.tsx",
      "src/components/admin/IndexationMetricsPanel.tsx",
      "src/lib/indexation-dashboard.functions.ts",
      "src/lib/indexing.functions.ts",
    ]) {
      const s = read(p);
      expect(s, p).not.toMatch(/gpldaaqwvwopttachrma\.supabase\.co\/rest/);
      expect(s, p).not.toMatch(/eyJhbGci/);
    }
  });
  it("la clé du projet dédié n'existe que dans un module serveur", () => {
    expect(read("src/lib/indexation-source.server.ts")).toMatch(/eyJhbGci/);
  });
  it("les réponses ne renvoient aucun secret", () => {
    const s = buildMyPageStatus({ published: true, row: null, fetchFailed: true, now: NOW });
    expect(JSON.stringify(s)).not.toMatch(/eyJ|apikey|service_role|Bearer/);
  });
});

describe("score unique côté thérapeute et formulations", () => {
  it("l'ancienne formule concurrente est retirée ; la carte Profil lit le score vitrine", () => {
    expect(existsSync("src/lib/profile-completion.ts")).toBe(false);
    const card = read("src/components/dashboard/ProfileCompletionCard.tsx");
    expect(card).toContain("getMyShowcaseReport");
    expect(card).toContain('"my-showcase-report"');
  });
  it("aucune promesse d'indexation, de position ou de classement IA", () => {
    for (const p of [
      "src/components/dashboard/ProfileCompletionCard.tsx",
      "src/components/dashboard/ShowcaseScoreCard.tsx",
      "src/components/dashboard/MyPageVisibilityCard.tsx",
      "src/routes/dashboard.visibilite.tsx",
    ]) {
      const s = read(p);
      expect(s, p).not.toMatch(
        /comprendre et indexer|optimisé pour Google|apparaît mieux|classement ChatGPT|score Google/i,
      );
    }
  });
  it("libellés IndexNow ≠ indexation", () => {
    expect(read("src/components/admin/IndexationMetricsPanel.tsx")).toContain(
      "Soumises IndexNow (≠ indexées)",
    );
    expect(read("src/components/dashboard/MyPageVisibilityCard.tsx")).toMatch(
      /IndexNow\) ne vaut jamais indexation/,
    );
  });
  it("une certification déclarée n'est jamais présentée comme officiellement vérifiée", () => {
    const a = read("src/lib/showcase-audit.ts");
    expect(a).toContain("ne vaut pas reconnaissance officielle");
    expect(a).toContain("une formation déclarée n'est pas vérifiée");
  });
});
