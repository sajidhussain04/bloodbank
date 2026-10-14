ALTER TABLE public.admins
ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;
