-- Diadikasia Feature 2: Secure Feedback Centre, Internal Admin Notes, Private Attachments & Notifications

-- =====================================================================
-- 1. Feedback Tables (Strict Isolation Between User Rows & Admin Notes)
-- =====================================================================

create table if not exists public.platform_feedback (
  id bigint generated always as identity primary key,
  reference_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('suggestions', 'complaints', 'technical', 'safety')),
  subject text not null check (pg_catalog.char_length(pg_catalog.btrim(subject)) between 3 and 160),
  message text not null check (pg_catalog.char_length(pg_catalog.btrim(message)) between 10 and 4000),
  is_anonymous boolean not null default false,
  attachment_path text,
  attachment_name text,
  status text not null default 'received' check (status in ('received', 'under_review', 'resolved', 'closed')),
  admin_response text,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_platform_feedback_anon_user check (
    (is_anonymous = true and user_id is null)
    or (is_anonymous = false and user_id is not null)
  ),
  constraint chk_platform_feedback_attachment_path check (
    attachment_path is null
    or (
      attachment_path not like '%..%'
      and attachment_path !~ '^/'
      and attachment_path !~ '\\'
      and (
        (
          is_anonymous = true
          and attachment_path ~ '^anonymous/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+$'
        )
        or (
          is_anonymous = false
          and attachment_path ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+$'
        )
      )
    )
  )
);

