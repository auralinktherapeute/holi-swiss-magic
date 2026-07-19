import type { FaqItem, FaqLang } from "@/components/holiswiss/FaqSection";

export type { FaqLang, FaqItem };

const FAQ_LANGS: readonly FaqLang[] = ["fr", "de", "it", "en"];
export function asFaqLang(lang: string | undefined | null): FaqLang {
  return (FAQ_LANGS as readonly string[]).includes(lang ?? "")
    ? (lang as FaqLang)
    : "fr";
}

/** Global Holiswiss FAQ — homepage + therapists list. */
export const GLOBAL_FAQ: Record<FaqLang, FaqItem[]> = {
  fr: [
    {
      q: "Qu'est-ce que Holiswiss ?",
      a: "Holiswiss est un annuaire suisse de thérapeutes spécialisés en approches complémentaires. La plateforme permet aux particuliers de trouver un praticien qualifié en naturopathie, hypnose, sophrologie, massage bien-être, reiki, acupuncture, réflexologie et bien d'autres disciplines, dans toute la Suisse.",
    },
    {
      q: "Comment trouver un thérapeute près de chez moi en Suisse ?",
      a: "Rendez-vous sur holiswiss.ch/fr/therapeutes et recherchez par ville ou canton. La plateforme couvre toute la Suisse : Genève, Lausanne, Zurich, Berne, Bâle, Neuchâtel, Fribourg, Sion, Lugano et plus de 2000 communes. Un rayon de recherche géographique élargit les résultats aux villages et petites villes environnants.",
    },
    {
      q: "Les thérapies complémentaires sont-elles remboursées en Suisse ?",
      a: "Elles ne sont généralement pas couvertes par l'assurance de base (LAMal), mais de nombreuses assurances complémentaires (CSS, Helsana, Swica, Visana, Sanitas, Assura) remboursent partiellement ou totalement les séances si le praticien est certifié ASCA, RME ou EMR. Vérifiez vos conditions auprès de votre caisse maladie.",
    },
    {
      q: "Comment devenir thérapeute référencé sur Holiswiss ?",
      a: "Les thérapeutes peuvent s'inscrire sur la liste d'attente via la page Espace thérapeutes sur holiswiss.ch. L'inscription sera ouverte progressivement aux praticiens certifiés exerçant en Suisse.",
    },
    {
      q: "Quelles approches complémentaires sont disponibles sur Holiswiss ?",
      a: "Holiswiss référence des praticiens dans plus de 40 disciplines : naturopathie, hypnose thérapeutique, sophrologie, massage bien-être, shiatsu, réflexologie, acupuncture, ostéopathie, reiki, magnétisme, méditation, yoga, coaching, PNL, aromathérapie, phytothérapie, ayurveda, lithothérapie, sonothérapie et bien d'autres.",
    },
    {
      q: "Holiswiss est-il disponible en allemand et en italien ?",
      a: "Oui, Holiswiss est disponible en français, allemand, italien et anglais, couvrant toutes les régions linguistiques de la Suisse : Suisse romande, Suisse alémanique (Deutschschweiz) et Tessin (Ticino).",
    },
    {
      q: "La naturopathie est-elle reconnue en Suisse ?",
      a: "Oui. Depuis 2015, la médecine complémentaire est inscrite dans la Constitution fédérale suisse (art. 118a). Des associations professionnelles comme l'ASCA, le RME et l'EMR encadrent la pratique et délivrent des certifications reconnues par les assurances.",
    },
    {
      q: "Comment fonctionne la recherche géographique sur Holiswiss ?",
      a: "La recherche géographique utilise la géolocalisation pour afficher tous les thérapeutes dans un rayon de 80 km autour de la ville saisie. Cela inclut les petites villes et villages, pas uniquement les grandes agglomérations.",
    },
  ],

  de: [
    {
      q: "Was ist Holiswiss?",
      a: "Holiswiss ist ein Schweizer Verzeichnis von Therapeut:innen für komplementäre Ansätze. Die Plattform hilft Privatpersonen, qualifizierte Fachpersonen in Naturheilkunde, Hypnose, Sophrologie, Wellnessmassage, Reiki, Akupunktur, Reflexzonenmassage und vielen weiteren Disziplinen in der ganzen Schweiz zu finden.",
    },
    {
      q: "Wie finde ich eine Therapeutin oder einen Therapeuten in meiner Nähe in der Schweiz?",
      a: "Gehen Sie auf holiswiss.ch/de/therapeutes und suchen Sie nach Stadt oder Kanton. Die Plattform deckt die gesamte Schweiz ab: Zürich, Bern, Basel, Genf, Lausanne, Luzern, St. Gallen, Lugano und über 2000 Gemeinden. Ein Suchradius erweitert die Ergebnisse auf umliegende Dörfer und Kleinstädte.",
    },
    {
      q: "Werden Komplementärtherapien in der Schweiz von der Krankenkasse vergütet?",
      a: "In der Regel nicht über die Grundversicherung (KVG). Viele Zusatzversicherungen (CSS, Helsana, Swica, Visana, Sanitas, Assura) übernehmen Sitzungen jedoch teilweise oder vollständig, sofern die Fachperson über ein ASCA-, RME- oder EMR-Zertifikat verfügt. Prüfen Sie Ihre Bedingungen bei Ihrer Krankenkasse.",
    },
    {
      q: "Wie werde ich als Therapeut:in auf Holiswiss gelistet?",
      a: "Therapeut:innen können sich über die Seite «Espace thérapeutes» auf holiswiss.ch auf der Warteliste eintragen. Die Anmeldung wird schrittweise für zertifizierte Fachpersonen in der Schweiz geöffnet.",
    },
    {
      q: "Welche komplementären Ansätze sind auf Holiswiss verfügbar?",
      a: "Holiswiss listet Fachpersonen aus über 40 Disziplinen: Naturheilkunde, therapeutische Hypnose, Sophrologie, Wellnessmassage, Shiatsu, Reflexzonenmassage, Akupunktur, Osteopathie, Reiki, Magnetismus, Meditation, Yoga, Coaching, NLP, Aromatherapie, Phytotherapie, Ayurveda, Lithotherapie, Klangtherapie und vieles mehr.",
    },
    {
      q: "Gibt es Holiswiss auf Deutsch und Italienisch?",
      a: "Ja. Holiswiss ist auf Französisch, Deutsch, Italienisch und Englisch verfügbar und deckt alle Sprachregionen der Schweiz ab: Romandie, Deutschschweiz und Tessin.",
    },
    {
      q: "Ist Naturheilkunde in der Schweiz anerkannt?",
      a: "Ja. Seit 2015 ist die Komplementärmedizin in der Schweizer Bundesverfassung verankert (Art. 118a). Berufsverbände wie ASCA, RME und EMR regulieren die Praxis und vergeben Zertifikate, die von den Krankenkassen anerkannt werden.",
    },
    {
      q: "Wie funktioniert die Geosuche auf Holiswiss?",
      a: "Die Geosuche nutzt die Geolokalisierung und zeigt alle Therapeut:innen in einem Umkreis von 80 km um die eingegebene Stadt. Das schliesst auch kleine Orte und Dörfer ein und nicht nur grosse Städte.",
    },
  ],

  it: [
    {
      q: "Cos'è Holiswiss?",
      a: "Holiswiss è una directory svizzera di terapeuti specializzati in approcci complementari. La piattaforma permette ai privati di trovare un professionista qualificato in naturopatia, ipnosi, sofrologia, massaggio benessere, reiki, agopuntura, riflessologia e molte altre discipline in tutta la Svizzera.",
    },
    {
      q: "Come trovare un terapeuta vicino a me in Svizzera?",
      a: "Visita holiswiss.ch/it/therapeutes e cerca per città o cantone. La piattaforma copre tutta la Svizzera: Ginevra, Losanna, Zurigo, Berna, Basilea, Neuchâtel, Friburgo, Sion, Lugano e oltre 2000 comuni. Un raggio di ricerca geografico amplia i risultati ai paesi e ai piccoli centri vicini.",
    },
    {
      q: "Le terapie complementari sono rimborsate in Svizzera?",
      a: "Generalmente non sono coperte dall'assicurazione di base (LAMal), ma molte assicurazioni complementari (CSS, Helsana, Swica, Visana, Sanitas, Assura) rimborsano parzialmente o totalmente le sedute se il professionista è certificato ASCA, RME o EMR. Verifica le condizioni con la tua cassa malati.",
    },
    {
      q: "Come diventare terapeuta su Holiswiss?",
      a: "I terapeuti possono iscriversi alla lista d'attesa tramite la pagina «Espace thérapeutes» su holiswiss.ch. Le iscrizioni saranno aperte progressivamente ai professionisti certificati che esercitano in Svizzera.",
    },
    {
      q: "Quali approcci complementari sono disponibili su Holiswiss?",
      a: "Holiswiss referenzia professionisti in oltre 40 discipline: naturopatia, ipnosi terapeutica, sofrologia, massaggio benessere, shiatsu, riflessologia, agopuntura, osteopatia, reiki, magnetismo, meditazione, yoga, coaching, PNL, aromaterapia, fitoterapia, ayurveda, litoterapia, sonoterapia e molto altro.",
    },
    {
      q: "Holiswiss è disponibile in tedesco e italiano?",
      a: "Sì. Holiswiss è disponibile in francese, tedesco, italiano e inglese e copre tutte le regioni linguistiche della Svizzera: Svizzera romanda, Svizzera tedesca (Deutschschweiz) e Ticino.",
    },
    {
      q: "La naturopatia è riconosciuta in Svizzera?",
      a: "Sì. Dal 2015 la medicina complementare è inscritta nella Costituzione federale svizzera (art. 118a). Associazioni professionali come ASCA, RME ed EMR regolano la pratica e rilasciano certificazioni riconosciute dalle assicurazioni.",
    },
    {
      q: "Come funziona la ricerca geografica su Holiswiss?",
      a: "La ricerca geografica utilizza la geolocalizzazione per mostrare tutti i terapeuti in un raggio di 80 km attorno alla città inserita. Include piccoli centri e villaggi, non soltanto le grandi città.",
    },
  ],

  en: [
    {
      q: "What is Holiswiss?",
      a: "Holiswiss is a Swiss directory of therapists specialising in complementary approaches. The platform helps individuals find qualified practitioners in naturopathy, hypnosis, sophrology, wellness massage, reiki, acupuncture, reflexology and many other disciplines across Switzerland.",
    },
    {
      q: "How do I find a therapist near me in Switzerland?",
      a: "Go to holiswiss.ch/en/therapeutes and search by city or canton. The platform covers the whole of Switzerland: Geneva, Lausanne, Zurich, Bern, Basel, Neuchâtel, Fribourg, Sion, Lugano and over 2000 municipalities. A geographic radius expands results to nearby villages and smaller towns.",
    },
    {
      q: "Are complementary therapies reimbursed in Switzerland?",
      a: "They are generally not covered by basic health insurance (LAMal), but many complementary insurances (CSS, Helsana, Swica, Visana, Sanitas, Assura) reimburse sessions partially or fully when the practitioner holds an ASCA, RME or EMR certification. Check your terms with your health insurer.",
    },
    {
      q: "How do I become a listed therapist on Holiswiss?",
      a: "Therapists can join the waiting list through the «Therapist area» page on holiswiss.ch. Onboarding is opened progressively to certified practitioners working in Switzerland.",
    },
    {
      q: "Which complementary approaches are available on Holiswiss?",
      a: "Holiswiss references practitioners across more than 40 disciplines: naturopathy, therapeutic hypnosis, sophrology, wellness massage, shiatsu, reflexology, acupuncture, osteopathy, reiki, magnetism, meditation, yoga, coaching, NLP, aromatherapy, phytotherapy, ayurveda, lithotherapy, sound therapy and many more.",
    },
    {
      q: "Is Holiswiss available in German and Italian?",
      a: "Yes. Holiswiss is available in French, German, Italian and English, covering every linguistic region of Switzerland: French-speaking Switzerland, German-speaking Switzerland (Deutschschweiz) and Ticino.",
    },
    {
      q: "Is naturopathy recognised in Switzerland?",
      a: "Yes. Since 2015, complementary medicine has been enshrined in the Swiss Federal Constitution (art. 118a). Professional bodies such as ASCA, RME and EMR regulate the practice and issue certifications recognised by health insurers.",
    },
    {
      q: "How does the geographic search on Holiswiss work?",
      a: "Geographic search uses geolocation to display every therapist within an 80 km radius of the city you enter. This includes small towns and villages, not only major cities.",
    },
  ],
};

