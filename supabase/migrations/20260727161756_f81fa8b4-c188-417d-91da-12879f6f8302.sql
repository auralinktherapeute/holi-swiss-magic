alter table public.specialties add column if not exists slug_de text;

create unique index if not exists specialties_slug_de_key
  on public.specialties(slug_de) where slug_de is not null;

update public.specialties as s set slug_de = v.slug_de
from (values
  ('accompagnement-psy', 'psychologische-begleitung'),
  ('acupuncture',        'akupunktur'),
  ('art-therapie',       'kunsttherapie'),
  ('breathwork',         'atemarbeit'),
  ('coaching-de-vie',    'life-coaching'),
  ('fleurs-de-bach',     'bachblueten'),
  ('magnetisme',         'magnetismus'),
  ('massage-bien-etre',  'wellness-massage'),
  ('massotherapie',      'massagetherapie'),
  ('medecine-chinoise',  'chinesische-medizin'),
  ('micronutrition',     'mikronaehrstofftherapie'),
  ('naturopathie',       'naturheilkunde'),
  ('nutrition',          'ernaehrungsberatung'),
  ('radiesthesie',       'radiaesthesie'),
  ('reflexologie',       'reflexzonentherapie'),
  ('relaxation',         'entspannung'),
  ('sonotherapie',       'klangtherapie')
) as v(slug, slug_de)
where s.slug = v.slug
  and s.slug_de is null;

notify pgrst, 'reload schema';