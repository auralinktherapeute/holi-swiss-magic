import { createFileRoute } from "@tanstack/react-router";
import { FIL_CATEGORY_SLUGS } from "@/data/fil-holiswiss";

// Déclenché une fois par jour par `public.dispatch_fil_newsletter_digest()`
// (pg_cron, cf. migration 20260924083400) : regroupe TOUS les articles du fil
// validés depuis le dernier passage dans un seul email — jamais un email par
// article, pour ne pas spammer les thérapeutes.

const SITE_URL = "https://holiswiss.ch";

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// Comparaison en temps constant (identique à article-agent.ts et aux autres
// webhooks admin) : évite le canal auxiliaire temporel d'un `===`.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request: Request): boolean {
  const providedSecret = request.headers.get("x-agent-secret") || "";
  const expectedSecret = process.env.FIL_DIGEST_SECRET;
  return !!expectedSecret && timingSafeEqualStr(providedSecret, expectedSecret);
}

export const Route = createFileRoute("/api/public/hooks/fil-newsletter-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;

        const { data: articles, error } = await sb
          .from("articles")
          .select("id,title_fr,excerpt_fr")
          .eq("fil_notified", false)
          .eq("status", "validated")
          .in("category", FIL_CATEGORY_SLUGS)
          .order("published_at", { ascending: true })
          .limit(20);

        if (error) {
          console.error("[fil-newsletter-digest] fetch failed", error);
          return json({ ok: false, error: error.message }, { status: 500 });
        }

        if (!articles?.length) {
          return json({ ok: true, sent: 0 });
        }

        const { resolveRecipients, deliverToRecipients, SITE_URL: SEND_SITE_URL } = await import(
          "@/lib/newsletter-send.server"
        );

        const recipients = await resolveRecipients(sb, "tous");
        if (!recipients.length) {
          // Rien à envoyer, mais les articles restent traités : ils ne doivent
          // pas réapparaître au prochain passage.
          await sb
            .from("articles")
            .update({ fil_notified: true })
            .in("id", articles.map((a: { id: string }) => a.id));
          return json({ ok: true, sent: 0, recipients: 0 });
        }

        const count = articles.length;
        const body = (articles as { title_fr: string; excerpt_fr: string | null }[])
          .map((a) => `${a.title_fr.replace(/\n/g, " ").trim()} :: ${(a.excerpt_fr || "").trim()}`)
          .join("\n\n");

        const issue = {
          id: "fil-digest",
          lang: "fr",
          slug: null,
          published_at: null,
          email_subject: `Nouveautés sur Holiswiss — ${count} actualité${count > 1 ? "s" : ""}`,
          email_preheader: "Le fil Holiswiss vient d'être mis à jour.",
          email_intro: null,
          email_body: body,
          email_button_label: "Voir Le fil Holiswiss",
          email_button_url: `${SEND_SITE_URL || SITE_URL}/fr/fil-holiswiss`,
          email_footer: null,
          title: "Le fil Holiswiss",
        };

        const results = await deliverToRecipients(issue, recipients);
        const okCount = results.filter((r) => r.ok).length;

        await sb
          .from("articles")
          .update({ fil_notified: true })
          .in("id", articles.map((a: { id: string }) => a.id));

        return json({ ok: true, sent: okCount, recipients: recipients.length, articles: count });
      },
    },
  },
});
