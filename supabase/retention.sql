-- Run after enabling pg_cron in the project's Extensions settings.
-- Separate from the additive migration so missing pg_cron cannot break deployment.
select cron.schedule('othub-usage-retention', '20 3 * * *',
  $$select public.othub_prune_usage_events();$$);
