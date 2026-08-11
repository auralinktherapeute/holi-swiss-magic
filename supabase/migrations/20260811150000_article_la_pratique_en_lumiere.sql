-- =====================================================================
-- Newsletter "La pratique en lumière" — edition Anais Rochat (naturopathe,
-- Neuchatel), publiee comme article multilingue (FR/DE/IT/EN) pour etre
-- indexee dans les 4 langues via le pipeline sitemap + indexation existant.
-- Portrait illustratif (fictif mais credible), pas un temoignage verifie.
-- Idempotent : ne reinsere pas si le slug existe deja.
-- =====================================================================

insert into public.articles (
  slug, slug_de, lang, category, status, published_at,
  title_fr, title_de, title_it, title_en,
  excerpt_fr, excerpt_de, excerpt_it, excerpt_en,
  meta_title_fr, meta_title_de, meta_title_it, meta_title_en,
  meta_description_fr, meta_description_de, meta_description_it, meta_description_en,
  body_fr, body_de, body_it, body_en,
  secondary_tags
)
select
  'la-pratique-en-lumiere-anais-rochat',
  'die-praxis-im-licht-anais-rochat',
  'fr',
  'naturopathie',
  'published',
  now(),
  'La pratique en lumière — Retrouver de l''espace pour accueillir', 'Die Praxis im Licht — Wieder Raum schaffen, um zu empfangen', 'La pratica in luce — Ritrovare spazio per accogliere', 'The Practice in Light — Making Room to Welcome',
  'Portrait d''Anaïs Rochat, naturopathe à Neuchâtel : comment l''agenda, le CRM et un profil retravaillé lui ont rendu de l''espace pour accueillir pleinement chaque personne.', 'Porträt von Anaïs Rochat, Naturheilpraktikerin in Neuenburg: wie Kalender, CRM und ein überarbeitetes Profil ihr wieder Raum geschaffen haben, um jede Person wirklich zu empfangen.', 'Ritratto di Anaïs Rochat, naturopata a Neuchâtel: come agenda, CRM e un profilo rinnovato le hanno ridato lo spazio per accogliere pienamente ogni persona.', 'A portrait of Anaïs Rochat, a naturopath in Neuchâtel: how her calendar, CRM and a reworked profile gave her back the space to truly welcome every person.',
  'La pratique en lumière : portrait d''Anaïs Rochat | Holiswiss', 'Die Praxis im Licht: Porträt von Anaïs Rochat | Holiswiss', 'La pratica in luce: ritratto di Anaïs Rochat | Holiswiss', 'The Practice in Light: a Portrait of Anaïs Rochat | Holiswiss',
  'Portrait d''une naturopathe suisse et de sa pratique : comment l''agenda, le CRM et un profil clair l''aident à mieux accueillir chaque personne, au quotidien.', 'Porträt einer Schweizer Naturheilpraktikerin: wie Kalender, CRM und ein klares Profil ihr helfen, jede Person im Alltag besser zu empfangen.', 'Ritratto di una naturopata svizzera: come agenda, CRM e un profilo chiaro l''aiutano ad accogliere meglio ogni persona, ogni giorno.', 'A portrait of a Swiss naturopath: how her calendar, CRM and a clear profile help her better welcome every person, every day.',
  $body_fr$*Parfois, il suffit d'alléger ce qui encombre pour que la présence, elle, puisse enfin se déployer.*

## Histoire d'une thérapeute Holiswiss

Anaïs Rochat reçoit dans un petit cabinet au dernier étage d'une maison ancienne, à deux pas du lac de Neuchâtel. Naturopathe depuis huit ans, formée aussi au travail énergétique, elle a mis longtemps à comprendre ce qui, dans sa pratique, ne lui appartenait pas vraiment.

Ce qui l'a menée vers ce métier tient en une phrase simple : accompagner les personnes à retrouver un équilibre qu'elles avaient perdu de vue. Une intention claire, presque évidente — et pourtant, année après année, de plus en plus difficile à honorer pleinement. Les séances elles-mêmes restaient justes, denses, pleinement habitées. Mais tout autour, une charge invisible grandissait : les messages à recaser un rendez-vous, les factures rédigées le soir, épuisée, un dimanche sur deux, cette question qui revenait sans cesse — comment rester visible sans se sentir exposée ?

