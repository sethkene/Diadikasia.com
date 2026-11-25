-- Diadikasia Phase 5: Chat & Messaging RLS Hardening, Update Guard, Unread Index & Realtime

-- =====================================================================
-- 1. Least-Privilege Table Grants on public.chat_messages
-- =====================================================================

revoke all on table public.chat_messages from anon;
revoke all on table public.chat_messages from authenticated;
grant select, insert, update on table public.chat_messages to authenticated;

-- =====================================================================
-- 2. Enforce Confirmed Friendship, Sender Identity & No Self-Messaging on Insert
-- =====================================================================

drop policy if exists "chat_own_insert" on public.chat_messages;
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

-- Preserve participant-only SELECT and recipient-only UPDATE policies
drop policy if exists "chat_own_select" on public.chat_messages;
create policy "chat_own_select"
  on public.chat_messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "chat_own_update_read" on public.chat_messages;
create policy "chat_own_update_read"
  on public.chat_messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and (invite_status is null or invite_status in ('pending', 'accepted'))
  );

-- =====================================================================
-- 3. Prevent Modification of Message Content, Participants, Type, Links & Timestamps
-- =====================================================================

create or replace function public.guard_chat_message_update_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.recipient_id then
    raise exception 'Only the message recipient can update read or invitation status';
  end if;

  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.msg_type is distinct from old.msg_type
     or new.body is distinct from old.body
     or new.procedure_id is distinct from old.procedure_id
     or new.reel_id is distinct from old.reel_id
     or new.scheduled_for is distinct from old.scheduled_for
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify immutable chat message fields';
  end if;

  if new.invite_status is distinct from old.invite_status then
    if old.msg_type is distinct from 'invite'
       or old.invite_status is distinct from 'pending'
       or new.invite_status is distinct from 'accepted' then
      raise exception 'Invalid invitation status transition';
    end if;
  end if;

  if new.read_at is not null and old.read_at is null then
    new.read_at := now();
  elsif new.read_at is distinct from old.read_at and old.read_at is not null then
    new.read_at := old.read_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_chat_message_update_columns on public.chat_messages;
create trigger trg_guard_chat_message_update_columns
  before update on public.chat_messages
  for each row execute function public.guard_chat_message_update_columns();

-- =====================================================================
-- 4. Unread Message Lookup Index
-- =====================================================================

create index if not exists idx_chat_messages_unread
  on public.chat_messages(recipient_id, sender_id)
  where read_at is null;

-- =====================================================================
-- 5. Enable Supabase Realtime for Chat Messages & Read-Status Sync
-- =====================================================================

alter table public.chat_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
end $$;