/** Per-blog-category contextual FAQ (FR — keep concise, 3 questions). */
const BLOG_FAQ_FR: Record<string, FaqItem[]> = {
  hypnose: [
    { q: "L'hypnose thérapeutique est-elle reconnue en Suisse ?", a: "Oui. L'hypnose thérapeutique est pratiquée par des praticiens certifiés ASCA ou RME en Suisse. De nombreuses assurances complémentaires remboursent les séances lorsque le praticien est accrédité." },
    { q: "Combien de séances d'hypnose sont nécessaires ?", a: "En moyenne, 3 à 6 séances suffisent pour des objectifs ciblés (arrêt du tabac, gestion du stress, sommeil). Le nombre varie selon la problématique et la réceptivité de chaque personne." },
    { q: "L'hypnose est-elle remboursée par l'assurance en Suisse ?", a: "Les assurances complémentaires (CSS, Helsana, Swica, Visana, Sanitas, Assura) remboursent souvent l'hypnose si le praticien dispose d'une accréditation ASCA, RME ou EMR. Vérifiez auprès de votre caisse." },
  ],
  sophrologie: [
    { q: "Qu'est-ce que la sophrologie ?", a: "La sophrologie est une méthode psycho-corporelle qui combine respiration, relaxation musculaire et visualisation positive. Elle aide à gérer le stress, améliorer le sommeil et préparer un événement (examen, accouchement, sport)." },
    { q: "La sophrologie est-elle remboursée en Suisse ?", a: "De nombreuses assurances complémentaires en Suisse remboursent la sophrologie lorsque le praticien est certifié ASCA ou RME. Vérifiez les conditions auprès de votre caisse maladie." },
    { q: "Combien de séances de sophrologie sont nécessaires ?", a: "Un accompagnement classique se déroule sur 8 à 12 séances hebdomadaires. Pour un objectif ponctuel, 4 à 6 séances peuvent suffire." },
  ],
  naturopathie: [
    { q: "Qu'est-ce que la naturopathie ?", a: "La naturopathie est une approche globale qui s'appuie sur l'alimentation, la phytothérapie, l'hygiène de vie et la gestion du stress pour soutenir les capacités d'auto-régulation du corps." },
    { q: "La naturopathie est-elle remboursée en Suisse ?", a: "Oui, par de nombreuses assurances complémentaires (CSS, Helsana, Swica, Visana, Sanitas, Assura) si le naturopathe est certifié ASCA, RME ou EMR. Vérifiez votre contrat." },
    { q: "Comment se déroule une première consultation en naturopathie ?", a: "La première séance dure 60 à 90 minutes. Le naturopathe explore votre hygiène de vie, vos antécédents et vos objectifs, puis propose un plan personnalisé (alimentation, plantes, micronutrition, gestion du stress)." },
  ],
  massage: [
    { q: "Le massage bien-être est-il remboursé en Suisse ?", a: "Le massage bien-être peut être partiellement remboursé par les assurances complémentaires lorsque le praticien est certifié ASCA, RME ou EMR. Le massage médical/thérapeutique relève d'un autre cadre." },
    { q: "Quelle est la différence entre massage bien-être et massage thérapeutique ?", a: "Le massage bien-être vise la détente et la gestion du stress. Le massage thérapeutique cible une problématique précise (douleurs musculaires, sportives) et requiert souvent une formation médicale ou paramédicale." },
    { q: "À quelle fréquence faire un massage bien-être ?", a: "Une séance toutes les 3 à 4 semaines est idéale pour maintenir détente et bien-être. En période de stress intense, un rythme hebdomadaire ou bi-mensuel apporte un soutien rapide." },
  ],
  "massage-bien-etre": [
    { q: "Le massage bien-être est-il remboursé en Suisse ?", a: "Oui, partiellement par les assurances complémentaires si le praticien est certifié ASCA, RME ou EMR. Vérifiez les conditions auprès de votre caisse maladie." },
    { q: "Combien de temps dure une séance ?", a: "Une séance dure généralement 60 minutes, avec des formats courts de 30 minutes ou longs de 90 minutes selon les besoins." },
    { q: "À quelle fréquence faire un massage bien-être ?", a: "Une séance toutes les 3 à 4 semaines maintient détente et équilibre. En période de stress, un rythme hebdomadaire est conseillé." },
  ],
  reiki: [
    { q: "Qu'est-ce que le reiki ?", a: "Le reiki est une pratique énergétique japonaise basée sur l'imposition des mains pour favoriser la détente profonde et l'équilibre émotionnel." },
    { q: "Le reiki est-il remboursé en Suisse ?", a: "De nombreuses assurances complémentaires remboursent le reiki si le praticien est certifié ASCA ou RME. Vérifiez les conditions de votre contrat." },
    { q: "Combien de séances de reiki sont nécessaires ?", a: "Un cycle de 3 à 5 séances rapprochées est souvent recommandé, puis un suivi mensuel ou trimestriel selon les objectifs." },
  ],
  acupuncture: [
    { q: "L'acupuncture est-elle reconnue en Suisse ?", a: "Oui. L'acupuncture pratiquée par un médecin agréé peut être remboursée par l'assurance de base. Pratiquée par un thérapeute non médecin, elle relève souvent des complémentaires (ASCA/RME)." },
    { q: "L'acupuncture fait-elle mal ?", a: "Les aiguilles sont très fines. La sensation est généralement légère : picotement, lourdeur ou chaleur. La séance est le plus souvent vécue comme relaxante." },
    { q: "Combien de séances d'acupuncture faut-il prévoir ?", a: "Pour un trouble aigu, 3 à 5 séances suffisent souvent. Pour un trouble chronique, un suivi sur 8 à 12 séances peut être recommandé." },
  ],
  meditation: [
    { q: "La méditation est-elle adaptée aux débutants ?", a: "Oui. La méditation guidée est conçue pour les débutants : un instructeur accompagne la respiration et l'attention, ce qui facilite l'apprentissage." },
    { q: "Combien de temps méditer par jour ?", a: "10 à 20 minutes par jour suffisent pour ressentir des bénéfices sur le stress, le sommeil et la concentration." },
    { q: "Où pratiquer la méditation guidée en Suisse ?", a: "Holiswiss référence des instructeurs de méditation en Suisse romande, alémanique et au Tessin. Vous pouvez chercher par ville ou par canton." },
  ],
  reflexologie: [
    { q: "Qu'est-ce que la réflexologie ?", a: "La réflexologie est une technique manuelle qui stimule des zones réflexes (pieds, mains, oreilles) correspondant aux organes du corps pour favoriser détente et équilibre." },
    { q: "La réflexologie est-elle remboursée en Suisse ?", a: "Oui, par les assurances complémentaires si le praticien est certifié ASCA, RME ou EMR." },
    { q: "Combien de séances de réflexologie sont nécessaires ?", a: "Un cycle de 4 à 6 séances rapprochées est courant, puis un entretien mensuel ou saisonnier." },
  ],
  yoga: [
    { q: "Le yoga est-il adapté aux débutants ?", a: "Oui. De nombreux styles (Hatha, Yin, Vinyasa doux) sont accessibles aux débutants. Les cours en petit groupe ou individuels permettent un démarrage en douceur." },
    { q: "Combien de séances de yoga par semaine ?", a: "Une à deux séances par semaine suffisent pour ressentir des bénéfices durables sur la souplesse, le stress et le sommeil." },
    { q: "Où trouver un professeur de yoga en Suisse ?", a: "Holiswiss référence des professeurs de yoga dans toute la Suisse, avec filtre par ville, canton et spécialité." },
  ],
  coaching: [
    { q: "Qu'est-ce que le coaching de vie ?", a: "Le coaching de vie est un accompagnement orienté objectifs (carrière, équilibre, transition, confiance) qui s'appuie sur des outils concrets et des plans d'action." },
    { q: "Combien de séances de coaching sont nécessaires ?", a: "Un accompagnement classique se déroule sur 5 à 10 séances réparties sur 3 à 6 mois, selon les objectifs." },
    { q: "Le coaching est-il remboursé en Suisse ?", a: "Le coaching n'est généralement pas remboursé par les assurances, mais certaines entreprises le prennent en charge dans le cadre du développement professionnel." },
  ],
};

