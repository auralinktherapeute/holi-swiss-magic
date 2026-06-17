-- 1) Hide sensitive therapist columns from anonymous visitors.
-- Authenticated users (owner via dashboard, admins via service role) keep full access.
REVOKE SELECT (phone, email, booking_note) ON public.therapists FROM anon;

-- 2) Remove the overly-permissive public read policy on event-images.
-- The bucket is private; signed URLs (generated server-side) continue to work
-- because they bypass RLS checks on storage.objects.
DROP POLICY IF EXISTS "Public read event images" ON storage.objects;