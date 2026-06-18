import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock, Tag, Sparkles, Heart, Brain, Wind, ShieldCheck } from "lucide-react";

const SITE = "https://holiswiss.ch";
const SLUG = "qu-est-ce-que-la-sophrologie";
const TITLE = "Sophrologie : bienfaits et déroulement d'une séance";
const DESCRIPTION =
  "Découvrez la sophrologie : méthode douce de relaxation et de gestion du stress. Bienfaits, déroulement d'une séance, et comment trouver un sophrologue en Suisse.";
const PUBLISHED_AT = "2026-06-18";

export const Route = createFileRoute("/$lang/blog/qu-est-ce-que-la-sophrologie")({
  component: Page,
  head: ({ params }) => {
    const url = `${SITE}/${params.lang}/blog/${SLUG}`;
    const title = `${TITLE} | HoliSwiss`;
    return {
      meta: [
        { title },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "keywords", content: "sophrologie, sophrologue, relaxation, gestion du stress, bien-être, Suisse, thérapie holistique" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: TITLE,
            description: DESCRIPTION,
            mainEntityOfPage: url,
            url,
            inLanguage: params.lang,
            datePublished: PUBLISHED_AT,
            dateModified: PUBLISHED_AT,
            author: { "@type": "Organization", name: "HoliSwiss" },
            publisher: {
              "@type": "Organization",
              name: "HoliSwiss",
              logo: { "@type": "ImageObject", url: "https://holiswiss.ch/logo.png" },
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Qu'est-ce que la sophrologie ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "La sophrologie est une méthode psychocorporelle qui associe respiration contrôlée, relaxation musculaire et visualisation positive pour harmoniser corps et esprit.",
                },
              },
              {
                "@type": "Question",
                name: "Combien de séances de sophrologie sont nécessaires ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "En général, 8 à 12 séances suffisent pour observer des résultats durables, à raison d'une séance par semaine au début, puis un espacement progressif.",
                },
              },
              {
                "@type": "Question",
                name: "La sophrologie est-elle remboursée en Suisse ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Certaines assurances complémentaires en Suisse remboursent partiellement les séances de sophrologie lorsque le praticien est reconnu (ASCA, RME).",
                },
              },
            ],
          }),
        },
      ],
    };
  },
});

