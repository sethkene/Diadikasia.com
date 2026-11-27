-- Diadikasia Feature 1: Administrative Account Privacy
-- Enforces dynamic database-level invisibility for 'admin' and 'sub_admin' accounts
-- across public directories, friendships, friend requests, and chat messaging.

-- =====================================================================
-- 1. Exclude Admin & Sub-Admin Accounts from Public Directory RPC
-- =====================================================================

create or replace function public.get_public_directory()
returns table (
  id uuid,
  name text,
  role text,
  qualifications text,
  youtube_handle text,
  approved_at text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p.id,
    p.name,
    p.role,
    p.qualifications,
    p.youtube_handle,
    p.approved_at
  from public.profiles p
  where p.role in ('learner', 'instructor')
  order by p.created_at asc;
$$;

revoke all on function public.get_public_directory() from public, anon;
grant execute on function public.get_public_directory() to authenticated;

-- =====================================================================
-- 2. Private Non-Exposed Helper for Administrative Participant Detection
-- =====================================================================
-- Stored in a dedicated `private` schema (not exposed via PostgREST RPCs) so
-- authenticated clients cannot call it directly to probe arbitrary UUID roles.
-- Also rejects/masks calls where auth.uid() is not one of the two participants.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_admin_friendship_participant(
  p_requester_id uuid,
  p_addressee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is null
    or (auth.uid() <> p_requester_id and auth.uid() <> p_addressee_id)
    or exists (
      select 1
      from public.profiles p
      where p.id in (p_requester_id, p_addressee_id)
        and p.role in ('admin', 'sub_admin')
    );
$$;

revoke all on function private.has_admin_friendship_participant(uuid, uuid) from public, anon;
grant execute on function private.has_admin_friendship_participant(uuid, uuid) to authenticated;

-- Drop any public-schema helper if present from an earlier draft
drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_update_addressee" on public.friendships;
drop policy if exists "friendships_delete_own" on public.friendships;
drop policy if exists "friendships_own_all" on public.friendships;

drop policy if exists "chat_own_select" on public.chat_messages;
drop policy if exists "chat_own_insert" on public.chat_messages;
drop policy if exists "chat_own_update_read" on public.chat_messages;

drop function if exists public.has_admin_friendship_participant(uuid, uuid);

-- =====================================================================
-- 3. Harden public.friendships Grants, RLS Policies & Insert Trigger
-- =====================================================================
-- Existing friendship rows are intentionally preserved so that if an account
-- is later demoted back to 'learner' or 'instructor', visibility restores
-- dynamically without data loss.

revoke all on table public.friendships from public, anon;
grant select, insert, update, delete on table public.friendships to authenticated;

create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (
    (requester_id = auth.uid() or addressee_id = auth.uid())
    and not private.has_admin_friendship_participant(requester_id, addressee_id)
  );

create policy "friendships_insert_requester"
  on public.friendships for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and requester_id <> addressee_id
    and status = 'pending'
    and not private.has_admin_friendship_participant(requester_id, addressee_id)
  );

create policy "friendships_update_addressee"
  on public.friendships for update
  to authenticated
  using (
    addressee_id = auth.uid()
    and status = 'pending'
    and not private.has_admin_friendship_participant(requester_id, addressee_id)
  )
  with check (
    addressee_id = auth.uid()
    and status in ('accepted', 'declined')
    and not private.has_admin_friendship_participant(requester_id, addressee_id)
  );

create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (
    (requester_id = auth.uid() or addressee_id = auth.uid())
    and not private.has_admin_friendship_participant(requester_id, addressee_id)
  );

-- SECURITY INVOKER so `current_user` accurately identifies the invoking role
-- ('authenticated'/'anon' vs trusted DB maintenance like 'postgres'/'service_role').
-- Role inspection is delegated to `private.has_admin_friendship_participant()`.
create or replace function public.guard_friendships_insert()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null or new.requester_id is distinct from auth.uid() then
    raise exception 'Only the authenticated requester may initiate a friend request';
  end if;

  if new.addressee_id is null or new.requester_id = new.addressee_id then
    raise exception 'Invalid friend request recipient';
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'New friend requests must start in pending status';
  end if;

  if private.has_admin_friendship_participant(new.requester_id, new.addressee_id) then
    raise exception 'Unable to send friend request';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_friendships_insert on public.friendships;
create trigger trg_guard_friendships_insert
  before insert on public.friendships
  for each row execute function public.guard_friendships_insert();

-- =====================================================================
-- 4. Replace All public.chat_messages Policies to Exclude Admin/Sub-Admin
-- =====================================================================

create policy "chat_own_select"
  on public.chat_messages for select
  to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and not private.has_admin_friendship_participant(sender_id, recipient_id)
  );

create policy "chat_own_insert"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and sender_id <> recipient_id
    and read_at is null
    and (
      (msg_type = 'invite' and invite_status = 'pending')
      or (msg_type <> 'invite' and invite_status is null)
    )
    and not private.has_admin_friendship_participant(sender_id, recipient_id)
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recipient_id)
        )
    )
  );

create policy "chat_own_update_read"
  on public.chat_messages for update
  to authenticated
  using (
    recipient_id = auth.uid()
    and not private.has_admin_friendship_participant(sender_id, recipient_id)
  )
  with check (
    recipient_id = auth.uid()
    and (invite_status is null or invite_status in ('pending', 'accepted'))
    and not private.has_admin_friendship_participant(sender_id, recipient_id)
  );
