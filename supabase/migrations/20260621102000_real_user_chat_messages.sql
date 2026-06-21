-- Real peer-to-peer chat messages. Local mock replies remain only as frontend
-- fallback when Supabase is not configured.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  contact_owner_id uuid references public.users(id) on delete set null,
  body text not null,
  message_type text not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_sender_created_idx
  on public.chat_messages(sender_id, created_at desc);

create index if not exists chat_messages_recipient_created_idx
  on public.chat_messages(recipient_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_participants" on public.chat_messages;
create policy "chat_messages_select_participants"
  on public.chat_messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "chat_messages_insert_sender" on public.chat_messages;
create policy "chat_messages_insert_sender"
  on public.chat_messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "chat_messages_update_recipient_read" on public.chat_messages;
create policy "chat_messages_update_recipient_read"
  on public.chat_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
