import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { seoLinks } from "@/lib/seo";

export const Route = createFileRoute("/$lang/conditions/")({
  component: ConditionsPage,
  head: ({ params }) => ({
    meta: [
      { title: "Conditions générales d'utilisation — Holiswiss" },
      { name: "description", content: "Conditions générales d'utilisation (CGU/CGV) de la plateforme Holiswiss, annuaire suisse de thérapeutes en approches complémentaires." },
      { name: "robots", content: "noindex, follow" },
    ],
    links: seoLinks(params.lang, "/conditions"),
  }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-[#b86ef9]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#d4c4e0] space-y-2">{children}</div>
    </div>
  );
}

function ConditionsPage() {
  const { lang } = useParams({ from: "/$lang/conditions/" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Conditions générales d'utilisation</h1>
        <p className="mt-2 text-sm text-[#b86ef9]">CGU / CGV — Holiswiss, plateforme d'annuaire de praticiens en bien-être</p>
      </div>

      <Section title="1. Objet et acceptation">
        <p>Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme <strong className="text-white">Holiswiss</strong> (holiswiss.ch), éditée par Groupe Holi.</p>
        <p>L'accès au site implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser la plateforme.</p>
      </Section>

      <Section title="2. Description des services">
        <p>Holiswiss est une plateforme de mise en relation entre :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><strong className="text-white">Les praticiens</strong> en bien-être holistique (thérapeutes, énergéticiens, sophrologues, naturopathes, etc.) qui souhaitent promouvoir leur activité</li>
          <li><strong className="text-white">Les personnes</strong> recherchant un praticien adapté à leurs besoins en Suisse</li>
        </ul>
        <p>Holiswiss n'est pas un prestataire de soins de santé et ne peut être tenu responsable de la nature, qualité ou résultat des accompagnements proposés par les praticiens.</p>
      </Section>

      <Section title="3. Création de compte et responsabilités des praticiens">
        <p>Pour créer un profil sur Holiswiss, le praticien doit :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Fournir des informations exactes, complètes et à jour</li>
          <li>Ne pas usurper l'identité d'un tiers</li>
          <li>Être légalement habilité à exercer les pratiques déclarées</li>
          <li>Maintenir la confidentialité de ses identifiants de connexion</li>
        </ul>
        <p>Le praticien reste seul responsable du contenu qu'il publie sur son profil. Holiswiss se réserve le droit de modérer, modifier ou supprimer tout contenu contraire aux présentes CGU ou à la législation applicable.</p>
      </Section>

      <Section title="4. Offres et tarifs">
        <p>Holiswiss propose plusieurs formules d'abonnement pour les praticiens :</p>
        <div className="mt-3 rounded-xl border border-[rgba(184,110,249,0.2)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#3d1a5c]">
              <tr>
                <th className="py-2 px-4 text-left text-white font-semibold">Formule</th>
                <th className="py-2 px-4 text-left text-white font-semibold">Prix</th>
                <th className="py-2 px-4 text-left text-white font-semibold">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(184,110,249,0.1)]">
              <tr>
                <td className="py-2 px-4 text-white">Basic</td>
                <td className="py-2 px-4">Gratuit</td>
                <td className="py-2 px-4">Sans engagement</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-white">Essentiel</td>
                <td className="py-2 px-4">49 CHF / mois</td>
                <td className="py-2 px-4">Mensuel, résiliable à tout moment</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-white">Elite Pro</td>
                <td className="py-2 px-4">99 CHF / mois</td>
                <td className="py-2 px-4">Mensuel, résiliable à tout moment</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">Les tarifs sont indiqués en <strong className="text-white">francs suisses (CHF)</strong> toutes taxes comprises. Holiswiss se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.</p>
        <p>Voir le détail complet des fonctionnalités sur la <Link to="/$lang/tarifs" params={{ lang }} className="text-[#b86ef9] hover:underline">page Tarifs</Link>.</p>
      </Section>

      <Section title="5. Paiement et facturation">
        <p>Les paiements sont traités de manière sécurisée par <strong className="text-white">Stripe</strong>. Holiswiss ne stocke aucune donnée bancaire.</p>
        <p>L'abonnement est renouvelé automatiquement chaque mois à la date anniversaire de la souscription, sauf résiliation préalable.</p>
        <p>Une facture est émise automatiquement à chaque renouvellement et disponible dans votre espace thérapeute.</p>
      </Section>

      <Section title="6. Résiliation et remboursement">
        <p>Vous pouvez résilier votre abonnement à tout moment depuis votre espace thérapeute (rubrique Abonnement) ou en contactant <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a>.</p>
        <p>La résiliation prend effet à la fin de la période en cours. <strong className="text-white">Aucun remboursement prorata temporis</strong> ne sera effectué pour la période entamée, sauf en cas d'erreur de facturation ou de dysfonctionnement majeur de la plateforme imputable à Holiswiss.</p>
        <p><strong className="text-white">Droit de rétractation :</strong> Conformément au droit applicable, les abonnements numériques souscrits en ligne bénéficient d'un droit de rétractation de 14 jours à compter de la souscription, à condition que le service n'ait pas encore été utilisé.</p>
      </Section>

      <Section title="7. Modération et suspension de compte">
        <p>Holiswiss se réserve le droit de suspendre ou supprimer tout compte sans préavis en cas de :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Informations fausses ou trompeuses</li>
          <li>Non-paiement</li>
          <li>Violation des présentes CGU</li>
          <li>Comportement contraire à l'éthique ou portant atteinte à d'autres utilisateurs</li>
          <li>Exercice illicite d'une profession réglementée</li>
        </ul>
        <p>En cas de suspension pour manquement, aucun remboursement ne sera effectué.</p>
      </Section>

      <Section title="8. Propriété intellectuelle">
        <p>Le praticien conserve la propriété de ses contenus (photos, textes, descriptions) et accorde à Holiswiss une licence non exclusive, mondiale et gratuite pour les afficher sur la plateforme dans le cadre du service.</p>
        <p>Le praticien garantit disposer des droits nécessaires sur les contenus qu'il publie.</p>
      </Section>

      <Section title="9. Limitation de responsabilité">
        <p>Holiswiss est une plateforme de mise en relation. La responsabilité de Holiswiss ne peut être engagée en cas de :</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Préjudice résultant d'un accompagnement réalisé par un praticien</li>
          <li>Indisponibilité temporaire de la plateforme pour maintenance</li>
          <li>Perte de données non imputable à une faute grave de Holiswiss</li>
          <li>Actes frauduleux commis par des tiers</li>
        </ul>
        <p>En tout état de cause, la responsabilité de Holiswiss est limitée au montant des sommes versées au cours des 12 derniers mois.</p>
      </Section>

      <Section title="10. Droit applicable et litiges">
        <p>Les présentes CGU sont régies par le <strong className="text-white">droit suisse</strong>.</p>
        <p>En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, les tribunaux compétents seront ceux du <strong className="text-white">canton de Genève</strong>.</p>
      </Section>

      <Section title="11. Modifications des CGU">
        <p>Holiswiss se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par e-mail ou notification sur la plateforme, avec un préavis de 30 jours.</p>
        <p>La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles CGU.</p>
      </Section>

      <Section title="12. Contact">
        <p>Pour toute question relative aux présentes CGU :</p>
        <p>E-mail : <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a></p>
      </Section>

      <p className="mt-10 text-xs text-[#9980b8]">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-CH", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
