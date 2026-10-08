-- ============================================================
-- JHARJEEVAN
-- CLIENT REQUEST OWNERSHIP
-- ============================================================

ALTER TABLE public.blood_requests
ADD COLUMN IF NOT EXISTS client_id uuid;

-- Link requests to authenticated client accounts.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'blood_requests_client_id_fkey'
    ) THEN
        ALTER TABLE public.blood_requests
        ADD CONSTRAINT blood_requests_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES public.client_users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blood_requests_client_id
ON public.blood_requests(client_id);

-- Backfill existing requests where the requester email
-- matches an existing client account.
UPDATE public.blood_requests br
SET client_id = cu.id
FROM public.client_users cu
WHERE br.client_id IS NULL
  AND lower(trim(br.requester_email)) = lower(trim(cu.email));

-- Useful index for the client history page.
CREATE INDEX IF NOT EXISTS idx_blood_requests_client_created
ON public.blood_requests(client_id, created_at DESC);