create index if not exists idx_platform_feedback_user_created
  on public.platform_feedback(user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_platform_feedback_status_created
  on public.platform_feedback(status, created_at desc);

create index if not exists idx_platform_feedback_category_created
  on public.platform_feedback(category, created_at desc);

create index if not exists idx_platform_feedback_ref_lower
  on public.platform_feedback(lower(reference_number));

-- Separate private table for Supreme-Admin-only internal notes & audit history.
-- Learners and sub-admins have zero SELECT/INSERT/UPDATE/DELETE access to this table.
create table if not exists public.platform_feedback_notes (
  id bigint generated always as identity primary key,
  feedback_id bigint not null references public.platform_feedback(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  note text not null check (pg_catalog.char_length(pg_catalog.btrim(note)) between 1 and 2000),
  status_at_time text not null check (status_at_time in ('received', 'under_review', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_feedback_notes_feedback
  on public.platform_feedback_notes(feedback_id, created_at desc);

-- =====================================================================
-- 2. Least-Privilege Grants & Strict RLS Policies
-- =====================================================================

alter table public.platform_feedback enable row level security;
alter table public.platform_feedback_notes enable row level security;

revoke all on table public.platform_feedback from public, anon, authenticated;
grant select, update on table public.platform_feedback to authenticated;

revoke all on table public.platform_feedback_notes from public, anon, authenticated;
grant select, insert on table public.platform_feedback_notes to authenticated;

drop policy if exists "platform_feedback_select_own_or_admin" on public.platform_feedback;
create policy "platform_feedback_select_own_or_admin"
  on public.platform_feedback for select
  to authenticated
  using (
    (user_id = auth.uid() and is_anonymous = false)
    or public.is_admin()
  );

drop policy if exists "platform_feedback_update_admin" on public.platform_feedback;
create policy "platform_feedback_update_admin"
  on public.platform_feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "platform_feedback_notes_select_admin" on public.platform_feedback_notes;
create policy "platform_feedback_notes_select_admin"
  on public.platform_feedback_notes for select
  to authenticated
  using (public.is_admin());

drop policy if exists "platform_feedback_notes_insert_admin" on public.platform_feedback_notes;
create policy "platform_feedback_notes_insert_admin"
  on public.platform_feedback_notes for insert
  to authenticated
  with check (
    public.is_admin()
    and author_id = auth.uid()
  );

-- =====================================================================
-- 3. Server-Side Reference Number Generation, Insert Sanitization & Update Guard
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_feedback_attachment_linked(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.platform_feedback pf
    where pf.attachment_path = p_name
  );
$$;

revoke all on function private.is_feedback_attachment_linked(text) from public, anon;
grant execute on function private.is_feedback_attachment_linked(text) to authenticated;

create or replace function public.prepare_platform_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := pg_catalog.current_setting('request.jwt.claim.role', true);
  v_candidate text;
  v_attempts int := 0;
begin
  if v_uid is null and (
    session_user = 'authenticator'
    or v_jwt_role in ('authenticated', 'anon')
  ) then
    raise exception 'Authentication is required to submit feedback';
  end if;

  new.subject := pg_catalog.btrim(coalesce(new.subject, ''));
  new.message := pg_catalog.btrim(coalesce(new.message, ''));
  new.is_anonymous := coalesce(new.is_anonymous, false);

  if pg_catalog.char_length(new.subject) < 3 or pg_catalog.char_length(new.subject) > 160 then
    raise exception 'Feedback subject must be between 3 and 160 characters';
  end if;

  if pg_catalog.char_length(new.message) < 10 or pg_catalog.char_length(new.message) > 4000 then
    raise exception 'Feedback message must be between 10 and 4000 characters';
  end if;

  new.attachment_path := nullif(pg_catalog.btrim(coalesce(new.attachment_path, '')), '');
  new.attachment_name := nullif(pg_catalog.btrim(coalesce(new.attachment_name, '')), '');

  if new.attachment_path is null then
    new.attachment_name := null;
  else
    if new.attachment_path like '%..%'
       or new.attachment_path ~ '^/'
       or new.attachment_path ~ '\\' then
      raise exception 'Invalid attachment path';
    end if;

    if v_uid is null then
      raise exception 'Attachment path validation requires an authenticated submitter';
    end if;

    if new.is_anonymous then
      if new.attachment_path !~ ('^anonymous/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
        raise exception 'Anonymous attachment path must reside in the submitter anonymous folder';
      end if;
    else
      if new.attachment_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]+$') then
        raise exception 'Attachment path must reside in the submitter folder';
      end if;
    end if;

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'feedback-attachments'
        and o.name = new.attachment_path
    ) then
      raise exception 'Referenced feedback attachment was not found in private storage';
    end if;
  end if;

  if new.is_anonymous then
    new.user_id := null;
  elsif v_uid is not null then
    new.user_id := v_uid;
  end if;

  new.status := 'received';
  new.admin_response := null;
  new.responded_at := null;
  new.resolved_at := null;
  new.created_at := pg_catalog.now();
  new.updated_at := pg_catalog.now();

  loop
    v_attempts := v_attempts + 1;
    v_candidate := 'FDK-' || pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        8
      )
    );
    exit when not exists (
      select 1 from public.platform_feedback pf where pf.reference_number = v_candidate
    );
    if v_attempts >= 15 then
      raise exception 'Could not allocate unique feedback reference number';
    end if;
  end loop;

  new.reference_number := v_candidate;
  return new;
end;
$$;

drop trigger if exists trg_prepare_platform_feedback_insert on public.platform_feedback;
create trigger trg_prepare_platform_feedback_insert
  before insert on public.platform_feedback
  for each row execute function public.prepare_platform_feedback_insert();

-- SECURITY INVOKER so `current_user` reflects the actual invoking role
-- ('authenticated'/'anon' vs trusted DB maintenance) without bypassing checks.
create or replace function public.guard_platform_feedback_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    new.updated_at := pg_catalog.now();
    return new;
  end if;

  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only Supreme Admin can update feedback submissions';
  end if;

  if new.id is distinct from old.id
     or new.reference_number is distinct from old.reference_number
     or new.user_id is distinct from old.user_id
     or new.category is distinct from old.category
     or new.subject is distinct from old.subject
     or new.message is distinct from old.message
     or new.is_anonymous is distinct from old.is_anonymous
     or new.attachment_path is distinct from old.attachment_path
     or new.attachment_name is distinct from old.attachment_name
     or new.created_at is distinct from old.created_at then
    raise exception 'Cannot modify immutable feedback submission fields';
  end if;

  new.admin_response := nullif(pg_catalog.btrim(coalesce(new.admin_response, '')), '');

  if new.admin_response is distinct from old.admin_response
     and new.admin_response is not null then
    new.responded_at := pg_catalog.now();
  else
    new.responded_at := old.responded_at;
  end if;

  if new.status in ('resolved', 'closed') then
    new.resolved_at := coalesce(old.resolved_at, pg_catalog.now());
  else
    new.resolved_at := null;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists trg_guard_platform_feedback_update on public.platform_feedback;
create trigger trg_guard_platform_feedback_update
  before update on public.platform_feedback
  for each row execute function public.guard_platform_feedback_update();

-- Server-side RPC for submitting both confidential and anonymous feedback.
-- Returns the confirmation + server-generated reference_number directly without
-- exposing anonymous rows via SELECT RLS or exposing user identity.
create or replace function public.submit_platform_feedback(
  p_category text,
  p_subject text,
  p_message text,
  p_is_anonymous boolean default false,
  p_attachment_path text default null,
  p_attachment_name text default null
)
returns table (
  id bigint,
  reference_number text,
  category text,
  subject text,
  message text,
  is_anonymous boolean,
  attachment_path text,
  attachment_name text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_anon boolean := coalesce(p_is_anonymous, false);
  v_row public.platform_feedback%rowtype;
begin
  if v_uid is null then
    raise exception 'Please sign in before submitting feedback';
  end if;

  if p_category not in ('suggestions', 'complaints', 'technical', 'safety') then
    raise exception 'Invalid feedback category';
  end if;

  insert into public.platform_feedback (
    reference_number,
    user_id,
    category,
    subject,
    message,
    is_anonymous,
    attachment_path,
    attachment_name,
    status
  )
  values (
    'PENDING',
    case when v_is_anon then null else v_uid end,
    p_category,
    p_subject,
    p_message,
    v_is_anon,
    p_attachment_path,
    p_attachment_name,
    'received'
  )
  returning * into v_row;

  return query
  select
    v_row.id,
    v_row.reference_number,
    v_row.category,
    v_row.subject,
    v_row.message,
    v_row.is_anonymous,
    case when v_row.is_anonymous then null else v_row.attachment_path end,
    v_row.attachment_name,
    v_row.status,
    v_row.created_at;
end;
$$;

revoke all on function public.submit_platform_feedback(text, text, text, boolean, text, text) from public, anon;
grant execute on function public.submit_platform_feedback(text, text, text, boolean, text, text) to authenticated;

-- =====================================================================
-- 4. Dedicated Private Storage Bucket & Policies for Feedback Attachments
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback_attachments_insert" on storage.objects;
create policy "feedback_attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'feedback-attachments'
    and auth.uid() is not null
    and name not like '%..%'
    and name !~ '^/'
    and name !~ '\\'
    and (
      (
        pg_catalog.array_length(storage.foldername(name), 1) = 1
        and (storage.foldername(name))[1] = auth.uid()::text
        and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
      )
      or (
        pg_catalog.array_length(storage.foldername(name), 1) = 2
        and (storage.foldername(name))[1] = 'anonymous'
        and (storage.foldername(name))[2] = auth.uid()::text
        and name ~ ('^anonymous/' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
      )
    )
  );

drop policy if exists "feedback_attachments_select" on storage.objects;
create policy "feedback_attachments_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and (
      public.is_admin()
      or (
        pg_catalog.array_length(storage.foldername(name), 1) = 1
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[1] <> 'anonymous'
      )
    )
  );

drop policy if exists "feedback_attachments_delete" on storage.objects;
create policy "feedback_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and (
      public.is_admin()
      or (
        not private.is_feedback_attachment_linked(name)
        and (
          (
            pg_catalog.array_length(storage.foldername(name), 1) = 1
            and (storage.foldername(name))[1] = auth.uid()::text
            and (storage.foldername(name))[1] <> 'anonymous'
          )
          or (
            pg_catalog.array_length(storage.foldername(name), 1) = 2
            and (storage.foldername(name))[1] = 'anonymous'
            and (storage.foldername(name))[2] = auth.uid()::text
          )
        )
      )
    )
  );

