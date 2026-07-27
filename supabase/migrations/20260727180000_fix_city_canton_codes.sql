-- Correction de saisie : un code canton s'est retrouvé dans le champ `city`.
-- Conséquence SEO : les pages spécialité × ville sont générées avec un slug
-- inutilisable — /specialites/hypnose/ge au lieu de /specialites/hypnose/geneve.
-- Personne ne recherche « hypnose ge ».
--
-- Les deux fiches ci-dessous sont corrigées avec certitude : leurs coordonnées
-- GPS tombent dans la ville de Genève.
--   · Olivier Larue   → 46.2044, 6.1432  (centre de Genève)
--   · Émilie Chardon  → 46.2257, 6.1439  (Genève, secteur Petit-Saconnex)
--
-- Idempotent : la clause `where city = 'GE'` empêche d'écraser une correction
-- manuelle ultérieure si la migration est rejouée.

update public.therapists
   set city = 'Genève',
       canton = coalesce(nullif(canton, ''), 'GE')
 where slug = 'olivier-larue-efbaa6'
   and city = 'GE';

update public.therapists
   set city = 'Genève'
 where slug = 'emilie-chardon-8df145'
   and city = 'GE';

-- NON TRAITÉ VOLONTAIREMENT — premkumar DAYALAN (premkumar-dayalan-5baedf)
-- city = 'FR', sans canton, sans adresse, sans code postal, sans coordonnées.
-- « FR » est ambigu : canton de Fribourg, pays France, ou simplement la langue.
-- Aucune donnée ne permet de trancher : à confirmer auprès du praticien plutôt
-- que de deviner et de publier une localisation fausse.
