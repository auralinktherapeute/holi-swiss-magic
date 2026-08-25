with proposed(slug_fr, slug_de) as (
  values
  ('magnetiseur-suisse-soins-energetiques-magnetisme', 'magnetismus-schweiz-energetische-behandlungen'),
  ('anxiete-generalisee-sophrologie-hypnose-eft-suisse', 'angststoerung-schweiz-sophrologie-hypnose-eft'),
  ('lithotherapie-suisse-cristaux-bien-etre', 'lithotherapie-schweiz-kristalle-wohlbefinden'),
  ('intestin-irritable-naturopathie-phytotherapie-acupuncture-valais', 'phytotherapie-reizdarm-wallis'),
  ('eft-tapping-suisse-liberation-emotionnelle', 'eft-tapping-schweiz-emotionale-befreiung'),
  ('burn-out-5-therapies-alternatives-efficaces', 'burnout-schweiz-fuenf-wirksame-therapien'),
  ('insomnie-chronique-suisse-naturopathie-hypnose-yoga-therapeutique', 'yogatherapie-schlaflosigkeit-naturheilkunde-hypnose'),
  ('meditation-guidee-debutants-suisse', 'gefuehrte-meditation-schweiz-anfaenger'),
  ('prevention-blessures-sportives-suisse-osteopathie-kinesiologie', 'kinesiologie-osteopathie-schweiz-sportverletzungen'),
  ('reiki-distance-suisse-praticiens-certifies', 'fern-reiki-schweiz-zertifizierte-praktizierende'),
  ('insomnie-troubles-sommeil-therapie-holistique-suisse', 'achtsamkeitsmeditation-schlaflosigkeit-schweiz'),
  ('massage-bien-etre-suisse', 'wellness-massage-schweiz-arten-vorteile'),
  ('bienfaits-reiki-guide-complet', 'reiki-vorteile-leitfaden-anfaenger'),
  ('naturopathe-suisse-romande-guide-naturopathie', 'naturheilpraktiker-westschweiz-leitfaden'),
  ('stress-travail-burnout-naturopathie-coaching-holistique-suisse-romande', 'burnout-schweiz-naturheilkunde-coaching'),
  ('reflexologie-faciale-plantaire-suisse-differences-bienfaits', 'gesichts-fussreflexzonenmassage-schweiz-leitfaden'),
  ('kinesiologue-suisse-seance-bienfaits-reeequilibrage', 'kinesiologie-schweiz-begleitung-wohlbefinden'),
  ('coach-holistique-suisse-romande', 'holistisches-coaching-westschweiz'),
  ('shiatsu-massage-japonais-suisse', 'shiatsu-schweiz-japanische-massage'),
  ('reflexologie-plantaire-suisse-guide-bienfaits', 'fussreflexzonenmassage-schweiz-leitfaden'),
  ('osteopathie-holistique-suisse-differences-kine-chiro', 'holistische-osteopathie-schweiz-physio-chiro'),
  ('migraine-traitement-naturel-suisse-acupuncture-osteopathie', 'akupunktur-osteopathie-schweiz-migraene'),
  ('chromotherapie-suisse-guide-complet-luminotherapie', 'chromotherapie-schweiz-lichttherapie-leitfaden'),
  ('magnetisme-chakras-equilibre-energetique-vitalite-suisse', 'magnetismus-chakren-schweiz-energetisches-gleichgewicht'),
  ('menopause-bouffees-chaleur-acupuncture-phytotherapie-suisse', 'akupunktur-menopause-schweiz'),
  ('chromotherapie-luminotherapie-suisse', 'chromotherapie-schweiz-wohlbefinden'),
  ('fibromyalgie-acupuncture-osteopathie-massage-suisse-romande', 'fibromyalgie-westschweiz-akupunktur-osteopathie-massage'),
  ('tdah-enfant-therapie-naturelle-suisse-remboursement', 'adhs-kinder-schweiz-ganzheitliches-coaching'),
  ('endometriose-acupuncture-naturopathie-suisse', 'akupunktur-endometriose-schweiz'),
  ('eczema-atopique-traitement-naturel-suisse-aromatherapie-phytotherapie', 'aromatherapie-atopisches-ekzem-schweiz'),
  ('sciatique-hernie-discale-osteopathie-suisse-romande-geneve-lausanne', 'osteopathie-ischias-bandscheibenvorfall-westschweiz'),
  ('ayurveda-dosha-saisons-suisse-alemanique', 'ayurveda-doshas-jahreszeiten-schweiz')
)
update public.articles a
   set slug_de = p.slug_de,
       updated_at = now()
  from proposed p
 where a.slug = p.slug_fr
   and (a.slug_de is null or length(trim(a.slug_de)) = 0)
   -- garde-fou : jamais deux articles sous la même adresse allemande
   and not exists (
     select 1 from public.articles x
      where x.slug_de = p.slug_de and x.id <> a.id
   )
   and not exists (
     select 1 from public.articles y
      where y.slug = p.slug_de and y.id <> a.id
   );