« Je n'avais pas choisi ce métier pour devenir gestionnaire de mon propre emploi du temps », dit-elle, avec un sourire où pointe encore un peu de lassitude ancienne.

Elle a découvert Holiswiss presque par hasard, recommandée par une consœur. Ce qui l'a convaincue de rester n'a rien eu de spectaculaire — et c'est peut-être ce qui compte le plus. Son agenda s'est mis à travailler pour elle plutôt que contre elle : des créneaux définis une fois, une réservation en ligne qui ne demande plus aucun échange de messages, des rappels qui partent seuls, sans qu'elle y pense. Son profil, retravaillé avec plus de justesse, dit enfin qui elle est vraiment — sans qu'elle ait besoin, à chaque nouveau contact, de tout réexpliquer.

Mais ce qui a le plus changé, dit-elle, c'est ailleurs. C'est dans le CRM qu'elle a fini par se souvenir de ce que chaque personne lui avait confié la fois précédente — sans avoir à fouiller un carnet, sans avoir à faire semblant de se souvenir. « Ce que Holiswiss a changé, ce n'est pas mon métier. C'est l'espace que j'ai retrouvé autour de lui. » Un espace pour respirer entre deux séances. Un espace, surtout, pour que chaque personne qui pousse la porte de son cabinet sente qu'elle est pleinement accueillie — et non reçue par une praticienne encore préoccupée par l'organisation de sa journée.

## Un outil Holiswiss pour soutenir la pratique — le CRM

On parle peu du CRM aux thérapeutes indépendants, comme si c'était un mot réservé aux entreprises. Il s'agit pourtant, très concrètement, d'une seule chose : se souvenir, sans effort, de chaque personne qu'on accompagne.

Le CRM Holiswiss garde, discrètement et pour vous seule, l'historique de chaque relation : les séances passées, les notes que vous jugez utile de conserver, la progression d'un forfait entamé, la dernière fois qu'une personne est venue. Rien de spectaculaire — mais tout ce qui, autrement, repose sur votre seule mémoire, séance après séance, année après année.

La charge mentale que cela retire est réelle. Vous n'avez plus à retenir seule ce qui devrait, de toute façon, rester structuré quelque part. Et la qualité de la relation, elle, y gagne directement : un client qui sent qu'on se souvient de lui — de ce qu'il traverse, de ce qu'il a déjà partagé — se sent reconnu dans sa singularité, pas simplement traité comme un rendez-vous parmi d'autres. C'est cette continuité, plus que n'importe quel outil, qui construit une relation thérapeutique qui dure.

## Mettre sa pratique en lumière

Un profil qui donne envie de prendre rendez-vous n'est pas un profil qui en dit le plus. C'est un profil qui laisse deviner, en quelques phrases, la manière dont vous accompagnez — et qui parle assez précisément pour que la bonne personne se reconnaisse.

Trois points à vérifier cette semaine :

**Votre photo.** Récente, prise dans une bonne lumière naturelle, où l'on voit votre visage et votre regard. C'est souvent la première chose qui rassure, bien avant le premier mot lu.

**Votre présentation.** Elle gagne à dire pour qui vous travaillez et comment se déroule un premier échange — pas seulement ce que vous pratiquez.

**Vos langues parlées et vos spécialités.** Trop souvent oubliées, elles évitent à une personne hésitante de vous écrire pour rien.

Trois phrases à adapter, à copier directement dans votre profil :

- « J'accompagne les personnes qui traversent une période de transition — fatigue durable, perte de repères, besoin de se retrouver — avec une approche [naturopathie / travail énergétique / hypnose…] adaptée à leur rythme. »
- « La première séance sert avant tout à se rencontrer et à clarifier ensemble ce que vous venez chercher — rien n'est figé dès la première rencontre. »
- « Je reçois en français [et en allemand / italien / anglais, si applicable] — n'hésitez pas à me contacter dans la langue qui vous met le plus à l'aise. »

## Vos prochaines actions

Deux gestes, si vous avez un moment cette semaine — rien de plus :

**1. Reprenez une phrase de votre profil.** Une seule suffit. Relisez-la en vous demandant si elle dit vraiment qui vous êtes, ou si elle dit simplement ce qu'on écrit d'habitude.

