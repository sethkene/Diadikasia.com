-- Diadikasia Phase 1: Auth Triggers, RLS Policies, Storage Policies & Admin RPCs

-- =====================================================================
-- 1. Auth -> Profile Auto-Provisioning & Role Escalation Guard
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'learner'), '@', 1);
  end if;

  insert into public.profiles (id, email, name, role, can_review_videos, can_moderate_posts)
  values (
    new.id,
    lower(new.email),
    v_name,
    'learner',
    false,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from escalating their own role, email, or staff permissions via REST UPDATE
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_role_guard', true) = 'on' or auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Cannot modify profile id';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    if new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.can_review_videos is distinct from old.can_review_videos
      or new.can_moderate_posts is distinct from old.can_moderate_posts
      or new.approved_at is distinct from old.approved_at then
      raise exception 'Insufficient permissions to modify privileged profile fields';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();

-- =====================================================================
-- 2. Helper Functions for RLS
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_instructor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin')
  );
$$;

create or replace function public.has_staff_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (
          role = 'sub_admin'
          and (
            (perm = 'review' and can_review_videos = true)
            or (perm = 'moderate' and can_moderate_posts = true)
          )
        )
      )
  );
$$;

-- =====================================================================
-- 3. Atomic Likes Count Triggers
-- =====================================================================

create or replace function public.sync_procedure_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.procedures set likes_count = likes_count + 1 where id = new.procedure_id;
  elsif tg_op = 'DELETE' then
    update public.procedures set likes_count = greatest(0, likes_count - 1) where id = old.procedure_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_procedure_likes_count on public.procedure_likes;
create trigger trg_procedure_likes_count
  after insert or delete on public.procedure_likes
  for each row execute function public.sync_procedure_likes_count();

create or replace function public.sync_reel_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set likes_count = likes_count + 1 where id = new.reel_id;
  elsif tg_op = 'DELETE' then
    update public.reels set likes_count = greatest(0, likes_count - 1) where id = old.reel_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reel_likes_count on public.reel_likes;
create trigger trg_reel_likes_count
  after insert or delete on public.reel_likes
  for each row execute function public.sync_reel_likes_count();

-- =====================================================================
-- 4. Enable RLS & Define Table Policies
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.instructor_applications enable row level security;
alter table public.video_submissions enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_progress enable row level security;
alter table public.saved_procedures enable row level security;
alter table public.practice_milestones enable row level security;
alter table public.reels enable row level security;
alter table public.procedure_comments enable row level security;
alter table public.reel_comments enable row level security;
alter table public.procedure_likes enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_signals enable row level security;
alter table public.post_reports enable row level security;
alter table public.friendships enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users read only their own full row; admins read all full rows
-- Public instructor/person info without emails is served via get_public_directory()
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Instructor applications
drop policy if exists "applications_select_own_or_admin" on public.instructor_applications;
create policy "applications_select_own_or_admin"
  on public.instructor_applications for select
  to authenticated
  using (applicant_id = auth.uid() or public.is_admin());

drop policy if exists "applications_insert_own" on public.instructor_applications;
create policy "applications_insert_own"
  on public.instructor_applications for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and decision_note is null
    and decided_at is null
  );

-- Video submissions
drop policy if exists "submissions_select_owner_or_reviewer" on public.video_submissions;
create policy "submissions_select_owner_or_reviewer"
  on public.video_submissions for select
  to authenticated
  using (submitted_by = auth.uid() or public.has_staff_permission('review'));

drop policy if exists "submissions_insert_instructor" on public.video_submissions;
create policy "submissions_insert_instructor"
  on public.video_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and public.is_instructor_or_admin()
    and status = 'pending'
    and reviewed_by is null
    and reviewer_note = ''
  );

drop policy if exists "submissions_update_reviewer" on public.video_submissions;
create policy "submissions_update_reviewer"
  on public.video_submissions for update
  to authenticated
  using (public.has_staff_permission('review'))
  with check (public.has_staff_permission('review'));