function Page() {
  const { lang } = useParams({ from: "/$lang/blog/qu-est-ce-que-la-sophrologie" });

  return (
    <div className="min-h-screen bg-[#2d1248]">
      {/* Hero */}
      <div className="relative w-full h-72 md:h-96 overflow-hidden bg-gradient-to-br from-[#3d1a5c] via-[#522870] to-[#2d1248]">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Sparkles className="h-64 w-64 text-[#b86ef9]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#2d1248] via-[#2d1248]/40 to-transparent" />
      </div>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          to="/$lang/blog"
          params={{ lang }}
          className="inline-flex items-center gap-1.5 text-sm text-[#d4c4e0]/70 hover:text-[#d4a5f9] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au blog
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-medium text-[#d4a5f9]">
            <Tag className="h-3 w-3" /> Sophrologie
          </span>
          <span className="text-sm text-[#d4c4e0]/60 flex items-center gap-1">
            <CalendarDays className="h-4 w-4" /> 18 juin 2026
          </span>
          <span className="text-sm text-[#d4c4e0]/60 flex items-center gap-1">
            <Clock className="h-4 w-4" /> 7 min de lecture
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-5">
          Qu'est-ce que la sophrologie ? Bienfaits et fonctionnement
        </h1>

        <p className="text-lg text-[#d4c4e0] border-l-4 border-[#b86ef9]/50 pl-5 mb-10 italic leading-relaxed">
          Méthode douce alliant relaxation, respiration et visualisation, la sophrologie aide à mieux gérer le stress, l'anxiété et le sommeil.
          Découvrez son fonctionnement, ses bienfaits et comment trouver un sophrologue qualifié en Suisse.
        </p>

        <div className="text-[#d4c4e0] leading-relaxed space-y-4">
          <h2 className="text-2xl font-bold text-white mt-10 mb-4">La sophrologie en quelques mots</h2>
          <p>
            Fondée en 1960 par le neuropsychiatre <strong className="text-white">Alfonso Caycedo</strong>, la
            sophrologie est une méthode psychocorporelle qui s'inspire de l'hypnose, du yoga et de la
            méditation zen. Le terme vient du grec <em className="text-[#d4a5f9]">sos</em> (harmonie),
            <em className="text-[#d4a5f9]"> phren</em> (conscience) et <em className="text-[#d4a5f9]">logos</em> (étude) :
            littéralement, « l'étude de la conscience en harmonie ».
          </p>
          <p>
            Pratique non médicamenteuse et accessible à tous — adultes, enfants, sportifs, femmes enceintes —
            elle vise à renforcer l'équilibre entre le corps et l'esprit grâce à des exercices simples
            de respiration, de détente musculaire et de visualisation positive.
          </p>

          <h2 className="text-2xl font-bold text-white mt-10 mb-4">Comment se déroule une séance ?</h2>
          <p>
            Une séance de sophrologie dure en moyenne <strong className="text-white">45 à 60 minutes</strong>.
            Elle se compose généralement de trois temps :
          </p>
          <ul className="space-y-2 my-4 list-disc pl-6">
            <li><strong className="text-white">Un échange initial</strong> avec le sophrologue pour définir l'objectif de la séance.</li>
            <li><strong className="text-white">Des exercices de relaxation dynamique</strong> debout ou assis : mouvements lents associés à la respiration.</li>
            <li><strong className="text-white">Une phase de visualisation</strong> guidée par la voix du praticien, pour ancrer des sensations positives.</li>
          </ul>
          <p>
            Aucun contact physique n'est nécessaire : la personne reste habillée et garde le contrôle
            de chaque instant. La pratique peut se faire en cabinet ou à distance, en visio.
          </p>

          <h2 className="text-2xl font-bold text-white mt-10 mb-4">Les bienfaits de la sophrologie</h2>
          <div className="grid sm:grid-cols-2 gap-4 my-6">
            {[
              { icon: Wind, title: "Gestion du stress", text: "Apaise les tensions, réduit l'anxiété au quotidien et améliore la résistance émotionnelle." },
              { icon: Brain, title: "Meilleur sommeil", text: "Favorise l'endormissement et la qualité du sommeil grâce aux exercices de respiration." },
              { icon: Heart, title: "Confiance en soi", text: "Renforce l'estime de soi et la motivation par la visualisation positive." },
              { icon: ShieldCheck, title: "Préparation mentale", text: "Utilisée par les sportifs, étudiants et patients avant une intervention médicale." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-[rgba(184,110,249,0.2)] bg-[rgba(184,110,249,0.06)] p-4">
                <Icon className="h-6 w-6 text-[#b86ef9] mb-2" />
                <h3 className="text-white font-semibold mb-1">{title}</h3>
                <p className="text-sm text-[#d4c4e0]/85">{text}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white mt-10 mb-4">Pour qui ? Dans quels cas consulter ?</h2>
          <p>
            La sophrologie est recommandée pour toute personne souhaitant retrouver un équilibre intérieur.
            Elle accompagne notamment :
          </p>
          <ul className="space-y-2 my-4 list-disc pl-6">
            <li>Le stress, le burn-out et l'anxiété chronique</li>
            <li>Les troubles du sommeil et la fatigue mentale</li>
            <li>La gestion des émotions (colère, peur, tristesse)</li>
            <li>La préparation à un accouchement, un examen ou une compétition sportive</li>
            <li>L'accompagnement de douleurs chroniques ou de traitements lourds</li>
            <li>Le sevrage tabagique ou alimentaire</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mt-10 mb-4">Sophrologie et remboursement en Suisse</h2>
          <p>
            En Suisse, la sophrologie n'est pas remboursée par l'assurance de base (LAMal). En revanche,
            de nombreuses <strong className="text-white">assurances complémentaires</strong> prennent en
            charge tout ou partie des séances, à condition que le praticien soit reconnu par les
            associations professionnelles comme l'<strong className="text-white">ASCA</strong> ou le
            <strong className="text-white"> RME</strong>. Renseignez-vous auprès de votre caisse avant
            de débuter un suivi.
          </p>

          <h2 className="text-2xl font-bold text-white mt-10 mb-4">Trouver un sophrologue qualifié en Suisse</h2>
          <p>
            HoliSwiss référence des sophrologues vérifiés dans toute la Suisse romande, alémanique et
            tessinoise. Chaque profil indique les certifications, langues parlées, tarifs et avis
            vérifiés pour vous aider à choisir le praticien adapté à vos besoins.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[rgba(184,110,249,0.25)] bg-gradient-to-br from-[#522870] to-[#3d1a5c] p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#b86ef9]/30 to-[#5cc8fa]/20 ring-1 ring-[#b86ef9]/30 mb-4">
            <Sparkles className="h-5 w-5 text-[#b86ef9]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Trouver un sophrologue près de chez vous</h2>
          <p className="text-[#d4c4e0] text-sm mb-6 max-w-sm mx-auto">
            Découvrez nos sophrologues qualifiés, partout en Suisse — Genève, Lausanne, Zurich, Berne…
          </p>
          <Link
            to="/$lang/therapeutes"
            params={{ lang }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b86ef9] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#b86ef9]/30 hover:bg-[#a855f7] hover:shadow-[#b86ef9]/40 transition-all"
          >
            Voir les sophrologues →
          </Link>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/$lang/blog"
            params={{ lang }}
            className="inline-flex items-center gap-1.5 text-sm text-[#d4c4e0]/60 hover:text-[#d4a5f9] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Tous les articles
          </Link>
        </div>
      </article>
    </div>
  );
}