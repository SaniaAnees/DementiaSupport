-- Optional Supabase schema for cloud sync (demo mode works without this).
-- Apply in Supabase SQL editor when enabling online sync.

create table if not exists sync_events (
  id text primary key,
  entity_type text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table sync_events enable row level security;

create policy "anon upsert sync_events"
  on sync_events for all
  using (true)
  with check (true);

-- For production, replace the open policy with caregiver-scoped RLS.