/** Resolve contextual FAQ for a given blog category (FR-only for now; falls back to global). */
export function blogFaqForCategory(
  category: string | null | undefined,
  lang: FaqLang = "fr",
): FaqItem[] {
  if (lang !== "fr") {
    return GLOBAL_FAQ[lang].slice(0, 3);
  }
  const key = (category ?? "").toLowerCase();
  return BLOG_FAQ_FR[key] ?? GLOBAL_FAQ.fr.slice(0, 3);
}

/** Translated section title + subtitle. */
export const FAQ_TITLES: Record<FaqLang, { title: string; subtitle: string }> = {
  fr: {
    title: "Questions fréquentes",
    subtitle: "Tout ce que vous devez savoir sur Holiswiss et les thérapies complémentaires en Suisse",
  },
  de: {
    title: "Häufige Fragen",
    subtitle: "Alles, was Sie über Holiswiss und Komplementärtherapien in der Schweiz wissen müssen",
  },
  it: {
    title: "Domande frequenti",
    subtitle: "Tutto quello che devi sapere su Holiswiss e le terapie complementari in Svizzera",
  },
  en: {
    title: "Frequently asked questions",
    subtitle: "Everything you need to know about Holiswiss and complementary therapies in Switzerland",
  },
};

/** SEO/GEO content block rendered (SSR) at the bottom of the /therapeutes directory. */
export type DirectoryIntro = {
  h2: string;
  lead: string;
  blocks: { h3: string; p: string }[];
};

