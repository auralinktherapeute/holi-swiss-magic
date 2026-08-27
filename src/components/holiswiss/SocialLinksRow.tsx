import { Facebook, Instagram, Linkedin } from "lucide-react";
import { publicSocialLinks, SOCIAL_META, type SocialNetwork } from "@/lib/social-links";

const ICONS: Record<SocialNetwork, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

/**
 * Icônes réseaux sociaux du praticien — rendues uniquement pour les liens
 * valides ET marqués visibles. Aucun placeholder, aucun lien mort.
 */
export function SocialLinksRow({
  socialLinks,
  name,
  className = "",
}: {
  socialLinks: unknown;
  name?: string;
  className?: string;
}) {
  const links = publicSocialLinks(socialLinks);
  if (links.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map(({ network, url }) => {
        const Icon = ICONS[network];
        const label = name
          ? `${SOCIAL_META[network].label} de ${name} (nouvel onglet)`
          : `${SOCIAL_META[network].label} (nouvel onglet)`;
        return (
          <li key={network}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={label}
              title={SOCIAL_META[network].label}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.12)] text-[#b86ef9] transition-colors duration-200 hover:bg-[rgba(184,110,249,0.25)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1035]"
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
