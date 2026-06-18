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
        <h1 className="text-3xl font-bold text-white">Mentions légales / Impressum</h1>
        <p className="mt-2 text-sm text-[#b86ef9]">Conformément à la LCD suisse</p>
      </div>

      <Section title="Présentation">
        <p>
          Holiswiss est une plateforme dédiée à la mise en relation entre personnes recherchant un thérapeute en Suisse et praticiens souhaitant développer leur visibilité en ligne.
        </p>
        <p>
          Les présentes mentions légales ont pour objet de vous informer de manière claire sur l'identité de l'exploitant du site et sur les principales règles applicables à son utilisation.
        </p>
      </Section>

      <Section title="Éditeur du site">
        <p><strong className="text-white">Nom commercial :</strong> Holiswiss</p>
        <p><strong className="text-white">Exploitant :</strong> Gérald Henry</p>
        <p><strong className="text-white">Statut juridique :</strong> Entrepreneur individuel (micro-entreprise) — France</p>
        <p><strong className="text-white">Adresse :</strong> Impasse Nussbaum, 68300 Saint-Louis, Alsace, France</p>
        <p><strong className="text-white">E-mail :</strong>{" "}
          <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a>
        </p>
        <p><strong className="text-white">Numéro SIREN :</strong> 103 987 061</p>
        <p><strong className="text-white">TVA :</strong> TVA non applicable, art. 293 B du CGI</p>
      </Section>

      <Section title="Hébergement et prestataires techniques">
        <p>
          Le site Holiswiss s'appuie sur des prestataires techniques sélectionnés pour la qualité et la sécurité de leurs services.
        </p>
        <p><strong className="text-white">Base de données et infrastructure :</strong> Supabase, serveurs situés en Europe (région UK)</p>
        <p><strong className="text-white">Paiements :</strong> Stripe, Inc., 510 Townsend Street, San Francisco, CA 94103, États-Unis</p>
      </Section>

      <Section title="Objet de la plateforme">
        <p>
          Holiswiss propose un service de visibilité et de mise en relation entre praticiens et visiteurs. À ce titre, les thérapeutes référencés sur la plateforme exercent leur activité sous leur propre responsabilité.
        </p>
        <p>
          Holiswiss n'intervient pas en tant que cabinet médical, établissement de soins ou garant des prestations proposées par les praticiens inscrits.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Les contenus présents sur le site Holiswiss, notamment les textes, éléments visuels, logos, marques, graphismes, icônes, photographies et éléments techniques, sont protégés par les règles applicables en matière de propriété intellectuelle.
        </p>
        <p>
          Sauf mention contraire, ils sont la propriété de Holiswiss ou font l'objet d'un droit d'utilisation. Toute reproduction, diffusion, adaptation ou exploitation, totale ou partielle, sans autorisation préalable écrite, est interdite.
        </p>
        <p>© {new Date().getFullYear()} Holiswiss — Tous droits réservés.</p>
      </Section>

      <Section title="Informations et responsabilité">
        <p>
          Les contenus publiés sur Holiswiss sont fournis à titre informatif. Ils ne constituent ni un avis médical, ni un diagnostic, ni une promesse de résultat thérapeutique.
        </p>
        <p>
          Chaque visiteur reste libre de ses choix et invité à vérifier l'adéquation des prestations proposées à sa situation personnelle.
        </p>
        <p>
          Holiswiss s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur le site, sans pouvoir en garantir l'exhaustivité ou l'absence d'erreur à tout moment.
        </p>
        <p>
          Les liens vers des sites tiers sont proposés à titre informatif. Holiswiss ne saurait être tenu responsable du contenu ou du fonctionnement de ces sites externes.
        </p>
      </Section>

      <Section title="Contact et réclamations">
        <p>
          Pour toute question, demande d'information ou réclamation, vous pouvez nous écrire à l'adresse suivante :{" "}
          <a href="mailto:contact@holiswiss.ch" className="text-[#b86ef9] hover:underline">contact@holiswiss.ch</a>
        </p>
        <p>Nous nous efforçons de répondre dans les meilleurs délais.</p>
      </Section>

      <Section title="Droit applicable">
        <p>
          Le site est exploité depuis la France et s'adresse notamment aux utilisateurs situés en Suisse. Les règles impératives applicables en matière de commerce électronique, de protection des données et de droit de la consommation demeurent réservées.
        </p>
      </Section>

      <p className="mt-10 text-xs text-[#9980b8]">
        Dernière mise à jour : 18 juin 2026
      </p>
    </div>
  );
}
