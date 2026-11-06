-- Apply AFTER 001; browser writes now go through the Vercel server function.
begin;
revoke execute on function public.othub_record_events(jsonb) from anon,authenticated,public;
grant execute on function public.othub_record_events(jsonb) to service_role;

create table if not exists public.othub_intake_buckets (
  bucket text not null check(bucket ~ '^[0-9a-f]{64}$'),
  minute timestamptz not null,
  requests integer not null default 1,
  events integer not null,
  primary key(bucket,minute)
);
alter table public.othub_intake_buckets enable row level security;
revoke all on public.othub_intake_buckets from public,anon,authenticated;
grant all on public.othub_intake_buckets to service_role;

create or replace function public.othub_ingest_events(p_events jsonb,p_bucket text)
returns void language plpgsql security definer set search_path='' as $$
declare counts public.othub_intake_buckets; n integer;
begin
  if p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$' or p_events is null or jsonb_typeof(p_events)<>'array' then
    raise exception 'invalid batch' using errcode='22023';
  end if;
  n:=jsonb_array_length(p_events);
  if n<1 or n>20 then raise exception 'invalid batch' using errcode='22023'; end if;
  insert into public.othub_intake_buckets(bucket,minute,requests,events)
  values(p_bucket,date_trunc('minute',now()),1,n)
  on conflict(bucket,minute) do update set
    requests=public.othub_intake_buckets.requests+1,
    events=public.othub_intake_buckets.events+excluded.events
  returning * into counts;
  if counts.requests>60 or counts.events>600 then
    raise exception 'intake quota exceeded' using errcode='54000';
  end if;
  perform public.othub_record_events(p_events);
end;
$$;
revoke all on function public.othub_ingest_events(jsonb,text) from public,anon,authenticated;
grant execute on function public.othub_ingest_events(jsonb,text) to service_role;

-- Reuse the existing scheduled job; intake buckets are kept for at most 48 hours
-- plus the delay until the daily cleanup runs (not used as analytics identities).
create or replace function public.othub_prune_usage_events()
returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
  delete from public.othub_usage_events where created_at<now()-interval '90 days';
  get diagnostics removed=row_count;
  delete from public.othub_intake_buckets where minute<now()-interval '48 hours';
  return removed;
end;
$$;
revoke all on function public.othub_prune_usage_events() from public,anon,authenticated;
grant execute on function public.othub_prune_usage_events() to service_role;
commit;
