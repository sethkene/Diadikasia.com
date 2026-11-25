-- Diadikasia Phase 4: Friendships Update Column Guard, Query Indexes & Realtime

-- =====================================================================
-- 1. Prevent Immutable Column Tampering on Friendship Updates
-- =====================================================================

create or replace function public.guard_friendships_update_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify immutable friendship participants or timestamps';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_friendships_update_columns on public.friendships;
create trigger trg_guard_friendships_update_columns
  before update on public.friendships
  for each row execute function public.guard_friendships_update_columns();

-- =====================================================================
-- 2. Friendship Lookup Indexes
-- =====================================================================

create index if not exists idx_friendships_requester_status
  on public.friendships(requester_id, status);

create index if not exists idx_friendships_addressee_status
  on public.friendships(addressee_id, status);

-- =====================================================================
-- 3. Enable Supabase Realtime for Incoming Requests & Friendship Changes
-- =====================================================================

alter table public.friendships replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object or undefined_object then
  null;
end $$;