export const DIRECTORY_INTRO: Record<FaqLang, DirectoryIntro> = {
  fr: {
    h2: "Trouver un thérapeute holistique en Suisse",
    lead: "Holiswiss réunit des thérapeutes et praticiens en médecines douces dans les 26 cantons suisses. Recherchez par spécialité — naturopathie, sophrologie, hypnose, acupuncture, ostéopathie, réflexologie, reiki, méditation — par ville ou par canton, en français, allemand, italien ou anglais, et réservez votre séance en ligne.",
    blocks: [
      {
        h3: "Comment choisir votre praticien",
        p: "Comparez les profils vérifiés : spécialités, approche, langues parlées, tarifs et modalités (en cabinet ou à distance). Les avis authentiques d'autres patients et la carte interactive vous aident à trouver un thérapeute proche de chez vous, à Genève, Lausanne, Zurich, Berne, Bâle, Fribourg, Neuchâtel, Sion ou Lugano.",
      },
      {
        h3: "Remboursement et certifications",
        p: "Les thérapies complémentaires ne relèvent généralement pas de l'assurance de base (LAMal), mais de nombreuses assurances complémentaires remboursent tout ou partie des séances lorsque le praticien est certifié ASCA, RME ou EMR. Vérifiez les conditions auprès de votre caisse maladie.",
      },
    ],
  },
  de: {
    h2: "Ganzheitliche Therapeuten in der Schweiz finden",
    lead: "Holiswiss vereint Therapeuten und Fachpersonen der Komplementärmedizin in allen 26 Kantonen. Suchen Sie nach Fachgebiet — Naturheilkunde, Sophrologie, Hypnose, Akupunktur, Osteopathie, Reflexzonentherapie, Reiki, Meditation — nach Stadt oder Kanton, auf Deutsch, Französisch, Italienisch oder Englisch, und buchen Sie Ihre Sitzung online.",
    blocks: [
      {
        h3: "So wählen Sie Ihre Fachperson",
        p: "Vergleichen Sie geprüfte Profile: Fachgebiete, Ansatz, gesprochene Sprachen, Preise und Formate (in der Praxis oder online). Echte Bewertungen anderer Patientinnen und Patienten sowie die interaktive Karte helfen Ihnen, eine Fachperson in Ihrer Nähe zu finden – in Zürich, Bern, Basel, Genf, Lausanne, Luzern, St. Gallen oder Lugano.",
      },
      {
        h3: "Rückerstattung und Zertifizierungen",
        p: "Komplementärtherapien werden in der Regel nicht von der Grundversicherung (KVG) übernommen, viele Zusatzversicherungen erstatten die Sitzungen jedoch ganz oder teilweise, wenn die Fachperson ASCA-, EMR- oder RME-zertifiziert ist. Prüfen Sie die Bedingungen bei Ihrer Krankenkasse.",
      },
    ],
  },
  it: {
    h2: "Trovare un terapeuta olistico in Svizzera",
    lead: "Holiswiss riunisce terapeuti e professionisti delle medicine dolci in tutti i 26 cantoni svizzeri. Cerca per specialità — naturopatia, sofrologia, ipnosi, agopuntura, osteopatia, riflessologia, reiki, meditazione — per città o cantone, in italiano, francese, tedesco o inglese, e prenota la tua seduta online.",
    blocks: [
      {
        h3: "Come scegliere il professionista",
        p: "Confronta i profili verificati: specialità, approccio, lingue parlate, tariffe e modalità (in studio o a distanza). Le recensioni autentiche di altri pazienti e la mappa interattiva ti aiutano a trovare un terapeuta vicino a te, a Lugano, Bellinzona, Ginevra, Losanna, Zurigo o Berna.",
      },
      {
        h3: "Rimborso e certificazioni",
        p: "Le terapie complementari generalmente non rientrano nell'assicurazione di base (LAMal), ma molte assicurazioni complementari rimborsano in tutto o in parte le sedute se il professionista è certificato ASCA, RME o EMR. Verifica le condizioni con la tua cassa malati.",
      },
    ],
  },
  en: {
    h2: "Find a holistic therapist in Switzerland",
    lead: "Holiswiss brings together therapists and complementary-medicine practitioners across all 26 Swiss cantons. Search by specialty — naturopathy, sophrology, hypnosis, acupuncture, osteopathy, reflexology, reiki, meditation — by city or canton, in English, French, German or Italian, and book your session online.",
    blocks: [
      {
        h3: "How to choose your practitioner",
        p: "Compare verified profiles: specialties, approach, languages spoken, prices and formats (in person or online). Authentic reviews from other patients and the interactive map help you find a therapist near you — in Geneva, Lausanne, Zurich, Bern, Basel, Lucerne, Lugano or beyond.",
      },
      {
        h3: "Reimbursement and certifications",
        p: "Complementary therapies are generally not covered by basic insurance (LAMal), but many supplementary insurers reimburse sessions fully or partially when the practitioner is ASCA-, RME- or EMR-certified. Check the conditions with your health insurer.",
      },
    ],
  },
};

