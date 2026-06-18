-- 1. Restrict reviews UPDATE so users cannot escalate status/admin fields
DROP POLICY IF EXISTS "Users update own reviews" ON public.reviews;

CREATE POLICY "Users update own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
);

-- 2. Restrict Realtime channel subscriptions on realtime.messages
-- Only authenticated users can subscribe, and only to channels containing their own user id,
-- or to admin-only broadcast channels via the has_role function.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read own realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users read own realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Restrict to channels that explicitly include the user's uid in the topic,
  -- or to admin-only topics for admins.
  (realtime.topic() LIKE 'user:' || auth.uid()::text || ':%')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users send own realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users send own realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'user:' || auth.uid()::text || ':%')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);