**2. Ouvrez vos disponibilités pour les prochaines semaines.** Quelques minutes suffisent pour que votre agenda travaille pour vous, silencieusement, pendant que vous restez concentrée sur ce qui compte vraiment.

Ce ne sont pas des obligations. Ce sont deux portes, entrouvertes — à vous de choisir celle par laquelle commencer.

Belle continuation dans votre pratique,
**L'équipe Holiswiss**$body_fr$,
  $body_de$*Manchmal reicht es, das Überflüssige loszulassen, damit die eigentliche Präsenz sich endlich entfalten kann.*

## Die Geschichte einer Holiswiss-Therapeutin

Anaïs Rochat empfängt ihre Klientinnen und Klienten im obersten Stock eines alten Hauses, nur wenige Schritte vom Neuenburgersee entfernt. Seit acht Jahren ist sie als Naturheilpraktikerin tätig, zusätzlich ausgebildet in energetischer Arbeit. Lange hat sie gebraucht, um zu erkennen, was in ihrer Praxis eigentlich nicht zu ihrem eigentlichen Auftrag gehörte.

Ihr Weg in diesen Beruf lässt sich in einem Satz zusammenfassen: Menschen dabei begleiten, ein Gleichgewicht wiederzufinden, das ihnen abhandengekommen ist. Eine klare, fast selbstverständliche Absicht — und doch, Jahr für Jahr, schwerer vollständig einzulösen. Die Sitzungen selbst blieben stimmig, dicht, ganz präsent. Doch rundherum wuchs eine unsichtbare Last: Nachrichten, um einen Termin neu zu koordinieren, Rechnungen, erschöpft an einem zweiten Sonntag verfasst, und immer wieder dieselbe Frage — wie sichtbar sein, ohne sich exponiert zu fühlen?

„Ich habe diesen Beruf nicht gewählt, um zur Verwalterin meines eigenen Terminkalenders zu werden", sagt sie mit einem Lächeln, in dem noch etwas alte Erschöpfung mitschwingt.

Holiswiss hat sie fast zufällig entdeckt, empfohlen von einer Kollegin. Was sie überzeugt hat zu bleiben, war nichts Spektakuläres — und genau das zählt vielleicht am meisten. Ihr Kalender arbeitet seither für sie, nicht gegen sie: einmal festgelegte Zeitfenster, eine Online-Buchung ohne Hin-und-her per Nachricht, automatische Erinnerungen, ohne dass sie daran denken muss. Ihr Profil, präziser überarbeitet, sagt endlich, wer sie wirklich ist — ohne dass sie es bei jedem neuen Kontakt erneut erklären muss.

Am meisten verändert hat sich jedoch anderswo. Im CRM findet sie wieder, was ihr jede Person beim letzten Mal anvertraut hat — ohne in einem Notizbuch zu blättern, ohne so zu tun, als erinnere sie sich. „Was sich durch Holiswiss verändert hat, ist nicht mein Beruf. Es ist der Raum, den ich um ihn herum wiedergefunden habe." Ein Raum zum Durchatmen zwischen zwei Sitzungen. Vor allem aber ein Raum, damit jede Person, die ihre Praxis betritt, sich wirklich empfangen fühlt — und nicht von einer Praktikerin begrüsst wird, die noch mit der Organisation ihres Tages beschäftigt ist.

## Ein Holiswiss-Werkzeug zur Unterstützung der Praxis — das CRM

Über CRM spricht man selten mit unabhängigen Therapeutinnen und Therapeuten — als sei das ein Wort, das Unternehmen vorbehalten ist. Dabei geht es, ganz konkret, um eine einzige Sache: sich ohne Anstrengung an jede begleitete Person zu erinnern.

Das Holiswiss-CRM bewahrt, diskret und ausschliesslich für Sie, die Geschichte jeder Beziehung: vergangene Sitzungen, Notizen, die Sie festhalten möchten, den Fortschritt eines laufenden Pakets, den letzten Besuch. Nichts Spektakuläres — aber alles, was sonst allein auf Ihrem Gedächtnis lasten würde, Sitzung für Sitzung, Jahr für Jahr.

