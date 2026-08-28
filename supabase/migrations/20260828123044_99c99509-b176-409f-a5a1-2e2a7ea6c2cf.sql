-- Le thérapeute doit pouvoir écrire ses propres colonnes « FAQ » et « formateur ».
-- Elles avaient été omises des GRANT colonnes lors du durcissement de therapists :
-- l'interrupteur « Afficher la FAQ » et l'enregistrement du profil échouaient.
GRANT UPDATE (faq_enabled, is_trainer, trainer_subjects, trainer_institution, trainer_since)
  ON public.therapists TO authenticated;
