import { isLang, type Lang } from "@/lib/i18n";
import { canonicalLink, ogLocale, seoLinks, SITE } from "@/lib/seo";

export const INSTITUTION = {
  brand: "Holiswiss",
  founder: "Gérald Henry",
  address: "9 Impasse Nussbaum, 68300 Saint-Louis, France",
  siren: "103 987 061",
  email: "contact@holiswiss.ch",
  infrastructure: "Infrastructure applicative : Lovable et Supabase. Gestion du nom de domaine : IONOS.",
} as const;

export const INSTITUTIONAL_COPY = {
  fr: {
    about: "À propos", home: "Accueil", title: "À propos de Holiswiss — Annuaire de thérapeutes en Suisse",
    description: "Découvrez Holiswiss, annuaire de thérapeutes en Suisse, son fondateur Gérald Henry, son identité et le contrôle des fiches avant publication.",
    intro: "Holiswiss est un annuaire et une plateforme numérique destinée à faciliter la découverte de thérapeutes et de professionnels du bien-être en Suisse.",
    identityTitle: "Fondateur et éditeur",
    identity: "Gérald Henry est le fondateur, l’éditeur et le responsable éditorial de Holiswiss. Holiswiss est son nom commercial, exploité en tant que micro-entrepreneur en France.",
    methodTitle: "Avant publication d’une fiche",
    method: "Avant publication, notre modérateur contrôle le nom et les coordonnées.",
    limit: "Ce contrôle ne constitue pas une certification des diplômes, des pratiques, des méthodes, des résultats thérapeutiques ou des affiliations déclarées. Il ne confirme pas une inscription dans un registre officiel.",
    responsibilityTitle: "Le rôle de l’annuaire",
    responsibility: "Les informations professionnelles restent fournies sous la responsabilité des praticiens. Holiswiss facilite leur découverte ; l’annuaire ne garantit ni leurs qualifications ni les résultats de leurs prestations.",
    contact: "Contact", legal: "Mentions légales", terms: "Conditions", privacy: "Confidentialité",
    legalNotice: "Ce document juridique est disponible en français uniquement.",
    publisher: "Gérald Henry, micro-entrepreneur en France, exploitant Holiswiss comme nom commercial.",
    methodLabel: "Contrôle avant publication", affiliation: "Affiliation déclarée par le thérapeute",
  },
  de: {
    about: "Über uns", home: "Startseite", title: "Über Holiswiss — Therapeutenverzeichnis in der Schweiz",
    description: "Erfahren Sie mehr über Holiswiss, das Therapeutenverzeichnis in der Schweiz, Gründer Gérald Henry und die Prüfung vor der Veröffentlichung eines Profils.",
    intro: "Holiswiss ist ein Verzeichnis und eine digitale Plattform, die das Finden von Therapeutinnen, Therapeuten und Fachpersonen für Wohlbefinden in der Schweiz erleichtern soll.",
    identityTitle: "Gründer und Herausgeber",
    identity: "Gérald Henry ist Gründer, Herausgeber und redaktionell Verantwortlicher von Holiswiss. Holiswiss ist sein Handelsname, unter dem er als Einzelunternehmer im französischen Micro-entrepreneur-Status in Frankreich tätig ist.",
    methodTitle: "Vor der Veröffentlichung eines Profils",
    method: "Vor der Veröffentlichung prüft Gérald Henry den Namen und die Kontaktdaten und führt anschliessend ausnahmslos ein Telefongespräch mit der Therapeutin oder dem Therapeuten.",
    limit: "Diese Prüfung ist keine Zertifizierung der Diplome, Praktiken, Methoden, therapeutischen Ergebnisse oder angegebenen Mitgliedschaften. Sie bestätigt keinen Eintrag in einem offiziellen Register.",
    responsibilityTitle: "Die Rolle des Verzeichnisses",
    responsibility: "Die beruflichen Angaben werden weiterhin unter der Verantwortung der Fachpersonen bereitgestellt. Holiswiss erleichtert deren Auffindbarkeit; das Verzeichnis garantiert weder ihre Qualifikationen noch die Ergebnisse ihrer Leistungen.",
    contact: "Kontakt", legal: "Impressum", terms: "Bedingungen", privacy: "Datenschutz",
    legalNotice: "Dieses rechtliche Dokument ist nur auf Französisch verfügbar.",
    publisher: "Gérald Henry, Einzelunternehmer im französischen Micro-entrepreneur-Status in Frankreich, tätig unter dem Handelsnamen Holiswiss.",
    methodLabel: "Prüfung vor Veröffentlichung", affiliation: "Von der Fachperson angegebene Mitgliedschaft",
  },
  it: {
    about: "Chi siamo", home: "Home", title: "Chi è Holiswiss — Elenco di terapeuti in Svizzera",
    description: "Scopri Holiswiss, elenco di terapeuti in Svizzera, il fondatore Gérald Henry, l’identità dell’editore e il controllo delle schede prima della pubblicazione.",
    intro: "Holiswiss è un elenco e una piattaforma digitale destinata a facilitare la scoperta di terapeuti e professionisti del benessere in Svizzera.",
    identityTitle: "Fondatore ed editore",
    identity: "Gérald Henry è il fondatore, l’editore e il responsabile editoriale di Holiswiss. Holiswiss è il suo nome commerciale, utilizzato in qualità di imprenditore individuale con lo status francese di micro-entrepreneur in Francia.",
    methodTitle: "Prima della pubblicazione di una scheda",
    method: "Prima della pubblicazione, Gérald Henry controlla il nome e i recapiti, poi parla sistematicamente per telefono con il terapeuta.",
    limit: "Questo controllo non costituisce una certificazione dei diplomi, delle pratiche, dei metodi, dei risultati terapeutici o delle affiliazioni dichiarate. Non conferma l’iscrizione a un registro ufficiale.",
    responsibilityTitle: "Il ruolo dell’elenco",
    responsibility: "Le informazioni professionali restano fornite sotto la responsabilità dei professionisti. Holiswiss ne facilita la scoperta; l’elenco non garantisce né le loro qualifiche né i risultati delle loro prestazioni.",
    contact: "Contatti", legal: "Note legali", terms: "Condizioni", privacy: "Privacy",
    legalNotice: "Questo documento giuridico è disponibile solo in francese.",
    publisher: "Gérald Henry, imprenditore individuale con lo status francese di micro-entrepreneur in Francia, opera con il nome commerciale Holiswiss.",
    methodLabel: "Controllo prima della pubblicazione", affiliation: "Affiliazione dichiarata dal terapeuta",
  },
  en: {
    about: "About", home: "Home", title: "About Holiswiss — Therapist directory in Switzerland",
    description: "Learn about Holiswiss, a therapist directory in Switzerland, founder Gérald Henry, the publisher’s identity and checks before a profile is published.",
    intro: "Holiswiss is a directory and digital platform intended to make it easier to discover therapists and wellbeing professionals in Switzerland.",
    identityTitle: "Founder and publisher",
    identity: "Gérald Henry is the founder, publisher and person responsible for editorial content at Holiswiss. Holiswiss is his trading name, operated as a sole trader under the French micro-entrepreneur status in France.",
    methodTitle: "Before a profile is published",
    method: "Before publication, Gérald Henry checks the name and contact details, then systematically speaks with the therapist by telephone.",
    limit: "This check does not certify diplomas, practices, methods, therapeutic results or declared affiliations. It does not confirm registration in an official register.",
    responsibilityTitle: "The directory’s role",
    responsibility: "Professional information remains provided under the practitioners’ responsibility. Holiswiss helps people discover them; the directory guarantees neither their qualifications nor the results of their services.",
    contact: "Contact", legal: "Legal notice", terms: "Terms", privacy: "Privacy",
    legalNotice: "This legal document is available in French only.",
    publisher: "Gérald Henry, a sole trader under the French micro-entrepreneur status in France, operating under the trading name Holiswiss.",
    methodLabel: "Pre-publication check", affiliation: "Affiliation declared by the therapist",
  },
} satisfies Record<Lang, Record<string, string>>;

export function institutionalCopy(lang: string) {
  return INSTITUTIONAL_COPY[isLang(lang) ? lang : "fr"];
}

export function aboutHead(lang: string) {
  const c = institutionalCopy(lang);
  const url = canonicalLink(lang, "/a-propos").href;
  return {
    meta: [
      { title: c.title }, { name: "description", content: c.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: c.title }, { property: "og:description", content: c.description },
      { property: "og:type", content: "website" }, { property: "og:url", content: url },
      { property: "og:locale", content: ogLocale(lang) },
      { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: c.title },
      { name: "twitter:description", content: c.description },
    ],
    links: seoLinks(lang, "/a-propos"),
    scripts: [{ type: "application/ld+json", children: JSON.stringify({
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: c.home, item: `${SITE}/${lang}` },
        { "@type": "ListItem", position: 2, name: c.about, item: url },
      ],
    }) }],
  };
}

export function legalHead(path: string, title: string, description: string) {
  return {
    meta: [{ title }, { name: "description", content: description },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { property: "og:url", content: canonicalLink("fr", path).href },
      { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: title },
      { name: "twitter:description", content: description }],
    links: [canonicalLink("fr", path)],
  };
}