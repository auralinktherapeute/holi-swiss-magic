
CREATE TABLE public.seo_audit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_date DATE NOT NULL UNIQUE,
  seo_score INTEGER NOT NULL CHECK (seo_score BETWEEN 0 AND 100),
  geo_score INTEGER NOT NULL CHECK (geo_score BETWEEN 0 AND 100),
  global_score INTEGER NOT NULL CHECK (global_score BETWEEN 0 AND 100),
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audit_history TO authenticated;
GRANT ALL ON public.seo_audit_history TO service_role;

ALTER TABLE public.seo_audit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read seo_audit_history"
  ON public.seo_audit_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert seo_audit_history"
  ON public.seo_audit_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seo_audit_history"
  ON public.seo_audit_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_seo_audit_history_date ON public.seo_audit_history (audit_date DESC);

-- Seed 90 days of synthetic but realistic history (slow upward trend with noise).
INSERT INTO public.seo_audit_history (audit_date, seo_score, geo_score, global_score, summary)
SELECT
  d::date AS audit_date,
  GREATEST(40, LEAST(95, 60 + ((CURRENT_DATE - d::date) * -0.18)::int + (((random() - 0.5) * 8))::int))  AS seo_score,
  GREATEST(35, LEAST(92, 52 + ((CURRENT_DATE - d::date) * -0.22)::int + (((random() - 0.5) * 9))::int))  AS geo_score,
  GREATEST(38, LEAST(93, 56 + ((CURRENT_DATE - d::date) * -0.20)::int + (((random() - 0.5) * 7))::int))  AS global_score,
  jsonb_build_object('source', 'seed')
FROM generate_series(CURRENT_DATE - INTERVAL '89 days', CURRENT_DATE, INTERVAL '1 day') AS d
ON CONFLICT (audit_date) DO NOTHING;
