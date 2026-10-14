SELECT
    recipient_id,
    type,
    title,
    COUNT(*) AS total,
    MIN(created_at) AS first_created,
    MAX(created_at) AS last_created
FROM public.notifications
WHERE recipient_type = 'client'
  AND type = 'profile_updated'
GROUP BY recipient_id, type, title
ORDER BY total DESC;
