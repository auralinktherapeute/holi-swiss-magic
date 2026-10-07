import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { hreflangLinks } from "@/lib/seo";

export const Route = createFileRoute("/$lang/contact/")({
  component: Page,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Contact — Holiswiss",
      de: "Kontakt — Holiswiss",
      it: "Contatto — Holiswiss",
      en: "Contact — Holiswiss",
    };
    const descs: Record<string, string> = {
      fr: "Une question, une suggestion ou un partenariat ? Contactez l'équipe Holiswiss à contact@holiswiss.ch. Nous répondons sous 48 heures.",
      de: "Eine Frage, ein Vorschlag oder eine Partnerschaft? Kontaktieren Sie das Holiswiss-Team unter contact@holiswiss.ch. Antwort innerhalb von 48 Stunden.",
      it: "Una domanda, un suggerimento o una partnership? Contatta il team Holiswiss su contact@holiswiss.ch. Rispondiamo entro 48 ore.",
      en: "A question, suggestion or partnership? Contact the Holiswiss team at contact@holiswiss.ch. We reply within 48 hours.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/contact`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/contact")],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "@id": `${url}#contact`,
            url,
            name: title,
            description,
            inLanguage: lang,
            isPartOf: { "@id": "https://holiswiss.ch/#website" },
            about: { "@id": "https://holiswiss.ch/#organization" },
            mainEntity: {
              "@type": "Organization",
              "@id": "https://holiswiss.ch/#organization",
              name: "Holiswiss",
              email: "contact@holiswiss.ch",
              url: "https://holiswiss.ch",
              areaServed: "CH",
              availableLanguage: ["French", "German", "Italian", "English"],
            },
          }),
        },
      ],
    };
  },
});

const EMAIL = "contact@holiswiss.ch";

type Copy = {
  h1: [string, string];
  intro: string;
  patient: { tag: string; title: string; body: string; faq: string; directory: string };
  pro: { tag: string; title: string; body: string; signup: string; pricing: string };
  other: { tag: string; title: string; body: string };
  delay: string;
  langs: string;
  publisher: string;
};

// Page contact « aiguillage » (P0-3, direction B validée par Gérald le 22/09/2026) :
// trois publics, trois chemins, puis l'e-mail pour tout le reste.
const COPY: Record<string, Copy> = {
  fr: {
    h1: ["Comment pouvons-nous ", "vous aider ?"],
    intro: "Choisissez ce qui vous correspond ; nous répondons à tous les messages sous 48 heures.",
    patient: {
      tag: "Vous cherchez un thérapeute",
      title: "Trouver le bon praticien",
      body: "Remboursement, spécialités, prise de rendez-vous : la plupart des réponses sont déjà dans la FAQ.",
      faq: "Lire la FAQ",
      directory: "Parcourir l'annuaire",
    },
    pro: {
      tag: "Vous êtes praticien",
      title: "Rejoindre Holiswiss",
      body: "Créez votre profil, gérez votre visibilité et vos rendez-vous depuis votre espace.",
      signup: "Créer mon profil",
      pricing: "Tarifs",
    },
    other: { tag: "Presse, partenariat, autre", title: "Écrire à l'équipe", body: "Pour tout le reste, un e-mail suffit." },
    delay: "Réponse sous 48 heures",
    langs: "Français · Deutsch · Italiano · English",
    publisher: "Éditeur du site : Impressum",
  },
  de: {
    h1: ["Wie können wir ", "Ihnen helfen?"],
    intro: "Wählen Sie, was auf Sie zutrifft – wir beantworten jede Nachricht innerhalb von 48 Stunden.",
    patient: {
      tag: "Sie suchen einen Therapeuten",
      title: "Die passende Fachperson finden",
      body: "Rückerstattung, Fachrichtungen, Terminbuchung: Die meisten Antworten finden Sie bereits in den FAQ.",
      faq: "FAQ lesen",
      directory: "Verzeichnis durchsuchen",
    },
    pro: {
      tag: "Sie sind Therapeut·in",
      title: "Holiswiss beitreten",
      body: "Erstellen Sie Ihr Profil und verwalten Sie Sichtbarkeit und Termine in Ihrem Bereich.",
      signup: "Profil erstellen",
      pricing: "Preise",
    },
    other: { tag: "Presse, Partnerschaft, Sonstiges", title: "Dem Team schreiben", body: "Für alles andere genügt eine E-Mail." },
    delay: "Antwort innerhalb von 48 Stunden",
    langs: "Français · Deutsch · Italiano · English",
    publisher: "Herausgeber der Website: Impressum",
  },
  it: {
    h1: ["Come possiamo ", "aiutarvi?"],
    intro: "Scegliete ciò che fa per voi: rispondiamo a tutti i messaggi entro 48 ore.",
    patient: {
      tag: "Cercate un terapeuta",
      title: "Trovare il professionista giusto",
      body: "Rimborsi, specialità, prenotazione: la maggior parte delle risposte si trova già nelle FAQ.",
      faq: "Leggere le FAQ",
      directory: "Sfogliare l'elenco",
    },
    pro: {
      tag: "Siete terapeuti",
      title: "Unirsi a Holiswiss",
      body: "Create il vostro profilo e gestite visibilità e appuntamenti dal vostro spazio.",
      signup: "Creare il mio profilo",
      pricing: "Tariffe",
    },
    other: { tag: "Stampa, partnership, altro", title: "Scrivere al team", body: "Per tutto il resto basta un'e-mail." },
    delay: "Risposta entro 48 ore",
    langs: "Français · Deutsch · Italiano · English",
    publisher: "Editore del sito: Impressum",
  },
  en: {
    h1: ["How can we ", "help you?"],
    intro: "Choose what fits you best — we reply to every message within 48 hours.",
    patient: {
      tag: "Looking for a therapist",
      title: "Find the right practitioner",
      body: "Reimbursement, specialties, booking: most answers are already in the FAQ.",
      faq: "Read the FAQ",
      directory: "Browse the directory",
    },
    pro: {
      tag: "You are a practitioner",
      title: "Join Holiswiss",
      body: "Create your profile and manage your visibility and bookings from your own space.",
      signup: "Create my profile",
      pricing: "Pricing",
    },
    other: { tag: "Press, partnership, other", title: "Write to the team", body: "For anything else, an e-mail is all it takes." },
    delay: "Reply within 48 hours",
    langs: "Français · Deutsch · Italiano · English",
    publisher: "Site publisher: Impressum",
  },
};

