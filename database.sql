-- QUIZ ARENA — execute este arquivo no Supabase > SQL Editor.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Quiz Arena',
  admin_token_hash text not null,
  question text not null default '',
  status text not null default 'waiting' check (status in ('waiting','open','closed')),
  winner text check (winner in ('a','b') or winner is null),
  score_a integer not null default 0,
  score_b integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;
drop policy if exists "Public can read room state" on public.rooms;
create policy "Public can read room state" on public.rooms
  for select to anon, authenticated using (true);

revoke select on public.rooms from anon, authenticated;
grant select (id, title, question, status, winner, score_a, score_b, created_at, updated_at)
  on public.rooms to anon, authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.create_room(p_title text, p_admin_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if length(coalesce(p_admin_token,'')) < 32 then
    raise exception 'Token administrativo inválido.';
  end if;
  insert into public.rooms(title, admin_token_hash)
  values (left(coalesce(nullif(trim(p_title),''),'Quiz Arena'),60),
          encode(extensions.digest(p_admin_token, 'sha256'),'hex'))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_action(
  p_room_id uuid,
  p_admin_token text,
  p_action text,
  p_question text default null,
  p_team text default null,
  p_delta integer default 0
)
returns public.rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.rooms;
begin
  select * into r from public.rooms
  where id = p_room_id
    and admin_token_hash = encode(extensions.digest(coalesce(p_admin_token,''), 'sha256'),'hex')
  for update;
  if not found then raise exception 'Sala não encontrada ou token administrativo inválido.'; end if;

  if p_action = 'open' then
    update public.rooms set question = left(coalesce(p_question,''),2000),
      winner = null, status = 'open', updated_at = now()
    where id = p_room_id returning * into r;
  elsif p_action = 'close' then
    update public.rooms set status = 'closed', updated_at = now()
    where id = p_room_id returning * into r;
  elsif p_action = 'reset' then
    update public.rooms set status = 'waiting', winner = null, question = '',
      updated_at = now() where id = p_room_id returning * into r;
  elsif p_action = 'score' then
    if p_team = 'a' then
      update public.rooms set score_a = greatest(0, score_a + greatest(-10,least(10,p_delta))), updated_at = now()
      where id = p_room_id returning * into r;
    elsif p_team = 'b' then
      update public.rooms set score_b = greatest(0, score_b + greatest(-10,least(10,p_delta))), updated_at = now()
      where id = p_room_id returning * into r;
    else raise exception 'Equipe inválida.';
    end if;
  else
    raise exception 'Ação administrativa inválida.';
  end if;
  return r;
end;
$$;

create or replace function public.press_buzzer(p_room_id uuid, p_team text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare r public.rooms;
begin
  if p_team not in ('a','b') then raise exception 'Equipe inválida.'; end if;
  update public.rooms
    set winner = p_team, status = 'closed', updated_at = now()
    where id = p_room_id and status = 'open' and winner is null
    returning * into r;
  if not found then
    select * into r from public.rooms where id = p_room_id;
    if not found then raise exception 'Sala não encontrada.'; end if;
  end if;
  return r;
end;
$$;

revoke all on function public.create_room(text,text) from public;
revoke all on function public.admin_action(uuid,text,text,text,text,integer) from public;
revoke all on function public.press_buzzer(uuid,text) from public;
grant execute on function public.create_room(text,text) to anon, authenticated;
grant execute on function public.admin_action(uuid,text,text,text,text,integer) to anon, authenticated;
grant execute on function public.press_buzzer(uuid,text) to anon, authenticated;

-- Habilite Realtime para a tabela rooms:
-- Supabase Dashboard > Database > Publications > supabase_realtime > marque "rooms".