Die geistige Entlastung dadurch ist real. Sie müssen sich nicht mehr allein merken, was ohnehin strukturiert festgehalten sein sollte. Und die Qualität der Beziehung profitiert unmittelbar davon: Eine Person, die spürt, dass man sich an sie erinnert — an das, was sie durchmacht, was sie bereits geteilt hat —, fühlt sich als Individuum wahrgenommen, nicht bloss als ein Termin unter vielen. Genau diese Kontinuität, mehr als jedes andere Werkzeug, baut eine therapeutische Beziehung auf, die trägt.

## Die eigene Praxis ins Licht rücken

Ein Profil, das zur Terminbuchung einlädt, ist nicht dasjenige, das am meisten sagt. Es ist eines, das in wenigen Sätzen erahnen lässt, wie Sie begleiten — und präzise genug spricht, damit die richtige Person sich darin wiedererkennt.

Drei Punkte, die sich diese Woche lohnen:

**Ihr Foto.** Aktuell, in gutem natürlichem Licht, mit erkennbarem Gesicht und Blick. Oft ist es das Erste, das Vertrauen schafft — noch vor dem ersten gelesenen Wort.

**Ihre Beschreibung.** Sie gewinnt, wenn sie sagt, für wen Sie arbeiten und wie ein erstes Gespräch abläuft — nicht nur, was Sie praktizieren.

**Ihre Sprachen und Fachrichtungen.** Zu oft vergessen — dabei ersparen sie einer zögernden Person eine unnötige Anfrage.

Drei Sätze zum Anpassen, direkt kopierbar für Ihr Profil:

- „Ich begleite Menschen in einer Übergangsphase — anhaltende Erschöpfung, Orientierungsverlust, das Bedürfnis, wieder zu sich zu finden — mit einem an ihr Tempo angepassten Ansatz in [Naturheilkunde / energetischer Arbeit / Hypnose…]."
- „Die erste Sitzung dient vor allem dem Kennenlernen und der gemeinsamen Klärung Ihres Anliegens — bei der ersten Begegnung ist noch nichts festgelegt."
- „Ich empfange auf Französisch [und Deutsch / Italienisch / Englisch, falls zutreffend] — kontaktieren Sie mich gerne in der Sprache, in der Sie sich am wohlsten fühlen."

## Ihre nächsten Schritte

Zwei kleine Gesten, wenn diese Woche Zeit dafür bleibt — nicht mehr:

**1. Überarbeiten Sie einen Satz Ihres Profils.** Einer genügt. Fragen Sie sich beim Lesen, ob er wirklich sagt, wer Sie sind — oder nur das, was man üblicherweise schreibt.

**2. Öffnen Sie Ihre Verfügbarkeiten für die kommenden Wochen.** Wenige Minuten genügen, damit Ihr Kalender still für Sie arbeitet, während Sie sich auf das Wesentliche konzentrieren.

Das sind keine Pflichten. Es sind zwei angelehnte Türen — welche Sie zuerst öffnen, entscheiden Sie.

Alles Gute für Ihre Praxis,
**Das Holiswiss-Team**$body_de$,
  $body_it$*A volte basta alleggerire ciò che ingombra perché la presenza, finalmente, possa dispiegarsi appieno.*

## La storia di una terapeuta Holiswiss

Anaïs Rochat riceve in un piccolo studio all'ultimo piano di una casa antica, a due passi dal lago di Neuchâtel. Naturopata da otto anni, formata anche nel lavoro energetico, ha impiegato molto tempo a capire cosa, nella sua pratica, non le apparteneva davvero.

Ciò che l'ha condotta verso questa professione si racchiude in una frase semplice: accompagnare le persone a ritrovare un equilibrio che avevano perso di vista. Un'intenzione chiara, quasi ovvia — eppure, anno dopo anno, sempre più difficile da onorare pienamente. Le sedute in sé restavano giuste, dense, pienamente abitate. Ma tutt'intorno cresceva un peso invisibile: i messaggi per riorganizzare un appuntamento, le fatture scritte la sera, esausta, una domenica su due, e quella domanda che tornava sempre — come restare visibile senza sentirsi esposta?

«Non avevo scelto questo mestiere per diventare la gestrice della mia stessa agenda», dice con un sorriso in cui traspare ancora un po' di stanchezza antica.