-- Procedures (published library: read-only via REST; inserts happen exclusively inside review_video_submission RPC)
drop policy if exists "procedures_select_all" on public.procedures;
create policy "procedures_select_all"
  on public.procedures for select
  to authenticated, anon
  using (true);

-- Procedure progress, saves & milestones
drop policy if exists "progress_own_all" on public.procedure_progress;
create policy "progress_own_all"
  on public.procedure_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saved_own_all" on public.saved_procedures;
create policy "saved_own_all"
  on public.saved_procedures for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "milestones_select_all" on public.practice_milestones;
create policy "milestones_select_all"
  on public.practice_milestones for select
  to authenticated
  using (true);

drop policy if exists "milestones_insert_own" on public.practice_milestones;
create policy "milestones_insert_own"
  on public.practice_milestones for insert
  to authenticated
  with check (user_id = auth.uid());

-- Reels
drop policy if exists "reels_select_visible" on public.reels;
create policy "reels_select_visible"
  on public.reels for select
  to authenticated
  using (is_removed = false or public.has_staff_permission('moderate'));

drop policy if exists "reels_insert_own" on public.reels;
create policy "reels_insert_own"
  on public.reels for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and is_removed = false
    and views_count = 0
    and likes_count = 0
    and practice_clicks = 0
    and verified = public.is_instructor_or_admin()
  );

-- Comments & Likes
drop policy if exists "proc_comments_select" on public.procedure_comments;
create policy "proc_comments_select"
  on public.procedure_comments for select
  to authenticated
  using (true);

drop policy if exists "proc_comments_insert" on public.procedure_comments;
create policy "proc_comments_insert"
  on public.procedure_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "reel_comments_select" on public.reel_comments;
create policy "reel_comments_select"
  on public.reel_comments for select
  to authenticated
  using (true);

drop policy if exists "reel_comments_insert" on public.reel_comments;
create policy "reel_comments_insert"
  on public.reel_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "proc_likes_own" on public.procedure_likes;
create policy "proc_likes_own"
  on public.procedure_likes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reel_likes_own" on public.reel_likes;
create policy "reel_likes_own"
  on public.reel_likes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Recommender signals
drop policy if exists "reel_signals_own" on public.reel_signals;
create policy "reel_signals_own"
  on public.reel_signals for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Post reports
drop policy if exists "reports_insert_own" on public.post_reports;
create policy "reports_insert_own"
  on public.post_reports for insert
  to authenticated
  with check (
    reported_by = auth.uid()
    and status = 'open'
    and moderated_by is null
    and moderated_at is null
  );

drop policy if exists "reports_select_own_or_moderator" on public.post_reports;
create policy "reports_select_own_or_moderator"
  on public.post_reports for select
  to authenticated
  using (reported_by = auth.uid() or public.has_staff_permission('moderate'));

-- Friendships (split by operation so requester cannot self-accept)
drop policy if exists "friendships_own_all" on public.friendships;
drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_update_addressee" on public.friendships;
drop policy if exists "friendships_delete_own" on public.friendships;

create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "friendships_insert_requester"
  on public.friendships for insert
  to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy "friendships_update_addressee"
  on public.friendships for update
  to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted', 'declined'));

create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Chats & notifications
drop policy if exists "chat_own_select" on public.chat_messages;
create policy "chat_own_select"
  on public.chat_messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "chat_own_insert" on public.chat_messages;
create policy "chat_own_insert"
  on public.chat_messages for insert
  to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "chat_own_update_read" on public.chat_messages;
create policy "chat_own_update_read"
  on public.chat_messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "notifications_insert_actor" on public.notifications;
create policy "notifications_insert_actor"
  on public.notifications for insert
  to authenticated
  with check (actor_id = auth.uid() and status in ('pending', 'seen'));

drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- =====================================================================
-- 5. Storage Bucket Policies
-- =====================================================================

