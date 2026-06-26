create table if not exists users (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  club_name text not null,
  club_id text default '',
  platform text not null,
  verified_club jsonb,
  logo_url text default '',
  role text not null default 'manager',
  email_verified boolean not null default false,
  verification_token text,
  verification_expires_at timestamptz,
  password_reset_token text,
  password_reset_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_verification_token_idx on users (verification_token);
create index if not exists users_password_reset_token_idx on users (password_reset_token);

create table if not exists sessions (
  token text primary key,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'manager',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists app_state (
  id integer primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);
