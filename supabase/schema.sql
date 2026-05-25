create extension if not exists pgcrypto;

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  points integer not null default 0 check (points >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

create type task_cycle as enum ('daily', 'weekly', 'none');

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  points integer not null check (points > 0),
  cycle task_cycle not null default 'daily',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  points integer not null check (points > 0),
  completed_at timestamptz not null default now()
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  cost integer not null check (cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type redemption_status as enum ('pending', 'approved', 'rejected');

create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  reward_id uuid not null references rewards(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  cost integer not null check (cost > 0),
  status redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_member_id uuid references members(id) on delete set null
);

create index if not exists members_space_idx on members(space_id);
create index if not exists tasks_space_idx on tasks(space_id);
create index if not exists task_completions_space_completed_idx on task_completions(space_id, completed_at desc);
create index if not exists rewards_space_idx on rewards(space_id);
create index if not exists reward_redemptions_space_requested_idx on reward_redemptions(space_id, requested_at desc);

alter table spaces enable row level security;
alter table members enable row level security;
alter table tasks enable row level security;
alter table task_completions enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;

-- This app reads and writes through server routes with SUPABASE_SERVICE_ROLE_KEY.
-- Keep direct anonymous access disabled unless you later add authenticated RLS policies.