drop policy if exists "submissions_bucket_insert" on storage.objects;
create policy "submissions_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'procedure-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_instructor_or_admin()
  );

drop policy if exists "submissions_bucket_select" on storage.objects;
create policy "submissions_bucket_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'procedure-submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_staff_permission('review')
    )
  );

drop policy if exists "procedures_public_read" on storage.objects;
create policy "procedures_public_read"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'procedures-public');

drop policy if exists "procedures_public_reviewer_insert" on storage.objects;
create policy "procedures_public_reviewer_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'procedures-public'
    and public.has_staff_permission('review')
  );

drop policy if exists "reel_media_read" on storage.objects;
create policy "reel_media_read"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'reel-media');

drop policy if exists "reel_media_insert_own" on storage.objects;
create policy "reel_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reel-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "reel_media_delete_owner_or_mod" on storage.objects;
create policy "reel_media_delete_owner_or_mod"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reel-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_staff_permission('moderate')
    )
  );

-- =====================================================================
-- 6. Server-Side Directory, Profile, Admin & Moderation RPCs
-- =====================================================================

-- Safe public directory (exposes instructor/user display fields WITHOUT private emails)
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
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.role,
    p.qualifications,
    p.youtube_handle,
    p.approved_at
  from public.profiles p
  order by p.created_at asc;
$$;

