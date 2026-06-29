export type TemplateId =
  | "invitation"
  | "welcome"
  | "profile_live"
  | "reminder_complete"
  | "official_launch"
  | "custom";

export const TEMPLATE_OPTIONS: { id: TemplateId; label: string; needsCustom?: boolean }[] = [
  { id: "invitation", label: "Invitation à créer votre profil" },
  { id: "welcome", label: "Bienvenue sur HoliSwiss" },
  { id: "profile_live", label: "Votre profil est en ligne" },
  { id: "reminder_complete", label: "Rappel — Complétez votre profil" },
  { id: "official_launch", label: "Lancement officiel HoliSwiss" },
  { id: "custom", label: "Message personnalisé", needsCustom: true },
];
