import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$lang/impressum/")({
  component: ImpressumPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-[#b86ef9]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#d4c4e0] space-y-2">{children}</div>
    </div>
  );
}

function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Mentions légales</h1>
        <p className="mt-2 text-sm text-[#b86ef9]">Impressum — conformément à la LCD suisse</p>
      </div>

      <Section title="Responsable du site">
        <p><strong className="text-white">Raison sociale :</strong> Groupe Holi</p>
        <p><strong className="text-white">Responsable :</strong> Gérald Henry</p>
        <p><strong className="text-white">Adresse :</strong> [Adresse à compléter], Alsace, France</p>
        <p><strong className="text-white">E-mail :</strong>{" "}
          <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a>
        </p>
        <p><strong className="text-white">Téléphone :</strong> Sur demande par e-mail</p>
      </Section>

      <Section title="Statut juridique">
        <p>Entreprise individuelle / structure en cours d'immatriculation.</p>
        <p><strong className="text-white">Numéro IDE :</strong> En cours d'attribution</p>
        <p><strong className="text-white">TVA :</strong> Non assujetti à ce jour</p>
      </Section>

      <Section title="Hébergement & infrastructure technique">
        <p><strong className="text-white">Hébergement :</strong> Netlify, Inc. — 44 Montgomery Street, Suite 300, San Francisco, CA 94104, USA</p>
        <p><strong className="text-white">Base de données :</strong> Supabase (serveurs en Europe — eu-west-2, Londres, Royaume-Uni)</p>
        <p><strong className="text-white">Paiements :</strong> Stripe, Inc. — 510 Townsend Street, San Francisco, CA 94103, USA</p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>L'ensemble des contenus présents sur le site <strong className="text-white">holiswiss.ch</strong> (textes, graphismes, logos, icônes, images, code source) sont la propriété exclusive de Groupe Holi ou de ses partenaires, et sont protégés par les lois applicables en matière de propriété intellectuelle.</p>
        <p>Toute reproduction, représentation, modification ou exploitation, totale ou partielle, sans autorisation écrite préalable est interdite.</p>
        <p>© {new Date().getFullYear()} Groupe Holi / Holiswiss — Tous droits réservés.</p>
      </Section>

      <Section title="Clause de non-responsabilité">
        <p>Holiswiss est une plateforme de mise en relation. Nous ne sommes pas responsables de la qualité, du contenu ou des résultats des accompagnements proposés par les praticiens inscrits sur la plateforme.</p>
        <p>Les informations publiées sur ce site ont un caractère général et informatif. Elles ne constituent en aucun cas un avis médical ou thérapeutique.</p>
        <p>Holiswiss se réserve le droit de modifier, suspendre ou interrompre tout ou partie des services à tout moment, sans préavis.</p>
        <p>Les liens vers des sites tiers sont fournis à titre informatif. Holiswiss ne peut être tenu responsable du contenu de ces sites.</p>
      </Section>

      <Section title="Droit applicable et for juridique">
        <p>Le présent site est soumis au <strong className="text-white">droit suisse</strong>, notamment à la Loi fédérale contre la concurrence déloyale (LCD) et à la Loi fédérale sur la protection des données (nLPD).</p>
        <p>Tout litige relatif à l'utilisation du site sera soumis à la compétence exclusive des <strong className="text-white">tribunaux de Genève, Suisse</strong>, sauf disposition légale contraire.</p>
      </Section>

      <Section title="Résolution des litiges">
        <p>En cas de litige avec un praticien inscrit sur la plateforme, nous encourageons en premier lieu un règlement à l'amiable. Pour toute réclamation, contactez-nous à <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a>.</p>
        <p>La Commission européenne met à disposition une plateforme de règlement en ligne des litiges (RLL) accessible à <a href="https://ec.europa.eu/consumers/odr" className="text-[#b86ef9] hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
      </Section>

      <p className="mt-10 text-xs text-[#9980b8]">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-CH", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
