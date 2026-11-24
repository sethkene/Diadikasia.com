-- Diadikasia Reels Backend Integration: Author Ownership, View/Click RPCs, Comment Deletion, Duplicate Report Guard & Realtime

-- =====================================================================
-- 1. Guard Non-Editable Reel Columns on Direct Client Updates
-- =====================================================================

create or replace function public.guard_reel_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow trusted SECURITY DEFINER triggers/RPCs (postgres/supabase_admin) and explicit bypasses
  if current_setting('app.bypass_reel_guard', true) = 'on'
     or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.author_id is distinct from old.author_id
     or new.verified is distinct from old.verified
     or new.views_count is distinct from old.views_count
     or new.likes_count is distinct from old.likes_count
     or new.practice_clicks is distinct from old.practice_clicks
     or new.is_removed is distinct from old.is_removed
     or new.created_at is distinct from old.created_at then
    raise exception 'Insufficient permissions to modify protected reel fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_reel_update_columns on public.reels;
create trigger trg_guard_reel_update_columns
  before update on public.reels
  for each row execute function public.guard_reel_update_columns();

-- =====================================================================
-- 2. Reel Author Edit/Delete & Comment Delete RLS Policies
-- =====================================================================

drop policy if exists "reels_update_own" on public.reels;
create policy "reels_update_own"
  on public.reels for update
  to authenticated
  using (author_id = auth.uid() and is_removed = false)
  with check (author_id = auth.uid() and is_removed = false);

drop policy if exists "reels_delete_own_or_mod" on public.reels;
create policy "reels_delete_own_or_mod"
  on public.reels for delete
  to authenticated
  using (author_id = auth.uid() or public.has_staff_permission('moderate'));

drop policy if exists "reel_comments_delete_own_or_mod" on public.reel_comments;
create policy "reel_comments_delete_own_or_mod"
  on public.reel_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.has_staff_permission('moderate'));

-- =====================================================================
-- 3. Prevent Duplicate Open Reports Per User & Reel
-- =====================================================================

create unique index if not exists idx_post_reports_open_unique
  on public.post_reports(reel_id, reported_by)
  where status = 'open';

-- =====================================================================
-- 4. View & Practice Click Increment RPCs (Authenticated Only)
-- =====================================================================

create or replace function public.increment_reel_view(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('app.bypass_reel_guard', 'on', true);
  update public.reels
  set views_count = views_count + 1
  where id = p_reel_id and is_removed = false;
end;
$$;

create or replace function public.increment_reel_practice_click(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('app.bypass_reel_guard', 'on', true);
  update public.reels
  set practice_clicks = practice_clicks + 1
  where id = p_reel_id and is_removed = false;
end;
$$;

revoke all on function public.increment_reel_view(bigint) from public, anon;
grant execute on function public.increment_reel_view(bigint) to authenticated;

revoke all on function public.increment_reel_practice_click(bigint) from public, anon;
grant execute on function public.increment_reel_practice_click(bigint) to authenticated;

-- =====================================================================
-- 5. Enable Supabase Realtime Replication for Reels Feed & Comments
-- =====================================================================

do $$
begin
  alter publication supabase_realtime add table public.reels;
exception when duplicate_object or undefined_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reel_comments;
exception when duplicate_object or undefined_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_reports;
exception when duplicate_object or undefined_object then
  null;
end $$;