-- =====================================================================
-- 5. Notifications Integration (Reusing public.notifications)
-- =====================================================================

alter table public.notifications
  add column if not exists feedback_id bigint references public.platform_feedback(id) on delete cascade;

do $$
declare
  v_conname text;
begin
  for v_conname in
    select c.conname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'notifications'
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* '\ytype\y'
  loop
    execute format('alter table public.notifications drop constraint if exists %I', v_conname);
  end loop;
end $$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('invite', 'req', 'remind', 'feedback_new', 'feedback_update'));

create unique index if not exists idx_notifications_feedback_new_unique
  on public.notifications(recipient_id, feedback_id)
  where type = 'feedback_new' and feedback_id is not null;

create or replace function public.notify_admins_on_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_name text;
begin
  if new.is_anonymous or new.user_id is null then
    v_actor_name := 'Anonymous user';
  else
    select coalesce(
      nullif(pg_catalog.btrim(p.name), ''),
      nullif(pg_catalog.split_part(coalesce(p.email, ''), '@', 1), ''),
      'Diadikasia Member'
    )
    into v_actor_name
    from public.profiles p
    where p.id = new.user_id;

    v_actor_name := coalesce(v_actor_name, 'Diadikasia Member');
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    actor_name,
    type,
    procedure_id,
    scheduled_for,
    status,
    read_at,
    feedback_id
  )
  select
    admin_prof.id,
    case when new.is_anonymous then null else new.user_id end,
    v_actor_name,
    'feedback_new',
    null,
    new.reference_number,
    'pending',
    null,
    new.id
  from public.profiles admin_prof
  where admin_prof.role = 'admin'
  on conflict (recipient_id, feedback_id)
    where type = 'feedback_new' and feedback_id is not null
    do nothing;

  return new;
