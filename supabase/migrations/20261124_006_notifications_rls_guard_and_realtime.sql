-- Diadikasia Phase 6: Notifications Hardening, Backfill, Chat Invite/Reminder Triggers, Update Guard & Realtime

-- =====================================================================
-- 1. Additive Schema Updates & Indexes on public.notifications
-- =====================================================================

alter table public.notifications
  add column if not exists read_at timestamptz;

alter table public.notifications
  add column if not exists chat_message_id bigint references public.chat_messages(id) on delete cascade;

create unique index if not exists idx_notifications_chat_message_unique
  on public.notifications(chat_message_id)
  where chat_message_id is not null;

create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;

-- =====================================================================
-- 2. Idempotent Backfill for Existing Chat Invites & Reminders
-- =====================================================================

insert into public.notifications (
  recipient_id,
  actor_id,
  actor_name,
  type,
  procedure_id,
  scheduled_for,
  status,
  read_at,
  chat_message_id,
  created_at
)
select
  m.recipient_id,
  m.sender_id,
  coalesce(
    nullif(trim(p.name), ''),
    nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
    'Diadikasia Member'
  ) as actor_name,
  m.msg_type,
  m.procedure_id,
  case when m.msg_type = 'invite' then m.scheduled_for else null end,
  case
    when m.msg_type = 'invite' and m.invite_status = 'accepted' then 'accepted'
    else 'pending'
  end as status,
  case
    when m.msg_type = 'invite' and m.invite_status = 'accepted'
      then coalesce(m.read_at, m.created_at)
    else m.read_at
  end as read_at,
  m.id,
  m.created_at
from public.chat_messages m
left join public.profiles p on p.id = m.sender_id
where m.msg_type in ('invite', 'remind')
  and m.sender_id is not null
  and m.recipient_id is not null
  and m.sender_id <> m.recipient_id
on conflict (chat_message_id) where chat_message_id is not null do nothing;

-- =====================================================================
-- 3. Least-Privilege Table Grants & RLS Policy Hardening
-- =====================================================================

revoke all on table public.notifications from public;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, update on table public.notifications to authenticated;

drop policy if exists "notifications_insert_actor" on public.notifications;

drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and status in ('pending', 'accepted', 'declined', 'done', 'seen')
  );

-- =====================================================================
-- 4. Server-Side Notification Creation from Chat Invites & Reminders
-- =====================================================================

create or replace function public.create_notification_from_chat_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_name text;
begin
  if new.msg_type not in ('invite', 'remind') then
    return new;
  end if;

  if new.sender_id is null
     or new.recipient_id is null
     or new.sender_id = new.recipient_id then
    return new;
  end if;

  select coalesce(
    nullif(pg_catalog.btrim(p.name), ''),
    nullif(pg_catalog.split_part(coalesce(p.email, ''), '@', 1), ''),
    'Diadikasia Member'
  )
  into v_actor_name
  from public.profiles p
  where p.id = new.sender_id;

  v_actor_name := coalesce(v_actor_name, 'Diadikasia Member');

  insert into public.notifications (
    recipient_id,
    actor_id,
    actor_name,
    type,
    procedure_id,
    scheduled_for,
    status,
    read_at,
    chat_message_id
  )
  values (
    new.recipient_id,
    new.sender_id,
    v_actor_name,
    new.msg_type,
    new.procedure_id,
    case when new.msg_type = 'invite' then new.scheduled_for else null end,
    case
      when new.msg_type = 'invite' and new.invite_status = 'accepted' then 'accepted'
      else 'pending'
    end,
    null,
    new.id
  )
  on conflict (chat_message_id) where chat_message_id is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_chat_message_create_notification on public.chat_messages;
create trigger trg_chat_message_create_notification
  after insert on public.chat_messages
  for each row
  when (new.msg_type in ('invite', 'remind'))
  execute function public.create_notification_from_chat_message();

-- =====================================================================
-- 5. Bidirectional Sync When Study Invite Is Accepted (Chat <-> Notifications)
-- =====================================================================

create or replace function public.sync_chat_invite_accepted_to_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.msg_type = 'invite'
     and old.invite_status is distinct from 'accepted'
     and new.invite_status = 'accepted' then
    update public.notifications
    set
      status = 'accepted',
      read_at = coalesce(read_at, new.read_at, pg_catalog.now())
    where chat_message_id = new.id
      and type = 'invite'
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_invite_accepted_sync_notification on public.chat_messages;
create trigger trg_chat_invite_accepted_sync_notification
  after update of invite_status on public.chat_messages
  for each row
  when (
    new.msg_type = 'invite'
    and old.invite_status is distinct from 'accepted'
    and new.invite_status = 'accepted'
  )
  execute function public.sync_chat_invite_accepted_to_notification();

create or replace function public.sync_notification_invite_accepted_to_chat()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.type = 'invite'
     and new.chat_message_id is not null
     and old.status is distinct from 'accepted'
     and new.status = 'accepted' then
    update public.chat_messages
    set
      invite_status = 'accepted',
      read_at = coalesce(read_at, new.read_at, pg_catalog.now())
    where id = new.chat_message_id
      and msg_type = 'invite'
      and invite_status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notification_invite_accepted_sync_chat on public.notifications;
create trigger trg_notification_invite_accepted_sync_chat
  after update of status on public.notifications
  for each row
  when (
    new.type = 'invite'
    and new.chat_message_id is not null
    and old.status is distinct from 'accepted'
    and new.status = 'accepted'
  )
  execute function public.sync_notification_invite_accepted_to_chat();

-- =====================================================================
-- 6. SECURITY INVOKER Update Guard on public.notifications
-- =====================================================================

create or replace function public.guard_notifications_update_columns()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.recipient_id then
    raise exception 'Only the notification recipient can update this notification';
  end if;

  if new.id is distinct from old.id
     or new.recipient_id is distinct from old.recipient_id
     or new.actor_id is distinct from old.actor_id
     or new.actor_name is distinct from old.actor_name
     or new.type is distinct from old.type
     or new.procedure_id is distinct from old.procedure_id
     or new.scheduled_for is distinct from old.scheduled_for
     or new.chat_message_id is distinct from old.chat_message_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify immutable notification fields';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('accepted', 'declined', 'done') then
      raise exception 'Cannot change status of a finalized notification';
    end if;

    if old.type = 'invite' then
      if old.status is distinct from 'pending'
         or new.status not in ('accepted', 'declined') then
        raise exception 'Invalid study invitation status transition';
      end if;
    elsif old.type = 'remind' then
      if not (
        (old.status = 'pending' and new.status in ('seen', 'done'))
        or (old.status = 'seen' and new.status = 'done')
      ) then
        raise exception 'Invalid reminder notification status transition';
      end if;
    elsif old.type = 'req' then
      if old.status is distinct from 'pending'
         or new.status not in ('accepted', 'declined', 'done', 'seen') then
        raise exception 'Invalid friend request notification status transition';
      end if;
    else
      raise exception 'Unsupported notification type';
    end if;
  end if;

  if old.read_at is not null then
    new.read_at := old.read_at;
  elsif new.read_at is not null
        or (
          new.status is distinct from old.status
          and new.status in ('accepted', 'declined', 'done', 'seen')
        ) then
    new.read_at = pg_catalog.now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_notifications_update_columns on public.notifications;
create trigger trg_guard_notifications_update_columns
  before update on public.notifications
  for each row execute function public.guard_notifications_update_columns();

-- =====================================================================
-- 7. Enable Supabase Realtime for public.notifications
-- =====================================================================

alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then
  null;
end $$;
