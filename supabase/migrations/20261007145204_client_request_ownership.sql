-- ============================================================
-- JHARJEEVAN
-- CLIENT REQUEST OWNERSHIP
-- ============================================================
-- Reuse the client_user_id column and foreign key created by
-- 20261007062004_client_dashboard_foundation.sql.
-- Do not introduce a second ownership column.

-- Associate existing requests with client accounts by email.
-- This runs only when this migration is applied to the database.
UPDATE public.blood_requests AS br
SET client_user_id = cu.id
FROM public.client_users AS cu
WHERE br.client_user_id IS NULL
  AND br.requester_email IS NOT NULL
  AND lower(trim(br.requester_email)) = lower(trim(cu.email));

-- Support efficient client request-history queries.
CREATE INDEX IF NOT EXISTS blood_requests_client_created_idx
ON public.blood_requests (client_user_id, created_at DESC);
