-- OT Hub — 좋아요(비회원·회원) / 댓글(회원만)
-- Supabase SQL Editor에서 프로젝트에 붙여 실행하세요.

-- ── 좋아요 (직접 INSERT/DELETE 금지, RPC만 사용) ─────────────────
create table if not exists public.likes (
  content_id text not null,
  liker_id text not null,
  created_at timestamptz not null default now(),
  primary key (content_id, liker_id),
  constraint likes_liker_format check (liker_id like 'u:%' or liker_id like 'a:%')
);

create index if not exists likes_content_idx on public.likes (content_id);

alter table public.likes enable row level security;

drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes for select using (true);

drop policy if exists "likes_no_insert" on public.likes;
create policy "likes_no_insert" on public.likes for insert with check (false);

drop policy if exists "likes_no_update" on public.likes;
create policy "likes_no_update" on public.likes for update using (false);

drop policy if exists "likes_no_delete" on public.likes;
create policy "likes_no_delete" on public.likes for delete using (false);

create or replace function public.othub_toggle_like(p_content_id text, p_anon_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lid text;
begin
  if p_content_id is null or length(p_content_id) < 1 or length(p_content_id) > 128 then
    raise exception 'invalid content id';
  end if;

  if auth.uid() is not null then
    lid := 'u:' || auth.uid()::text;
  else
    if p_anon_id is null or length(trim(p_anon_id)) < 8 or length(p_anon_id) > 200 then
      raise exception 'invalid anon id';
    end if;
    lid := 'a:' || trim(p_anon_id);
  end if;

  delete from public.likes where content_id = p_content_id and liker_id = lid;
  if found then
    return jsonb_build_object('liked', false);
  end if;

  insert into public.likes (content_id, liker_id) values (p_content_id, lid);
  return jsonb_build_object('liked', true);
exception
  when unique_violation then
    return jsonb_build_object('liked', true);
end;
$$;

grant execute on function public.othub_toggle_like(text, text) to anon, authenticated;

-- ── 댓글 (로그인 사용자만 작성) ─────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_len check (char_length(body) between 1 and 2000)
);

create index if not exists comments_content_created_idx
  on public.comments (content_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments for select using (true);

drop policy if exists "comments_insert_self" on public.comments;
create policy "comments_insert_self" on public.comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "comments_update_self" on public.comments;
create policy "comments_update_self" on public.comments
  for update using (auth.uid() = user_id);

drop policy if exists "comments_delete_self" on public.comments;
create policy "comments_delete_self" on public.comments
  for delete using (auth.uid() = user_id);