end;
$$;

drop trigger if exists trg_feedback_notify_admins on public.platform_feedback;
create trigger trg_feedback_notify_admins
  after insert on public.platform_feedback
  for each row execute function public.notify_admins_on_new_feedback();

create or replace function public.notify_user_on_feedback_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status_label text;
begin
  if new.is_anonymous or new.user_id is null then
    return new;
  end if;

  if new.status is not distinct from old.status
     and new.admin_response is not distinct from old.admin_response then
    return new;
  end if;

  v_status_label := case new.status
    when 'received' then 'Received'
    when 'under_review' then 'Under Review'
    when 'resolved' then 'Resolved'
    when 'closed' then 'Closed'
    else 'Updated'
  end;

  insert into public.notifications (
    recipient_id,
    actor_id,
    actor_name,
    type,
    procedure_id,
    scheduled_for,
    status,
    read_at,
    feedback_id
  )
  values (
    new.user_id,
    null,
    'Diadikasia Administration',
    'feedback_update',
    null,
    new.reference_number || ' · ' || v_status_label,
    'pending',
    null,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_feedback_notify_user on public.platform_feedback;
create trigger trg_feedback_notify_user
  after update on public.platform_feedback
  for each row execute function public.notify_user_on_feedback_update();

-- Update guard_notifications_update_columns() to preserve feedback_id immutability
-- and permit seen/done transitions for feedback_new and feedback_update alongside
-- all existing notification types ('invite', 'remind', 'req').
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
     or new.feedback_id is distinct from old.feedback_id
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
    elsif old.type in ('remind', 'feedback_new', 'feedback_update') then
      if not (
        (old.status = 'pending' and new.status in ('seen', 'done'))
        or (old.status = 'seen' and new.status = 'done')
      ) then
        raise exception 'Invalid notification status transition';
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

-- =====================================================================
-- 6. Enable Supabase Realtime on public.platform_feedback
-- =====================================================================

alter table public.platform_feedback replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.platform_feedback;
exception when duplicate_object or undefined_object then
  null;
end $$;