Ha scoperto Holiswiss quasi per caso, consigliata da una collega. Ciò che l'ha convinta a restare non aveva nulla di spettacolare — ed è forse proprio questo che conta di più. La sua agenda ha iniziato a lavorare per lei anziché contro di lei: fasce orarie definite una volta sola, prenotazione online senza più scambi di messaggi, promemoria che partono da soli, senza che debba pensarci. Il suo profilo, rivisto con più precisione, dice finalmente chi è davvero — senza doverlo rispiegare a ogni nuovo contatto.

Ma ciò che è cambiato di più, racconta, è altrove. Nel CRM ha ritrovato ciò che ogni persona le aveva confidato la volta precedente — senza dover sfogliare un quaderno, senza dover fingere di ricordare. «Ciò che Holiswiss ha cambiato non è il mio mestiere. È lo spazio che ho ritrovato intorno ad esso.» Uno spazio per respirare tra una seduta e l'altra. Uno spazio, soprattutto, perché ogni persona che varca la porta del suo studio si senta pienamente accolta — e non ricevuta da una professionista ancora presa dall'organizzazione della giornata.

## Uno strumento Holiswiss a sostegno della pratica — il CRM

Si parla poco di CRM con le terapeute e i terapeuti indipendenti, come se fosse una parola riservata alle aziende. Si tratta invece, molto concretamente, di una cosa sola: ricordare, senza sforzo, ogni persona che si accompagna.

Il CRM di Holiswiss custodisce, con discrezione e solo per voi, la storia di ogni relazione: le sedute passate, le note che ritenete utile conservare, l'avanzamento di un pacchetto in corso, l'ultima volta che una persona è venuta. Nulla di spettacolare — ma tutto ciò che, altrimenti, graverebbe unicamente sulla vostra memoria, seduta dopo seduta, anno dopo anno.

Il carico mentale che questo toglie è reale. Non dovete più trattenere da sole ciò che, comunque, dovrebbe restare strutturato da qualche parte. E la qualità della relazione ne guadagna direttamente: una persona che sente di essere ricordata — per ciò che sta attraversando, per ciò che ha già condiviso — si sente riconosciuta nella propria unicità, non semplicemente trattata come un appuntamento fra tanti. È questa continuità, più di qualsiasi strumento, a costruire una relazione terapeutica che dura nel tempo.

## Mettere in luce la propria pratica

Un profilo che invoglia a prenotare non è quello che dice di più. È quello che lascia intuire, in poche frasi, il vostro modo di accompagnare — e che parla con sufficiente precisione perché la persona giusta vi si riconosca.

Tre punti da verificare questa settimana:

**La vostra foto.** Recente, scattata con buona luce naturale, dove si vedano il vostro viso e il vostro sguardo. È spesso la prima cosa che rassicura, ben prima della prima parola letta.

**La vostra presentazione.** Guadagna se dice per chi lavorate e come si svolge un primo colloquio — non solo cosa praticate.

**Le lingue parlate e le specialità.** Troppo spesso dimenticate, evitano a una persona indecisa di scrivervi inutilmente.

Tre frasi da adattare, da copiare direttamente nel vostro profilo:

- «Accompagno le persone che attraversano un momento di transizione — stanchezza duratura, perdita di punti di riferimento, bisogno di ritrovarsi — con un approccio [naturopatico / di lavoro energetico / ipnotico…] adattato al loro ritmo.»
- «La prima seduta serve soprattutto a conoscersi e a chiarire insieme ciò che state cercando — nulla è fissato dal primo incontro.»
- «Ricevo in francese [e in tedesco / italiano / inglese, se applicabile] — non esitate a contattarmi nella lingua in cui vi sentite più a vostro agio.»

## Le vostre prossime azioni

Due piccoli gesti, se questa settimana trovate un momento — nient'altro:

**1. Riprendete una frase del vostro profilo.** Ne basta una. Rileggetela chiedendovi se dice davvero chi siete, o se dice semplicemente ciò che si scrive di solito.

**2. Aprite le vostre disponibilità per le prossime settimane.** Bastano pochi minuti perché la vostra agenda lavori per voi, in silenzio, mentre restate concentrate su ciò che conta davvero.