/** Blog-listing FAQ — distinct set so the /blog listing carries its own FAQPage. */
export const BLOG_FAQ: Record<FaqLang, FaqItem[]> = {
  fr: [
    { q: "Que trouve-t-on sur le blog bien-être de Holiswiss ?", a: "Des articles pratiques sur les thérapies holistiques et les médecines douces en Suisse : définitions, bienfaits, déroulé d'une séance, remboursement (LAMal, ASCA, RME) et conseils pour choisir un praticien." },
    { q: "Les articles sont-ils rédigés par des professionnels ?", a: "Les contenus sont documentés et relus, et s'appuient sur les pratiques reconnues en Suisse. Ils ont une visée informative et ne remplacent pas l'avis d'un thérapeute ou d'un médecin." },
    { q: "Le blog est-il disponible en plusieurs langues ?", a: "Oui, les articles sont proposés en français, allemand, italien et anglais afin de couvrir toutes les régions linguistiques suisses." },
    { q: "Comment trouver un thérapeute après avoir lu un article ?", a: "Chaque sujet renvoie vers l'annuaire Holiswiss, où vous pouvez chercher un praticien par spécialité, ville ou canton et réserver en ligne." },
  ],
  de: [
    { q: "Was findet man im Wellness-Blog von Holiswiss?", a: "Praktische Artikel über Komplementärtherapien in der Schweiz: Definitionen, Nutzen, Ablauf einer Sitzung, Rückerstattung (KVG, ASCA, EMR) und Tipps zur Wahl einer Fachperson." },
    { q: "Werden die Artikel von Fachleuten verfasst?", a: "Die Inhalte sind recherchiert und geprüft und stützen sich auf in der Schweiz anerkannte Praktiken. Sie dienen der Information und ersetzen nicht den Rat einer Fachperson oder eines Arztes." },
    { q: "Ist der Blog in mehreren Sprachen verfügbar?", a: "Ja, die Artikel sind auf Deutsch, Französisch, Italienisch und Englisch verfügbar und decken alle Sprachregionen der Schweiz ab." },
    { q: "Wie finde ich nach dem Lesen eine Fachperson?", a: "Jedes Thema verweist auf das Holiswiss-Verzeichnis, wo Sie nach Fachgebiet, Stadt oder Kanton suchen und online buchen können." },
  ],
  it: [
    { q: "Cosa si trova nel blog benessere di Holiswiss?", a: "Articoli pratici sulle medicine dolci in Svizzera: definizioni, benefici, svolgimento di una seduta, rimborso (LAMal, ASCA, RME) e consigli per scegliere un professionista." },
    { q: "Gli articoli sono scritti da professionisti?", a: "I contenuti sono documentati e revisionati e si basano su pratiche riconosciute in Svizzera. Hanno scopo informativo e non sostituiscono il parere di un terapeuta o di un medico." },
    { q: "Il blog è disponibile in più lingue?", a: "Sì, gli articoli sono disponibili in italiano, francese, tedesco e inglese, per coprire tutte le regioni linguistiche svizzere." },
    { q: "Come trovo un terapeuta dopo aver letto un articolo?", a: "Ogni argomento rimanda alla directory Holiswiss, dove puoi cercare un professionista per specialità, città o cantone e prenotare online." },
  ],
  en: [
    { q: "What will I find on the Holiswiss wellness blog?", a: "Practical articles on complementary medicine in Switzerland: definitions, benefits, what a session involves, reimbursement (LAMal, ASCA, RME) and tips for choosing a practitioner." },
    { q: "Are the articles written by professionals?", a: "Content is researched and reviewed and draws on practices recognised in Switzerland. It is informational and does not replace advice from a therapist or doctor." },
    { q: "Is the blog available in several languages?", a: "Yes, articles are available in English, French, German and Italian, covering all Swiss language regions." },
    { q: "How do I find a therapist after reading an article?", a: "Each topic links to the Holiswiss directory, where you can search a practitioner by specialty, city or canton and book online." },
  ],
};

