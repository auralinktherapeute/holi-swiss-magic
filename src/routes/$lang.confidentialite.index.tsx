import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/confidentialite/")({
  component: ConfidentialitePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-[#b86ef9]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#d4c4e0] space-y-2">{children}</div>
    </div>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-[rgba(184,110,249,0.1)]">
      <td className="py-2 pr-6 font-medium text-white">{label}</td>
      <td className="py-2 text-[#d4c4e0]">{value}</td>
    </tr>
  );
}

function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-[#b86ef9]">Conforme à la nLPD (Suisse, en vigueur depuis le 1er septembre 2023) et au RGPD (UE)</p>
      </div>

      <Section title="1. Responsable du traitement">
        <p><strong className="text-white">Groupe Holi</strong> — représenté par Gérald Henry</p>
        <p>Contact : <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a></p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons les données suivantes selon votre utilisation du site :</p>

        <div className="mt-4 rounded-xl border border-[rgba(184,110,249,0.2)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#3d1a5c]">
              <tr>
                <th className="py-2 px-4 text-left text-white font-semibold">Donnée</th>
                <th className="py-2 px-4 text-left text-white font-semibold">Finalité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(184,110,249,0.1)] px-4">
              <tr className="border-b border-[rgba(184,110,249,0.1)]">
                <td className="py-2 px-4 text-white">Nom, prénom, e-mail</td>
                <td className="py-2 px-4">Création de compte, communication</td>
              </tr>
              <tr className="border-b border-[rgba(184,110,249,0.1)]">
                <td className="py-2 px-4 text-white">Spécialités, description, photo</td>
                <td className="py-2 px-4">Profil praticien public</td>
              </tr>
              <tr className="border-b border-[rgba(184,110,249,0.1)]">
                <td className="py-2 px-4 text-white">Coordonnées GPS / canton</td>
                <td className="py-2 px-4">Géolocalisation dans l'annuaire</td>
              </tr>
              <tr className="border-b border-[rgba(184,110,249,0.1)]">
                <td className="py-2 px-4 text-white">Données de réservation</td>
                <td className="py-2 px-4">Gestion des rendez-vous</td>
              </tr>
              <tr className="border-b border-[rgba(184,110,249,0.1)]">
                <td className="py-2 px-4 text-white">Données de paiement</td>
                <td className="py-2 px-4">Traité exclusivement par Stripe (non stocké par nous)</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-white">Données de navigation (logs)</td>
                <td className="py-2 px-4">Sécurité, statistiques anonymes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="3. Base légale du traitement">
        <p>Nos traitements reposent sur les bases légales suivantes :</p>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li><strong className="text-white">Exécution du contrat</strong> — nécessaire pour vous fournir nos services</li>
          <li><strong className="text-white">Consentement</strong> — pour les communications marketing et les cookies non essentiels</li>
          <li><strong className="text-white">Intérêt légitime</strong> — pour la sécurité et la prévention des fraudes</li>
          <li><strong className="text-white">Obligation légale</strong> — pour le respect des obligations comptables et fiscales</li>
        </ul>
      </Section>

      <Section title="4. Durée de conservation">
        <ul className="ml-4 list-disc space-y-1">
          <li>Données de compte : conservées jusqu'à suppression du compte + 3 mois</li>
          <li>Données de facturation : 10 ans (obligation légale)</li>
          <li>Logs de connexion : 12 mois</li>
          <li>Données inactives : supprimées après 2 ans d'inactivité</li>
        </ul>
      </Section>

      <Section title="5. Transferts de données à l'étranger">
        <p>Certains prestataires peuvent traiter vos données hors de Suisse :</p>
        <div className="mt-3 rounded-xl border border-[rgba(184,110,249,0.2)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#3d1a5c]">
              <tr>
                <th className="py-2 px-4 text-left text-white font-semibold">Prestataire</th>
                <th className="py-2 px-4 text-left text-white font-semibold">Pays</th>
                <th className="py-2 px-4 text-left text-white font-semibold">Rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(184,110,249,0.1)]">
              <tr>
                <td className="py-2 px-4 text-white">Supabase</td>
                <td className="py-2 px-4">Royaume-Uni (eu-west-2)</td>
                <td className="py-2 px-4">Base de données</td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-white">Stripe</td>
                <td className="py-2 px-4">USA</td>
                <td className="py-2 px-4">Paiements (certifié PCI-DSS)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types, Privacy Shield ou décision d'adéquation).</p>
      </Section>

      <Section title="6. Cookies et traceurs">
        <p>Holiswiss utilise des cookies techniques nécessaires au bon fonctionnement du site (session, préférence de langue). Aucun cookie publicitaire ou traceur tiers n'est installé sans votre consentement.</p>
        <p>Vous pouvez à tout moment gérer vos préférences via les paramètres de votre navigateur. Le refus des cookies techniques peut altérer le fonctionnement du site.</p>
      </Section>

      <Section title="7. Vos droits (nLPD / RGPD)">
        <p>Conformément à la nLPD suisse et au RGPD, vous disposez des droits suivants :</p>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li><strong className="text-white">Accès</strong> — obtenir une copie de vos données</li>
          <li><strong className="text-white">Rectification</strong> — corriger des données inexactes</li>
          <li><strong className="text-white">Suppression</strong> — demander l'effacement de vos données</li>
          <li><strong className="text-white">Portabilité</strong> — recevoir vos données dans un format structuré</li>
          <li><strong className="text-white">Opposition</strong> — s'opposer à certains traitements</li>
          <li><strong className="text-white">Limitation</strong> — restreindre temporairement le traitement</li>
        </ul>
        <p className="mt-3">Pour exercer vos droits : <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a></p>
        <p>Délai de réponse : 30 jours maximum. En cas de litige, vous pouvez saisir le <strong className="text-white">Préposé fédéral à la protection des données et à la transparence (PFPDT)</strong> — <a href="https://www.edoeb.admin.ch" className="text-[#b86ef9] hover:underline" target="_blank" rel="noopener noreferrer">www.edoeb.admin.ch</a></p>
      </Section>

      <Section title="8. Sécurité des données">
        <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement TLS, authentification sécurisée, accès restreint par rôle (RLS Supabase), sauvegardes régulières.</p>
      </Section>

      <Section title="9. Modifications">
        <p>Cette politique peut être mise à jour. En cas de modification substantielle, nous vous en informerons par e-mail ou via une notification sur le site. La date de dernière mise à jour est indiquée ci-dessous.</p>
      </Section>

      <p className="mt-10 text-xs text-[#9980b8]">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-CH", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