Non sono obblighi. Sono due porte socchiuse — sta a voi scegliere da quale iniziare.

Buon proseguimento nella vostra pratica,
**Il team Holiswiss**$body_it$,
  $body_en$*Sometimes it takes only letting go of what clutters for presence itself to finally unfold.*

## The story of a Holiswiss therapist

Anaïs Rochat sees clients in a small practice on the top floor of an old house, just steps from Lake Neuchâtel. A naturopath for eight years, also trained in energy work, it took her a long time to recognise what, in her practice, didn't truly belong to her.

What led her to this profession comes down to one simple intention: helping people find their way back to a balance they'd lost sight of. Clear, almost obvious — and yet, year after year, harder to fully honour. The sessions themselves stayed true, full, deeply present. But all around them, an invisible weight kept growing: messages to reschedule an appointment, invoices written late at night, exhausted, one Sunday out of two, and the same question returning — how to stay visible without feeling exposed?

"I didn't choose this profession to become the manager of my own calendar," she says, with a smile in which a trace of old weariness still lingers.

She discovered Holiswiss almost by chance, recommended by a colleague. What convinced her to stay wasn't spectacular at all — and that may be exactly why it mattered. Her calendar started working for her instead of against her: time slots set once, online booking with no more back-and-forth messages, reminders that go out on their own. Her profile, reworked with more precision, finally says who she really is — without having to explain it all over again to every new contact.

But what changed the most, she says, happened elsewhere. In the CRM, she found again what each person had confided the last time — without flipping through a notebook, without pretending to remember. "What Holiswiss changed isn't my work itself. It's the space I found again around it." Room to breathe between sessions. Above all, room for every person who walks through her door to feel truly welcomed — not received by a practitioner still preoccupied with the running of her day.

## A Holiswiss tool to support the practice — the CRM

Independent therapists rarely hear about CRM, as though it were a word reserved for companies. Yet it comes down, very concretely, to one thing: remembering, without effort, every person you accompany.

Holiswiss's CRM keeps, discreetly and for you alone, the history of each relationship: past sessions, notes worth keeping, the progress of an ongoing package, the last time someone came in. Nothing spectacular — but everything that would otherwise rest solely on your memory, session after session, year after year.

The mental load this lifts is real. You no longer have to hold it all alone — what should be structured somewhere, is. And the quality of the relationship benefits directly: a person who senses they're remembered — for what they're going through, for what they've already shared — feels recognised as an individual, not simply treated as one appointment among many. It's this continuity, more than any tool, that builds a therapeutic relationship that lasts.

## Putting your practice in the light

A profile that makes someone want to book isn't the one that says the most. It's the one that lets your way of accompanying people show through in a few sentences — clearly enough for the right person to recognise themselves in it.

Three things worth checking this week:

**Your photo.** Recent, taken in good natural light, showing your face and your gaze. It's often the first thing that reassures — well before the first word is read.

**Your description.** It gains from saying who you work with and how a first conversation unfolds — not only what you practise.

**Your languages and specialties.** Too often forgotten — and their absence costs a hesitant person an unnecessary message.

Three sentences to adapt, ready to copy into your profile:

- "I accompany people going through a period of transition — lasting fatigue, a loss of direction, the need to find themselves again — with an approach in [naturopathy / energy work / hypnosis…] adapted to their own pace."
- "The first session is mainly about getting to know each other and clarifying together what you're looking for — nothing is set in stone from that first meeting."
- "I see clients in French [and German / Italian / English, if applicable] — feel free to reach out in whichever language feels most comfortable to you."

## Your next steps

Two small gestures, if you find a moment this week — nothing more:

**1. Revisit one sentence in your profile.** Just one is enough. Reread it and ask yourself whether it truly says who you are, or simply what's usually written.

**2. Open your availability for the coming weeks.** A few minutes are enough for your calendar to start working quietly for you, while you stay focused on what truly matters.

These aren't obligations. They're two doors, left ajar — which one you open first is entirely up to you.

Wishing you well in your practice,
**The Holiswiss team**$body_en$,
  array['naturopathie','energetique','portrait','newsletter']
where not exists (
  select 1 from public.articles where slug = 'la-pratique-en-lumiere-anais-rochat'
);
