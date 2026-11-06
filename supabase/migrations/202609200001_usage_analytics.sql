-- Additive migration: independent of the existing othub_likes/comments schema.
begin;
create table if not exists public.othub_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.othub_admins enable row level security;
revoke all on public.othub_admins from public, anon, authenticated;
grant all on public.othub_admins to service_role;

create table if not exists public.othub_usage_events (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  session_id uuid not null,
  event text not null check (event in ('page_view','content_open','search','navigation','client_error')),
  route text not null check (route in ('home','explore','webapps','videos','siteinfo','bookmark','recent','updates','profile','privacy','search')),
  content_id text check (content_id ~ '^[a-z][0-9]{1,4}$'),
  value integer not null default 0 check (value between 0 and 60000),
  device text not null check (device in ('desktop','tablet','mobile')),
  source text not null check (source in ('direct','search','social','referral')),
  version text not null check (version ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  created_at timestamptz not null default now()
);
create index if not exists othub_usage_created_idx on public.othub_usage_events(created_at);
create index if not exists othub_usage_session_idx on public.othub_usage_events(session_id,created_at);
alter table public.othub_usage_events enable row level security;
revoke all on public.othub_usage_events from public, anon, authenticated;
revoke all on sequence public.othub_usage_events_seq_seq from public, anon, authenticated;
grant all on public.othub_usage_events to service_role;
grant usage, select on sequence public.othub_usage_events_seq_seq to service_role;

create or replace function public.othub_record_events(p_events jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer; sid uuid;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'invalid batch' using errcode='22023';
  end if;
  n := jsonb_array_length(p_events);
  if n < 1 or n > 20 or octet_length(p_events::text) > 16000 then
    raise exception 'invalid batch size' using errcode='22023';
  end if;
  sid := (p_events->0->>'session_id')::uuid;
  if sid is null or exists(select 1 from jsonb_array_elements(p_events) e where (e->>'session_id')::uuid is distinct from sid) then
    raise exception 'invalid session' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_events) e where jsonb_typeof(e) <> 'object') then
    raise exception 'invalid event' using errcode='22023';
  end if;
  -- Do not accept arbitrary properties (search text, email, clinical data, etc.).
  if exists(select 1 from jsonb_array_elements(p_events) e, lateral jsonb_object_keys(e) k
      where k not in ('id','session_id','event','route','content_id','value','device','source','version')) then
    raise exception 'unexpected fields' using errcode='22023';
  end if;
  -- Serialize the small intake transaction to make quotas safe under concurrency.
  -- Global cap bounds anonymous abuse; enable WAF rate limiting before public intake.
  perform pg_catalog.pg_advisory_xact_lock(682041921);
  if (select count(*) from public.othub_usage_events where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') + n > 100000
     or (select count(*) from public.othub_usage_events where session_id=sid and created_at>now()-interval '1 hour') + n > 500 then
    raise exception 'intake quota exceeded' using errcode='54000';
  end if;
  insert into public.othub_usage_events(id,session_id,event,route,content_id,value,device,source,version)
    select r.id,r.session_id,r.event,r.route,r.content_id,r.value,r.device,r.source,r.version
    from jsonb_to_recordset(p_events) as r(id uuid, session_id uuid, event text, route text, content_id text, value integer, device text, source text, version text)
    on conflict(id) do nothing;
end;
$$;
revoke all on function public.othub_record_events(jsonb) from public;
grant execute on function public.othub_record_events(jsonb) to anon, authenticated;

create or replace function public.othub_admin_metrics(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; since timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.othub_admins where user_id=auth.uid()) then
    raise exception 'admin access required' using errcode='42501';
  end if;
  if p_days is null or p_days not in (7,30,90) then
    raise exception 'invalid period' using errcode='22023';
  end if;
  since := (date_trunc('day',now() at time zone 'UTC') - (p_days-1)*interval '1 day') at time zone 'UTC';
  with e as materialized (select * from public.othub_usage_events where created_at>=since),
  content as (select content_id as name,count(*) as count from e where event='content_open' and content_id is not null group by content_id order by count(*) desc limit 15),
  routes as (select route as name,count(*) as count from e where event='page_view' group by route order by count(*) desc),
  devices as (select device as name,count(distinct session_id) as count from e group by device order by count(*) desc),
  first_events as (select distinct on(session_id) session_id,source from e order by session_id,seq),
  sources as (select source as name,count(*) as count from first_events group by source order by count(*) desc),
  visits as (select route as "to",lag(route) over(partition by session_id order by seq) as "from" from e where event='page_view'),
  flows as (select "from","to",count(*) as count from visits where "from" is not null and "from"<>"to" group by "from","to" order by count(*) desc limit 10),
  dates as (select generate_series(0,p_days-1) as offset_days),
  daily as (select to_char((since at time zone 'UTC')::date+offset_days,'YYYY-MM-DD') as date,
      (select count(distinct session_id) from e where (created_at at time zone 'UTC')::date=(since at time zone 'UTC')::date+offset_days) as count
      from dates order by offset_days)
  select jsonb_build_object(
    'events',count(*),'sessions',count(distinct session_id),
    'page_views',count(*) filter(where event='page_view'),
    'content_opens',count(*) filter(where event='content_open'),
    'searches',count(*) filter(where event='search'),
    'empty_searches',count(*) filter(where event='search' and value=0),
    'errors',count(*) filter(where event='client_error'),
    'nav_p75',percentile_cont(0.75) within group(order by value) filter(where event='navigation'),
    'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb),
    'content',coalesce((select jsonb_agg(content) from content),'[]'::jsonb),
    'routes',coalesce((select jsonb_agg(routes) from routes),'[]'::jsonb),
    'devices',coalesce((select jsonb_agg(devices) from devices),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(sources) from sources),'[]'::jsonb),
    'flows',coalesce((select jsonb_agg(flows) from flows),'[]'::jsonb)
  ) into result from e;
  return result;
end;
$$;
revoke all on function public.othub_admin_metrics(integer) from public,anon;
grant execute on function public.othub_admin_metrics(integer) to authenticated;

create or replace function public.othub_prune_usage_events()
returns bigint language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin
  delete from public.othub_usage_events where created_at < now()-interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.othub_prune_usage_events() from public,anon,authenticated;
grant execute on function public.othub_prune_usage_events() to service_role;
commit;
