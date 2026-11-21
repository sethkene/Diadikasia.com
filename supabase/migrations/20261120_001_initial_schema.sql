-- Diadikasia Phase 1: Initial PostgreSQL Schema & Storage Buckets
-- Safe to run in Supabase SQL Editor or via `supabase db push`

create extension if not exists pgcrypto;

-- 1. User Profiles (1-to-1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'learner' check (role in ('learner', 'instructor', 'sub_admin', 'admin')),
  qualifications text,
  youtube_handle text,
  organization text,
  region text check (region is null or region in ('African', 'European', 'Asian')),
  bio text,
  approved_at text,
  can_review_videos boolean not null default false,
  can_moderate_posts boolean not null default false,
  share_practice_popups boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email_lower on public.profiles(lower(email));

-- 2. Instructor Verification Applications
create table if not exists public.instructor_applications (
  id bigint generated always as identity primary key,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  full_name text not null,
  qualifications text not null,
  youtube_handle text default '',
  note text default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decision_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_applications_status on public.instructor_applications(status);
create index if not exists idx_applications_applicant on public.instructor_applications(applicant_id);

-- 3. Clinical Video Submissions (Review Queue)
create table if not exists public.video_submissions (
  id bigint generated always as identity primary key,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  submitted_by_email text not null,
  discipline text not null check (discipline in ('nursing', 'surgical')),
  category text not null,
  title text not null,
  instructor_display text not null,
  organization text not null,
  region text not null check (region in ('African', 'European', 'Asian')),
  duration text not null default 'New',
  storage_path text not null default '',
  external_video_url text,
  steps jsonb not null default '[]'::jsonb,
  owns_rights boolean not null default false,
  patient_consent boolean not null default false,
  checklist jsonb not null default '[false,false,false,false,false]'::jsonb,
  reviewer_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'ok', 'chg', 'rej')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_submissions_status on public.video_submissions(status);
create index if not exists idx_submissions_author on public.video_submissions(submitted_by);

-- 4. Published Clinical Procedures
create table if not exists public.procedures (
  id bigint generated always as identity primary key,
  submission_id bigint unique references public.video_submissions(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  discipline text not null check (discipline in ('nursing', 'surgical')),
  category text not null,
  title text not null,
  instructor_display text not null,
  organization text not null,
  region text not null check (region in ('African', 'European', 'Asian')),
  duration text not null default 'New',
  steps jsonb not null default '[]'::jsonb,
  hue int not null default 190,
  storage_path text,
  external_video_url text,
  views_count int not null default 0,
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_procedures_filter on public.procedures(discipline, region, category);

-- 5. Learner Progress, Saves & Practice Milestones
create table if not exists public.procedure_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id bigint not null references public.procedures(id) on delete cascade,
  completed_steps jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, procedure_id)
);

create table if not exists public.saved_procedures (
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id bigint not null references public.procedures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, procedure_id)
);

create table if not exists public.practice_milestones (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id bigint not null references public.procedures(id) on delete cascade,
  points int not null default 0,
  score_text text not null,
  reflection text default '',
  created_at timestamptz not null default now()
);

-- 6. Community Reels
create table if not exists public.reels (
  id bigint generated always as identity primary key,
  author_id uuid references public.profiles(id) on delete set null,
  author_display text not null,
  author_role text not null default 'Learner',
  author_org text default '',
  author_reg text default '',
  author_bio text default '',
  verified boolean not null default false,
  kind text not null check (kind in ('video', 'photo')),
  genre text not null,
  discipline text not null default 'general' check (discipline in ('general', 'nursing', 'surgical')),
  category text,
  linked_procedure_id bigint references public.procedures(id) on delete set null,
  caption text not null,
  media_path text,
  is_image boolean not null default false,
  hue int not null default 200,
  views_count int not null default 0,
  likes_count int not null default 0,
  practice_clicks int not null default 0,
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reels_feed on public.reels(is_removed, created_at desc);

-- 7. Comments & Likes
create table if not exists public.procedure_comments (
  id bigint generated always as identity primary key,
  procedure_id bigint not null references public.procedures(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_proc_comments_proc on public.procedure_comments(procedure_id, created_at asc);

create table if not exists public.reel_comments (
  id bigint generated always as identity primary key,
  reel_id bigint not null references public.reels(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reel_comments_reel on public.reel_comments(reel_id, created_at asc);

create table if not exists public.procedure_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id bigint not null references public.procedures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, procedure_id)
);

create table if not exists public.reel_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reel_id bigint not null references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);

-- 8. Recommender Signals & Moderation Reports
create table if not exists public.reel_signals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  signals jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.post_reports (
  id bigint generated always as identity primary key,
  reel_id bigint not null references public.reels(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reporter_name text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  moderated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists idx_reports_status on public.post_reports(status, created_at desc);

-- 9. Study Network: Friendships, Chat & Notifications
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index if not exists idx_friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  msg_type text not null default 'text' check (msg_type in ('text', 'invite', 'remind', 'post')),
  body text,
  procedure_id bigint references public.procedures(id) on delete set null,
  reel_id bigint references public.reels(id) on delete set null,
  scheduled_for text,
  invite_status text check (invite_status is null or invite_status in ('pending', 'accepted')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_pair
  on public.chat_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at asc);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  type text not null check (type in ('invite', 'req', 'remind')),
  procedure_id bigint references public.procedures(id) on delete set null,
  scheduled_for text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done', 'seen')),
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_id, created_at desc);

-- 10. Storage Buckets (Free-Tier Friendly Limits)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'procedure-submissions',
    'procedure-submissions',
    false,
    52428800,
    array['video/mp4', 'video/quicktime', 'video/webm']
  ),
  (
    'procedures-public',
    'procedures-public',
    true,
    52428800,
    array['video/mp4', 'video/quicktime', 'video/webm']
  ),
  (
    'reel-media',
    'reel-media',
    true,
    20971520,
    array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