/** Events-listing FAQ — distinct set so the /evenements listing carries its own FAQPage. */
export const EVENTS_FAQ: Record<FaqLang, FaqItem[]> = {
  fr: [
    { q: "Quels types d'événements sont proposés sur Holiswiss ?", a: "Des ateliers, retraites, conférences et stages autour du bien-être et des thérapies holistiques, organisés par des praticiens partout en Suisse." },
    { q: "Comment s'inscrire à un événement ?", a: "Ouvrez la fiche de l'événement pour voir la date, le lieu, le prix et les places disponibles, puis suivez les instructions d'inscription de l'organisateur." },
    { q: "Les événements sont-ils payants ou gratuits ?", a: "Les deux : chaque fiche indique clairement si l'événement est gratuit ou payant, ainsi que le tarif le cas échéant." },
    { q: "Les événements ont-ils lieu dans toute la Suisse ?", a: "Oui, les événements couvrent les différentes régions et cantons suisses, en présentiel et parfois en ligne." },
  ],
  de: [
    { q: "Welche Veranstaltungen gibt es auf Holiswiss?", a: "Workshops, Retreats, Vorträge und Kurse rund um Wohlbefinden und Komplementärtherapien, organisiert von Fachpersonen in der ganzen Schweiz." },
    { q: "Wie melde ich mich für eine Veranstaltung an?", a: "Öffnen Sie die Veranstaltungsseite für Datum, Ort, Preis und freie Plätze und folgen Sie den Anmeldehinweisen des Veranstalters." },
    { q: "Sind die Veranstaltungen kostenpflichtig oder gratis?", a: "Beides: Jede Seite zeigt klar an, ob die Veranstaltung kostenlos oder kostenpflichtig ist, gegebenenfalls mit Preis." },
    { q: "Finden die Veranstaltungen in der ganzen Schweiz statt?", a: "Ja, die Veranstaltungen decken verschiedene Regionen und Kantone ab, vor Ort und teils online." },
  ],
  it: [
    { q: "Quali eventi propone Holiswiss?", a: "Laboratori, ritiri, conferenze e stage su benessere e medicine dolci, organizzati da professionisti in tutta la Svizzera." },
    { q: "Come mi iscrivo a un evento?", a: "Apri la scheda dell'evento per data, luogo, prezzo e posti disponibili, poi segui le istruzioni di iscrizione dell'organizzatore." },
    { q: "Gli eventi sono a pagamento o gratuiti?", a: "Entrambi: ogni scheda indica chiaramente se l'evento è gratuito o a pagamento, con l'eventuale tariffa." },
    { q: "Gli eventi si svolgono in tutta la Svizzera?", a: "Sì, gli eventi coprono diverse regioni e cantoni svizzeri, in presenza e talvolta online." },
  ],
  en: [
    { q: "What kinds of events does Holiswiss list?", a: "Workshops, retreats, talks and courses on wellness and complementary therapies, run by practitioners across Switzerland." },
    { q: "How do I register for an event?", a: "Open the event page for date, location, price and available seats, then follow the organiser's registration instructions." },
    { q: "Are events paid or free?", a: "Both: each event page clearly states whether it is free or paid, with the price where applicable." },
    { q: "Do events take place all over Switzerland?", a: "Yes, events cover various Swiss regions and cantons, in person and sometimes online." },
  ],
};