create or replace function public.review_instructor_application(
  p_app_id bigint,
  p_approve boolean,
  p_decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.instructor_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only Supreme Admin can review instructor applications';
  end if;

  select * into v_app from public.instructor_applications where id = p_app_id;
  if not found then
    raise exception 'Application not found';
  end if;

  update public.instructor_applications
  set
    status = case when p_approve then 'approved' else 'declined' end,
    decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
    reviewed_by = auth.uid(),
    decided_at = now()
  where id = p_app_id;

  if p_approve then
    perform set_config('app.bypass_role_guard', 'on', true);
    update public.profiles
    set
      name = v_app.full_name,
      role = case when role = 'admin' then 'admin' else 'instructor' end,
      qualifications = v_app.qualifications,
      youtube_handle = nullif(trim(coalesce(v_app.youtube_handle, '')), ''),
      approved_at = to_char(now(), 'Mon YYYY')
    where id = v_app.applicant_id;
  end if;
end;
$$;

create or replace function public.revoke_instructor(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Supreme Admin can revoke instructor access';
  end if;

  perform set_config('app.bypass_role_guard', 'on', true);
  update public.profiles
  set role = 'learner'
  where id = p_target_user_id and role = 'instructor';
end;
$$;

create or replace function public.appoint_or_update_sub_admin(
  p_email text,
  p_name text,
  p_can_review boolean,
  p_can_moderate boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only Supreme Admin can manage sub-admin staff';
  end if;

  select * into v_target from public.profiles where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'No registered user found with email %', p_email;
  end if;
  if v_target.role = 'admin' then
    raise exception 'Cannot modify Supreme Admin account';
  end if;

  perform set_config('app.bypass_role_guard', 'on', true);
  update public.profiles
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    role = 'sub_admin',
    can_review_videos = p_can_review,
    can_moderate_posts = p_can_moderate
  where id = v_target.id;
end;
$$;

create or replace function public.remove_sub_admin(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Supreme Admin can remove sub-admin staff';
  end if;

  perform set_config('app.bypass_role_guard', 'on', true);
  update public.profiles
  set
    role = 'learner',
    can_review_videos = false,
    can_moderate_posts = false
  where id = p_target_user_id and role = 'sub_admin';
end;
$$;

create or replace function public.review_video_submission(
  p_submission_id bigint,
  p_decision text,
  p_checklist jsonb,
  p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.video_submissions%rowtype;
  v_procedure_id bigint;
begin
  if not public.has_staff_permission('review') then
    raise exception 'Insufficient permissions to review videos';
  end if;

  if p_decision not in ('ok', 'chg', 'rej') then
    raise exception 'Invalid review decision';
  end if;

  select * into v_sub from public.video_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  update public.video_submissions
  set
    status = p_decision,
    checklist = coalesce(p_checklist, checklist),
    reviewer_note = coalesce(p_note, ''),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_submission_id;

  if p_decision = 'ok' then
    insert into public.procedures (
      submission_id,
      author_id,
      discipline,
      category,
      title,
      instructor_display,
      organization,
      region,
      duration,
      steps,
      hue,
      storage_path,
      external_video_url
    )
    values (
      v_sub.id,
      v_sub.submitted_by,
      v_sub.discipline,
      v_sub.category,
      v_sub.title,
      v_sub.instructor_display,
      v_sub.organization,
      v_sub.region,
      v_sub.duration,
      v_sub.steps,
      ((v_sub.id * 47) % 360)::int,
      v_sub.storage_path,
      v_sub.external_video_url
    )
    on conflict (submission_id) do update set
      title = excluded.title,
      steps = excluded.steps
    returning id into v_procedure_id;
  end if;

  return v_procedure_id;
end;
$$;

create or replace function public.moderate_reported_post(
  p_report_id bigint,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rep public.post_reports%rowtype;
begin
  if not public.has_staff_permission('moderate') then
    raise exception 'Insufficient permissions to moderate posts';
  end if;

  if p_action not in ('removed', 'dismissed') then
    raise exception 'Invalid moderation action';
  end if;

  select * into v_rep from public.post_reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  update public.post_reports
  set
    status = p_action,
    moderated_by = auth.uid(),
    moderated_at = now()
  where id = p_report_id;

  if p_action = 'removed' then
    update public.reels set is_removed = true where id = v_rep.reel_id;
  end if;
end;
$$;

create or replace function public.increment_procedure_view(p_procedure_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.procedures
  set views_count = views_count + 1
  where id = p_procedure_id;
$$;

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if found then
    return v_profile;
  end if;

  select email,
         coalesce(nullif(trim(coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', '')), ''), split_part(email, '@', 1))
  into v_email, v_name
  from auth.users
  where id = v_uid;

  insert into public.profiles (id, email, name, role, can_review_videos, can_moderate_posts)
  values (v_uid, lower(v_email), v_name, 'learner', false, false)
  on conflict (id) do update set email = excluded.email
  returning * into v_profile;

  return v_profile;
end;
$$;

-- =====================================================================
-- 7. Least-Privilege Function Execute Permissions
-- =====================================================================

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_instructor_or_admin() from public, anon;
grant execute on function public.is_instructor_or_admin() to authenticated;

revoke all on function public.has_staff_permission(text) from public, anon;
grant execute on function public.has_staff_permission(text) to authenticated;

revoke all on function public.get_public_directory() from public, anon;
grant execute on function public.get_public_directory() to authenticated;

revoke all on function public.review_instructor_application(bigint, boolean, text) from public, anon;
grant execute on function public.review_instructor_application(bigint, boolean, text) to authenticated;

revoke all on function public.revoke_instructor(uuid) from public, anon;
grant execute on function public.revoke_instructor(uuid) to authenticated;

revoke all on function public.appoint_or_update_sub_admin(text, text, boolean, boolean) from public, anon;
grant execute on function public.appoint_or_update_sub_admin(text, text, boolean, boolean) to authenticated;

revoke all on function public.remove_sub_admin(uuid) from public, anon;
grant execute on function public.remove_sub_admin(uuid) to authenticated;

revoke all on function public.review_video_submission(bigint, text, jsonb, text) from public, anon;
grant execute on function public.review_video_submission(bigint, text, jsonb, text) to authenticated;

revoke all on function public.moderate_reported_post(bigint, text) from public, anon;
grant execute on function public.moderate_reported_post(bigint, text) to authenticated;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

revoke all on function public.increment_procedure_view(bigint) from public;
grant execute on function public.increment_procedure_view(bigint) to authenticated, anon;
