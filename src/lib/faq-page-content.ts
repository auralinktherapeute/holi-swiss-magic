import type { FaqItem, FaqLang } from "@/components/holiswiss/FaqSection";

export type FaqPageCategory = { id: string; title: string; items: FaqItem[] };
export type FaqPageContent = {
  h1: string;
  intro: string;
  categories: FaqPageCategory[];
};

/**
 * Dedicated, comprehensive FAQ page content (4 languages).
 * Rendered SSR via <details> + one FAQPage JSON-LD covering every question —
 * a strong long-tail SEO + AI-citability asset.
 */
export const FAQ_PAGE: Record<FaqLang, FaqPageContent> = {
  fr: {
    h1: "Foire aux questions — Holiswiss",
    intro:
      "Tout ce qu'il faut savoir pour trouver un thérapeute holistique en Suisse, comprendre les remboursements des médecines douces et utiliser Holiswiss, en français, allemand, italien et anglais.",
    categories: [
      {
        id: "trouver",
        title: "Trouver un thérapeute",
        items: [
          {
            q: "Comment trouver un thérapeute holistique en Suisse ?",
            a: "Rendez-vous sur la page Thérapeutes de Holiswiss, puis recherchez par ville ou canton et filtrez par spécialité (naturopathie, sophrologie, hypnose, acupuncture…) et par langue. La carte interactive affiche les praticiens proches de vous dans les 26 cantons, y compris dans les petites villes et villages.",
          },
          {
            q: "Puis-je consulter un thérapeute en ligne ou seulement en cabinet ?",
            a: "Les deux. Chaque profil précise les modalités proposées : séances en cabinet, à distance en visioconférence, ou les deux. Vous pouvez filtrer selon votre préférence lors de la recherche.",
          },
          {
            q: "Les thérapeutes référencés sur Holiswiss sont-ils vérifiés ?",
            a: "Oui. Les profils sont vérifiés et présentent la spécialité, l'approche, les langues parlées, les tarifs et, le cas échéant, les certifications professionnelles (ASCA, RME/EMR) ainsi que des avis authentiques laissés par des patients.",
          },
          {
            q: "Dans quelles villes et cantons Holiswiss est-il disponible ?",
            a: "Holiswiss couvre toute la Suisse : Genève, Lausanne, Zurich, Berne, Bâle, Lucerne, Fribourg, Neuchâtel, Sion, Lugano, Bellinzone et l'ensemble des 26 cantons (Suisse romande, Suisse alémanique et Tessin).",
          },
          {
            q: "Dans quelles langues puis-je chercher un thérapeute ?",
            a: "La plateforme est disponible en français, allemand, italien et anglais, et vous pouvez filtrer les praticiens par langue parlée pour être sûr de consulter dans votre langue.",
          },
        ],
      },
      {
        id: "remboursement",
        title: "Remboursement & assurances",
        items: [
          {
            q: "Les thérapies complémentaires sont-elles remboursées en Suisse ?",
            a: "Elles ne sont en général pas couvertes par l'assurance de base (LAMal), mais de nombreuses assurances complémentaires remboursent tout ou partie des séances lorsque le praticien est certifié ASCA, RME ou EMR. Le montant et le pourcentage dépendent de votre contrat.",
          },
          {
            q: "Quelles assurances complémentaires remboursent les médecines douces ?",
            a: "La plupart des grandes caisses proposent une couverture médecine complémentaire : CSS, Helsana, Swica, Visana, Sanitas, Assura, Groupe Mutuel, Concordia. Vérifiez auprès de votre caisse la liste des thérapies et le plafond annuel prévus par votre complémentaire.",
          },
          {
            q: "Que signifient les certifications ASCA et RME (EMR) ?",
            a: "L'ASCA (Fondation suisse pour les médecines complémentaires) et le RME/EMR (Registre de médecine empirique) sont les deux principaux registres qui reconnaissent les thérapeutes en Suisse. Une certification ASCA ou RME est la condition habituelle pour que les assurances complémentaires remboursent les séances.",
          },
          {
            q: "Une ordonnance médicale est-elle nécessaire ?",
            a: "En général non pour les thérapies complémentaires : vous pouvez consulter directement un praticien. Certaines complémentaires peuvent toutefois demander des justificatifs ; renseignez-vous auprès de votre caisse avant la première séance.",
          },
        ],
      },
      {
        id: "specialites",
        title: "Spécialités & approches",
        items: [
          {
            q: "Quelles spécialités puis-je trouver sur Holiswiss ?",
            a: "Naturopathie, sophrologie, hypnose thérapeutique, acupuncture, ostéopathie, réflexologie, massage bien-être, reiki, magnétisme, méditation, kinésiologie, ayurveda, aromathérapie, shiatsu, coaching holistique et de nombreuses autres approches de médecine douce et de bien-être.",
          },
          {
            q: "Quelle est la différence entre naturopathie et sophrologie ?",
            a: "La naturopathie vise à soutenir la santé globale par des moyens naturels (alimentation, phytothérapie, hygiène de vie). La sophrologie est une méthode psychocorporelle de relaxation et de gestion du stress fondée sur la respiration, la détente musculaire et la visualisation positive.",
          },
          {
            q: "Comment choisir la bonne approche pour mon besoin ?",
            a: "Partez de votre objectif : gestion du stress et du sommeil (sophrologie, méditation, hypnose), douleurs et tensions physiques (ostéopathie, réflexologie, massage), soutien global et vitalité (naturopathie, acupuncture). Les profils décrivent l'approche de chaque praticien pour vous aider à décider.",
          },
          {
            q: "Les médecines douces sont-elles reconnues en Suisse ?",
            a: "Oui. Depuis 2015, la médecine complémentaire est inscrite dans la Constitution fédérale suisse (art. 118a). Des registres professionnels comme l'ASCA et le RME encadrent la pratique et délivrent des certifications reconnues par les assurances.",
          },
        ],
      },
      {
        id: "plateforme",
        title: "Thérapeutes & plateforme",
        items: [
          {
            q: "Combien coûte une consultation ?",
            a: "Les tarifs sont fixés par chaque praticien et affichés sur son profil. Ils varient selon la spécialité, la durée et la région ; comptez généralement entre 80 et 150 CHF la séance.",
          },
          {
            q: "Comment devenir thérapeute référencé sur Holiswiss ?",
            a: "Les praticiens peuvent créer leur profil depuis l'espace thérapeutes de holiswiss.ch. L'inscription de base est gratuite ; des formules premium offrent davantage de visibilité, un agenda, un CRM et la prise de rendez-vous en ligne.",
          },
          {
            q: "Comment réserver un rendez-vous ?",
            a: "Depuis le profil d'un thérapeute, choisissez un créneau disponible et confirmez en ligne. Vous recevez une confirmation par email ; certains praticiens proposent également des rappels automatiques avant la séance.",
          },
          {
            q: "Les avis publiés sont-ils authentiques ?",
            a: "Oui. Les avis proviennent de patients et sont modérés avant publication afin de garantir des retours fiables et pertinents sur chaque praticien.",
          },
        ],
      },
    ],
  },
  de: {
    h1: "Häufig gestellte Fragen — Holiswiss",
    intro:
      "Alles, was Sie wissen müssen, um in der Schweiz einen ganzheitlichen Therapeuten zu finden, die Rückerstattung von Komplementärtherapien zu verstehen und Holiswiss zu nutzen – auf Deutsch, Französisch, Italienisch und Englisch.",
    categories: [
      {
        id: "finden",
        title: "Einen Therapeuten finden",
        items: [
          {
            q: "Wie finde ich einen ganzheitlichen Therapeuten in der Schweiz?",
            a: "Öffnen Sie die Therapeuten-Seite von Holiswiss, suchen Sie nach Stadt oder Kanton und filtern Sie nach Fachgebiet (Naturheilkunde, Sophrologie, Hypnose, Akupunktur…) und Sprache. Die interaktive Karte zeigt Fachpersonen in Ihrer Nähe in allen 26 Kantonen, auch in kleineren Orten.",
          },
          {
            q: "Kann ich online oder nur vor Ort konsultieren?",
            a: "Beides. Jedes Profil gibt die angebotenen Formate an: Sitzungen in der Praxis, online per Videokonferenz oder beides. Sie können bei der Suche nach Ihrer Präferenz filtern.",
          },
          {
            q: "Sind die Therapeuten auf Holiswiss geprüft?",
            a: "Ja. Die Profile sind geprüft und zeigen Fachgebiet, Ansatz, gesprochene Sprachen, Preise und gegebenenfalls Zertifizierungen (ASCA, EMR/RME) sowie echte Patientenbewertungen.",
          },
          {
            q: "In welchen Städten und Kantonen ist Holiswiss verfügbar?",
            a: "Holiswiss deckt die ganze Schweiz ab: Zürich, Bern, Basel, Genf, Lausanne, Luzern, St. Gallen, Freiburg, Neuenburg, Lugano und alle 26 Kantone (Deutschschweiz, Romandie und Tessin).",
          },
          {
            q: "In welchen Sprachen kann ich suchen?",
            a: "Die Plattform ist auf Deutsch, Französisch, Italienisch und Englisch verfügbar, und Sie können Fachpersonen nach gesprochener Sprache filtern.",
          },
        ],
      },
      {
        id: "rueckerstattung",
        title: "Rückerstattung & Versicherungen",
        items: [
          {
            q: "Werden Komplementärtherapien in der Schweiz erstattet?",
            a: "In der Regel nicht durch die Grundversicherung (KVG), doch viele Zusatzversicherungen erstatten die Sitzungen ganz oder teilweise, wenn die Fachperson ASCA-, EMR- oder RME-zertifiziert ist. Betrag und Prozentsatz hängen von Ihrem Vertrag ab.",
          },
          {
            q: "Welche Zusatzversicherungen erstatten Komplementärmedizin?",
            a: "Die meisten grossen Kassen bieten eine Deckung für Komplementärmedizin: CSS, Helsana, Swica, Visana, Sanitas, Assura, Groupe Mutuel, Concordia. Prüfen Sie bei Ihrer Kasse die anerkannten Therapien und den jährlichen Höchstbetrag.",
          },
          {
            q: "Was bedeuten die Zertifizierungen ASCA und EMR (RME)?",
            a: "ASCA (Schweizerische Stiftung für Komplementärmedizin) und EMR/RME (Erfahrungsmedizinisches Register) sind die beiden wichtigsten Register, die Therapeuten in der Schweiz anerkennen. Eine ASCA- oder EMR-Zertifizierung ist üblicherweise Voraussetzung für die Rückerstattung durch Zusatzversicherungen.",
          },
          {
            q: "Ist eine ärztliche Verordnung nötig?",
            a: "In der Regel nicht für Komplementärtherapien: Sie können direkt eine Fachperson konsultieren. Manche Zusatzversicherungen verlangen jedoch Nachweise; erkundigen Sie sich vor der ersten Sitzung bei Ihrer Kasse.",
          },
        ],
      },
      {
        id: "fachgebiete",
        title: "Fachgebiete & Ansätze",
        items: [
          {
            q: "Welche Fachgebiete finde ich auf Holiswiss?",
            a: "Naturheilkunde, Sophrologie, Hypnosetherapie, Akupunktur, Osteopathie, Reflexzonentherapie, Wellness-Massage, Reiki, Magnetismus, Meditation, Kinesiologie, Ayurveda, Aromatherapie, Shiatsu, ganzheitliches Coaching und viele weitere Ansätze der Komplementärmedizin.",
          },
          {
            q: "Was ist der Unterschied zwischen Naturheilkunde und Sophrologie?",
            a: "Die Naturheilkunde unterstützt die Gesundheit mit natürlichen Mitteln (Ernährung, Pflanzenheilkunde, Lebensweise). Die Sophrologie ist eine körperpsychologische Methode zur Entspannung und Stressbewältigung, die auf Atmung, Muskelentspannung und positiver Visualisierung beruht.",
          },
          {
            q: "Wie wähle ich den richtigen Ansatz für mein Anliegen?",
            a: "Gehen Sie von Ihrem Ziel aus: Stress und Schlaf (Sophrologie, Meditation, Hypnose), Schmerzen und körperliche Verspannungen (Osteopathie, Reflexzonentherapie, Massage), allgemeine Unterstützung und Vitalität (Naturheilkunde, Akupunktur). Die Profile beschreiben den Ansatz jeder Fachperson.",
          },
          {
            q: "Ist Komplementärmedizin in der Schweiz anerkannt?",
            a: "Ja. Seit 2015 ist die Komplementärmedizin in der Schweizer Bundesverfassung verankert (Art. 118a). Berufsregister wie ASCA und EMR regeln die Praxis und vergeben von Versicherungen anerkannte Zertifizierungen.",
          },
        ],
      },
      {
        id: "plattform",
        title: "Therapeuten & Plattform",
        items: [
          {
            q: "Was kostet eine Konsultation?",
            a: "Die Preise werden von jeder Fachperson festgelegt und auf dem Profil angezeigt. Sie variieren je nach Fachgebiet, Dauer und Region; rechnen Sie meist mit 80 bis 150 CHF pro Sitzung.",
          },
          {
            q: "Wie werde ich als Therapeut auf Holiswiss gelistet?",
            a: "Fachpersonen können ihr Profil im Therapeutenbereich von holiswiss.ch erstellen. Die Basiseintragung ist kostenlos; Premium-Pakete bieten mehr Sichtbarkeit, Agenda, CRM und Online-Terminbuchung.",
          },
          {
            q: "Wie buche ich einen Termin?",
            a: "Wählen Sie auf dem Profil eines Therapeuten einen freien Termin und bestätigen Sie online. Sie erhalten eine Bestätigung per E-Mail; einige Fachpersonen bieten auch automatische Erinnerungen an.",
          },
          {
            q: "Sind die veröffentlichten Bewertungen echt?",
            a: "Ja. Die Bewertungen stammen von Patientinnen und Patienten und werden vor der Veröffentlichung moderiert, um verlässliche Rückmeldungen zu gewährleisten.",
          },
        ],
      },
    ],
  },
  it: {
    h1: "Domande frequenti — Holiswiss",
    intro:
      "Tutto quello che devi sapere per trovare un terapeuta olistico in Svizzera, capire i rimborsi delle medicine dolci e usare Holiswiss, in italiano, francese, tedesco e inglese.",
    categories: [
      {
        id: "trovare",
        title: "Trovare un terapeuta",
        items: [
          {
            q: "Come trovo un terapeuta olistico in Svizzera?",
            a: "Vai alla pagina Terapeuti di Holiswiss, cerca per città o cantone e filtra per specialità (naturopatia, sofrologia, ipnosi, agopuntura…) e per lingua. La mappa interattiva mostra i professionisti vicino a te in tutti i 26 cantoni, anche nei piccoli centri.",
          },
          {
            q: "Posso consultare un terapeuta online o solo in studio?",
            a: "Entrambi. Ogni profilo indica le modalità offerte: sedute in studio, a distanza in videochiamata o entrambe. Puoi filtrare secondo la tua preferenza durante la ricerca.",
          },
          {
            q: "I terapeuti su Holiswiss sono verificati?",
            a: "Sì. I profili sono verificati e mostrano specialità, approccio, lingue parlate, tariffe ed eventuali certificazioni (ASCA, RME/EMR), oltre a recensioni autentiche dei pazienti.",
          },
          {
            q: "In quali città e cantoni è disponibile Holiswiss?",
            a: "Holiswiss copre tutta la Svizzera: Lugano, Bellinzona, Ginevra, Losanna, Zurigo, Berna, Basilea, Lucerna, Friburgo, Neuchâtel e tutti i 26 cantoni (Svizzera italiana, romanda e tedesca).",
          },
          {
            q: "In quali lingue posso cercare?",
            a: "La piattaforma è disponibile in italiano, francese, tedesco e inglese, e puoi filtrare i professionisti per lingua parlata.",
          },
        ],
      },
      {
        id: "rimborso",
        title: "Rimborso e assicurazioni",
        items: [
          {
            q: "Le terapie complementari sono rimborsate in Svizzera?",
            a: "In genere non dall'assicurazione di base (LAMal), ma molte assicurazioni complementari rimborsano in tutto o in parte le sedute se il professionista è certificato ASCA, RME o EMR. Importo e percentuale dipendono dal tuo contratto.",
          },
          {
            q: "Quali assicurazioni complementari rimborsano le medicine dolci?",
            a: "La maggior parte delle grandi casse offre una copertura per la medicina complementare: CSS, Helsana, Swica, Visana, Sanitas, Assura, Groupe Mutuel, Concordia. Verifica con la tua cassa le terapie riconosciute e il massimale annuo.",
          },
          {
            q: "Cosa significano le certificazioni ASCA e RME (EMR)?",
            a: "ASCA (Fondazione svizzera per le medicine complementari) e RME/EMR (Registro di medicina empirica) sono i due principali registri che riconoscono i terapeuti in Svizzera. Una certificazione ASCA o RME è di solito la condizione per il rimborso da parte delle complementari.",
          },
          {
            q: "È necessaria una prescrizione medica?",
            a: "In genere no per le terapie complementari: puoi consultare direttamente un professionista. Alcune complementari possono però richiedere dei giustificativi; informati presso la tua cassa prima della prima seduta.",
          },
        ],
      },
      {
        id: "specialita",
        title: "Specialità e approcci",
        items: [
          {
            q: "Quali specialità trovo su Holiswiss?",
            a: "Naturopatia, sofrologia, ipnosi terapeutica, agopuntura, osteopatia, riflessologia, massaggio benessere, reiki, magnetismo, meditazione, kinesiologia, ayurveda, aromaterapia, shiatsu, coaching olistico e molti altri approcci di medicina dolce.",
          },
          {
            q: "Qual è la differenza tra naturopatia e sofrologia?",
            a: "La naturopatia sostiene la salute con mezzi naturali (alimentazione, fitoterapia, stile di vita). La sofrologia è un metodo psicocorporeo di rilassamento e gestione dello stress basato su respirazione, distensione muscolare e visualizzazione positiva.",
          },
          {
            q: "Come scelgo l'approccio giusto per me?",
            a: "Parti dal tuo obiettivo: stress e sonno (sofrologia, meditazione, ipnosi), dolori e tensioni fisiche (osteopatia, riflessologia, massaggio), sostegno generale e vitalità (naturopatia, agopuntura). I profili descrivono l'approccio di ogni professionista.",
          },
          {
            q: "Le medicine dolci sono riconosciute in Svizzera?",
            a: "Sì. Dal 2015 la medicina complementare è iscritta nella Costituzione federale svizzera (art. 118a). Registri professionali come ASCA ed EMR regolano la pratica e rilasciano certificazioni riconosciute dalle assicurazioni.",
          },
        ],
      },
      {
        id: "piattaforma",
        title: "Terapeuti e piattaforma",
        items: [
          {
            q: "Quanto costa una consulenza?",
            a: "Le tariffe sono stabilite da ogni professionista e indicate sul profilo. Variano per specialità, durata e regione; in genere tra 80 e 150 CHF a seduta.",
          },
          {
            q: "Come divento un terapeuta su Holiswiss?",
            a: "I professionisti possono creare il proprio profilo dall'area terapeuti di holiswiss.ch. L'iscrizione base è gratuita; i piani premium offrono più visibilità, agenda, CRM e prenotazione online.",
          },
          {
            q: "Come prenoto un appuntamento?",
            a: "Dal profilo di un terapeuta scegli un orario disponibile e conferma online. Ricevi una conferma via email; alcuni professionisti offrono anche promemoria automatici.",
          },
          {
            q: "Le recensioni pubblicate sono autentiche?",
            a: "Sì. Le recensioni provengono dai pazienti e sono moderate prima della pubblicazione per garantire riscontri affidabili.",
          },
        ],
      },
    ],
  },
  en: {
    h1: "Frequently asked questions — Holiswiss",
    intro:
      "Everything you need to find a holistic therapist in Switzerland, understand reimbursement for complementary medicine and use Holiswiss — in English, French, German and Italian.",
    categories: [
      {
        id: "find",
        title: "Finding a therapist",
        items: [
          {
            q: "How do I find a holistic therapist in Switzerland?",
            a: "Open the Therapists page on Holiswiss, search by city or canton and filter by specialty (naturopathy, sophrology, hypnosis, acupuncture…) and language. The interactive map shows practitioners near you across all 26 cantons, including smaller towns.",
          },
          {
            q: "Can I consult a therapist online or only in person?",
            a: "Both. Each profile states the formats offered: in-person sessions, remote via video call, or both. You can filter by your preference when searching.",
          },
          {
            q: "Are the therapists on Holiswiss verified?",
            a: "Yes. Profiles are verified and show specialty, approach, languages spoken, prices and, where applicable, professional certifications (ASCA, RME/EMR) as well as authentic patient reviews.",
          },
          {
            q: "Which cities and cantons does Holiswiss cover?",
            a: "Holiswiss covers all of Switzerland: Geneva, Lausanne, Zurich, Bern, Basel, Lucerne, Fribourg, Neuchâtel, Sion, Lugano and all 26 cantons (French-, German- and Italian-speaking regions).",
          },
          {
            q: "In which languages can I search?",
            a: "The platform is available in English, French, German and Italian, and you can filter practitioners by the language they speak.",
          },
        ],
      },
      {
        id: "reimbursement",
        title: "Reimbursement & insurance",
        items: [
          {
            q: "Are complementary therapies reimbursed in Switzerland?",
            a: "Generally not by basic insurance (LAMal), but many supplementary insurers reimburse sessions fully or partially when the practitioner is ASCA-, RME- or EMR-certified. The amount and percentage depend on your policy.",
          },
          {
            q: "Which supplementary insurers reimburse complementary medicine?",
            a: "Most major insurers offer complementary-medicine cover: CSS, Helsana, Swica, Visana, Sanitas, Assura, Groupe Mutuel, Concordia. Check with your insurer which therapies are recognised and the annual cap.",
          },
          {
            q: "What do the ASCA and RME (EMR) certifications mean?",
            a: "ASCA (Swiss Foundation for Complementary Medicine) and RME/EMR (Empirical Medicine Register) are the two main registers recognising therapists in Switzerland. ASCA or RME certification is usually required for supplementary insurers to reimburse sessions.",
          },
          {
            q: "Do I need a medical prescription?",
            a: "Usually not for complementary therapies: you can consult a practitioner directly. Some supplementary insurers may request documentation, so check with your insurer before the first session.",
          },
        ],
      },
      {
        id: "specialties",
        title: "Specialties & approaches",
        items: [
          {
            q: "Which specialties can I find on Holiswiss?",
            a: "Naturopathy, sophrology, hypnotherapy, acupuncture, osteopathy, reflexology, wellness massage, reiki, magnetism, meditation, kinesiology, ayurveda, aromatherapy, shiatsu, holistic coaching and many other complementary-medicine approaches.",
          },
          {
            q: "What is the difference between naturopathy and sophrology?",
            a: "Naturopathy supports overall health through natural means (nutrition, herbal medicine, lifestyle). Sophrology is a mind-body relaxation and stress-management method based on breathing, muscle relaxation and positive visualisation.",
          },
          {
            q: "How do I choose the right approach for my needs?",
            a: "Start from your goal: stress and sleep (sophrology, meditation, hypnosis), pain and physical tension (osteopathy, reflexology, massage), overall support and vitality (naturopathy, acupuncture). Each profile describes the practitioner's approach.",
          },
          {
            q: "Is complementary medicine recognised in Switzerland?",
            a: "Yes. Since 2015, complementary medicine has been enshrined in the Swiss Federal Constitution (art. 118a). Professional registers such as ASCA and RME regulate practice and issue certifications recognised by insurers.",
          },
        ],
      },
      {
        id: "platform",
        title: "Therapists & platform",
        items: [
          {
            q: "How much does a consultation cost?",
            a: "Prices are set by each practitioner and shown on their profile. They vary by specialty, duration and region; typically between CHF 80 and 150 per session.",
          },
          {
            q: "How do I get listed as a therapist on Holiswiss?",
            a: "Practitioners can create their profile from the therapist area of holiswiss.ch. Basic listing is free; premium plans offer more visibility, a calendar, a CRM and online booking.",
          },
          {
            q: "How do I book an appointment?",
            a: "From a therapist's profile, pick an available slot and confirm online. You receive an email confirmation; some practitioners also offer automatic reminders before the session.",
          },
          {
            q: "Are the published reviews authentic?",
            a: "Yes. Reviews come from patients and are moderated before publication to ensure reliable, relevant feedback on each practitioner.",
          },
        ],
      },
    ],
  },
};
