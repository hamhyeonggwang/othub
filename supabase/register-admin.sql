-- Run in the SQL Editor of the verified project AFTER the migrations.
-- Refuse to grant a role until the requested account has a confirmed email.
do $$
declare target uuid;
begin
  select id into target from auth.users
  where lower(email)='h2g0614@gmail.com' and email_confirmed_at is not null;
  if target is null then
    raise exception 'Requested administrator must first have a confirmed Supabase Auth account';
  end if;
  insert into public.othub_admins(user_id) values(target) on conflict do nothing;
end;
$$;