/** Directory-specific FAQ — distinct from GLOBAL_FAQ to avoid duplicate FAQPage. */
export const DIRECTORY_FAQ: Record<FaqLang, FaqItem[]> = {
  fr: [
    {
      q: "Comment trouver un thérapeute près de chez moi en Suisse ?",
      a: "Utilisez la recherche par ville ou canton et la carte interactive sur cette page. Holiswiss couvre les 26 cantons — Genève, Vaud, Zurich, Berne, Tessin et plus — et affiche les praticiens proches de vous, y compris dans les petites villes et villages.",
    },
    {
      q: "Puis-je consulter un thérapeute en ligne ou uniquement en cabinet ?",
      a: "Les deux. Chaque profil indique les modalités proposées : séances en cabinet, à distance (visioconférence) ou les deux. Filtrez selon votre préférence.",
    },
    {
      q: "Les thérapeutes de Holiswiss sont-ils vérifiés ?",
      a: "Oui. Les profils sont vérifiés et présentent la spécialité, l'approche, les langues, les tarifs et, le cas échéant, les certifications (ASCA, RME, EMR) ainsi que des avis authentiques de patients.",
    },
    {
      q: "Dans quelles langues puis-je chercher un thérapeute ?",
      a: "Holiswiss est disponible en français, allemand, italien et anglais, et vous pouvez filtrer les praticiens par langue parlée pour toute la Suisse (romande, alémanique, Tessin).",
    },
    {
      q: "Combien coûte une séance et est-elle remboursée ?",
      a: "Les tarifs figurent sur chaque profil. Les séances ne sont généralement pas couvertes par la LAMal, mais de nombreuses assurances complémentaires remboursent tout ou partie si le praticien est certifié ASCA, RME ou EMR.",
    },
    {
      q: "Quelles spécialités puis-je trouver sur Holiswiss ?",
      a: "Naturopathie, sophrologie, hypnose, acupuncture, ostéopathie, réflexologie, massage bien-être, reiki, magnétisme, méditation, kinésiologie, ayurveda, aromathérapie, shiatsu et d'autres approches de médecine douce.",
    },
  ],
  de: [
    {
      q: "Wie finde ich einen Therapeuten in meiner Nähe in der Schweiz?",
      a: "Nutzen Sie die Suche nach Stadt oder Kanton und die interaktive Karte auf dieser Seite. Holiswiss deckt alle 26 Kantone ab – Zürich, Bern, Basel, Genf, Waadt, Tessin und mehr – und zeigt Fachpersonen in Ihrer Nähe, auch in kleineren Orten.",
    },
    {
      q: "Kann ich online oder nur vor Ort konsultieren?",
      a: "Beides. Jedes Profil gibt die angebotenen Formate an: Sitzungen in der Praxis, online (Videokonferenz) oder beides. Filtern Sie nach Ihrer Präferenz.",
    },
    {
      q: "Sind die Therapeuten von Holiswiss geprüft?",
      a: "Ja. Die Profile sind geprüft und zeigen Fachgebiet, Ansatz, Sprachen, Preise und gegebenenfalls Zertifizierungen (ASCA, EMR, RME) sowie echte Patientenbewertungen.",
    },
    {
      q: "In welchen Sprachen kann ich suchen?",
      a: "Holiswiss ist auf Deutsch, Französisch, Italienisch und Englisch verfügbar, und Sie können Fachpersonen nach gesprochener Sprache filtern – für die ganze Schweiz.",
    },
    {
      q: "Was kostet eine Sitzung und wird sie erstattet?",
      a: "Die Preise stehen in jedem Profil. Sitzungen werden in der Regel nicht von der Grundversicherung übernommen, viele Zusatzversicherungen erstatten sie jedoch ganz oder teilweise, wenn die Fachperson ASCA-, EMR- oder RME-zertifiziert ist.",
    },
    {
      q: "Welche Fachgebiete finde ich auf Holiswiss?",
      a: "Naturheilkunde, Sophrologie, Hypnose, Akupunktur, Osteopathie, Reflexzonentherapie, Wellness-Massage, Reiki, Magnetismus, Meditation, Kinesiologie, Ayurveda, Aromatherapie, Shiatsu und weitere Ansätze der Komplementärmedizin.",
    },
  ],
  it: [
    {
      q: "Come trovo un terapeuta vicino a me in Svizzera?",
      a: "Usa la ricerca per città o cantone e la mappa interattiva in questa pagina. Holiswiss copre tutti i 26 cantoni — Ticino, Ginevra, Vaud, Zurigo, Berna e altri — e mostra i professionisti vicini a te, anche nei piccoli centri.",
    },
    {
      q: "Posso consultare un terapeuta online o solo in studio?",
      a: "Entrambi. Ogni profilo indica le modalità offerte: sedute in studio, a distanza (videochiamata) o entrambe. Filtra secondo la tua preferenza.",
    },
    {
      q: "I terapeuti di Holiswiss sono verificati?",
      a: "Sì. I profili sono verificati e mostrano specialità, approccio, lingue, tariffe ed eventuali certificazioni (ASCA, RME, EMR), oltre a recensioni autentiche dei pazienti.",
    },
    {
      q: "In quali lingue posso cercare?",
      a: "Holiswiss è disponibile in italiano, francese, tedesco e inglese, e puoi filtrare i professionisti per lingua parlata, per tutta la Svizzera.",
    },
    {
      q: "Quanto costa una seduta ed è rimborsata?",
      a: "Le tariffe sono indicate in ogni profilo. Le sedute generalmente non sono coperte dall'assicurazione di base, ma molte assicurazioni complementari le rimborsano in tutto o in parte se il professionista è certificato ASCA, RME o EMR.",
    },
    {
      q: "Quali specialità trovo su Holiswiss?",
      a: "Naturopatia, sofrologia, ipnosi, agopuntura, osteopatia, riflessologia, massaggio benessere, reiki, magnetismo, meditazione, kinesiologia, ayurveda, aromaterapia, shiatsu e altri approcci di medicina dolce.",
    },
  ],
  en: [
    {
      q: "How do I find a therapist near me in Switzerland?",
      a: "Use the city or canton search and the interactive map on this page. Holiswiss covers all 26 cantons — Geneva, Vaud, Zurich, Bern, Ticino and more — and shows practitioners near you, including in smaller towns.",
    },
    {
      q: "Can I consult a therapist online or only in person?",
      a: "Both. Each profile states the formats offered: in-person sessions, remote (video call) or both. Filter by your preference.",
    },
    {
      q: "Are Holiswiss therapists verified?",
      a: "Yes. Profiles are verified and show specialty, approach, languages, prices and, where applicable, certifications (ASCA, RME, EMR) as well as authentic patient reviews.",
    },
    {
      q: "In which languages can I search?",
      a: "Holiswiss is available in English, French, German and Italian, and you can filter practitioners by language spoken, across all of Switzerland.",
    },
    {
      q: "How much does a session cost and is it reimbursed?",
      a: "Prices are shown on each profile. Sessions are generally not covered by basic insurance, but many supplementary insurers reimburse them fully or partially when the practitioner is ASCA-, RME- or EMR-certified.",
    },
    {
      q: "What specialties can I find on Holiswiss?",
      a: "Naturopathy, sophrology, hypnosis, acupuncture, osteopathy, reflexology, wellness massage, reiki, magnetism, meditation, kinesiology, ayurveda, aromatherapy, shiatsu and other complementary-medicine approaches.",
    },
  ],
};