const card =
  "grid content-start gap-3 rounded-2xl border border-[rgba(168,85,247,0.25)] bg-[rgba(45,27,78,0.8)] p-5 backdrop-blur-md";
const tag = "text-[11px] font-medium uppercase tracking-[0.1em] text-[#22d3ee]";
const arrowLink =
  "inline-flex items-center gap-1 font-semibold text-[#22d3ee] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] rounded";

function Page() {
  const { lang } = useParams({ from: "/$lang/contact/" });
  const c = COPY[lang] ?? COPY.fr;
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <header className="mb-10 grid max-w-2xl gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {c.h1[0]}
          <span className="bg-gradient-to-br from-[#a855f7] to-[#22d3ee] bg-clip-text text-transparent">{c.h1[1]}</span>
        </h1>
        <p className="text-base leading-relaxed text-white/70">{c.intro}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <section className={card} aria-labelledby="contact-patient">
          <span className={tag}>{c.patient.tag}</span>
          <h2 id="contact-patient" className="text-lg font-semibold text-white">{c.patient.title}</h2>
          <p className="text-sm leading-relaxed text-white/70">{c.patient.body}</p>
          <Link to="/$lang/faq" params={{ lang }} className={arrowLink}>{c.patient.faq} →</Link>
          <Link to="/$lang/therapeutes" params={{ lang }} className={arrowLink}>{c.patient.directory} →</Link>
        </section>

        <section className={card} aria-labelledby="contact-pro">
          <span className={tag}>{c.pro.tag}</span>
          <h2 id="contact-pro" className="text-lg font-semibold text-white">{c.pro.title}</h2>
          <p className="text-sm leading-relaxed text-white/70">{c.pro.body}</p>
          <Link to="/$lang/inscription" params={{ lang }} className={arrowLink}>{c.pro.signup} →</Link>
          <Link to="/$lang/tarifs" params={{ lang }} className={arrowLink}>{c.pro.pricing} →</Link>
        </section>

        <section className={card} aria-labelledby="contact-other">
          <span className={tag}>{c.other.tag}</span>
          <h2 id="contact-other" className="text-lg font-semibold text-white">{c.other.title}</h2>
          <p className="text-sm leading-relaxed text-white/70">{c.other.body}</p>
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex w-fit items-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#06b6d4] px-5 py-3 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_24px_rgba(139,92,246,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            {EMAIL}
          </a>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[rgba(168,85,247,0.25)] pt-4 text-sm text-white/50">
        <span>{c.delay}</span>
        <span>{c.langs}</span>
        <Link to="/$lang/impressum" params={{ lang }} className="hover:text-white">{c.publisher}</Link>
      </footer>
    </div>
  );
}
