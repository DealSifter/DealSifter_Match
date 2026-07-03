-- Real Admin/Support ticketing: persistent chat history, admin replies,
-- unread counters, KPI events and system notifications.

create extension if not exists pgcrypto;

do $$
begin
  alter table public.notifications drop constraint if exists notifications_type_check;
  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('unlock', 'exclusive', 'spotlight_expired', 'support'));
exception
  when undefined_table then null;
end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigserial unique,
  contact_id text not null unique default ('SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  subject text not null default 'Support request',
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  channel text not null default 'chat' check (channel in ('chat', 'email')),
  unread_for_admin integer not null default 0,
  unread_for_user integer not null default 0,
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'admin', 'system')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  delivery_channel text not null default 'chat' check (delivery_channel in ('chat', 'email', 'system')),
  email_delivery_status text not null default 'not_requested' check (email_delivery_status in ('not_requested', 'queued', 'sent', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user_updated
  on public.support_tickets(user_id, updated_at desc);

create index if not exists idx_support_tickets_status_last
  on public.support_tickets(status, last_message_at desc);

create index if not exists idx_support_messages_ticket_created
  on public.support_messages(ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_tickets_user_select_own on public.support_tickets;
create policy support_tickets_user_select_own
  on public.support_tickets for select
  using (auth.uid() = user_id or public.ds_is_current_user_admin());

drop policy if exists support_tickets_no_direct_insert on public.support_tickets;
create policy support_tickets_no_direct_insert
  on public.support_tickets for insert
  with check (false);

drop policy if exists support_tickets_no_direct_update on public.support_tickets;
create policy support_tickets_no_direct_update
  on public.support_tickets for update
  using (false)
  with check (false);

drop policy if exists support_messages_select_visible on public.support_messages;
create policy support_messages_select_visible
  on public.support_messages for select
  using (
    public.ds_is_current_user_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists support_messages_no_direct_insert on public.support_messages;
create policy support_messages_no_direct_insert
  on public.support_messages for insert
  with check (false);

create or replace function public.ds_support_ticket_json(p_ticket public.support_tickets)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_ticket.id,
    'ticketNumber', p_ticket.ticket_number,
    'contactId', p_ticket.contact_id,
    'userId', p_ticket.user_id,
    'userEmail', p_ticket.user_email,
    'subject', p_ticket.subject,
    'status', p_ticket.status,
    'priority', p_ticket.priority,
    'channel', p_ticket.channel,
    'unreadForAdmin', p_ticket.unread_for_admin,
    'unreadForUser', p_ticket.unread_for_user,
    'lastMessageAt', p_ticket.last_message_at,
    'createdAt', p_ticket.created_at,
    'updatedAt', p_ticket.updated_at
  );
$$;

create or replace function public.ds_support_message_json(p_message public.support_messages)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_message.id,
    'ticketId', p_message.ticket_id,
    'senderUserId', p_message.sender_user_id,
    'senderRole', p_message.sender_role,
    'body', p_message.body,
    'deliveryChannel', p_message.delivery_channel,
    'emailDeliveryStatus', p_message.email_delivery_status,
    'metadata', p_message.metadata,
    'createdAt', p_message.created_at
  );
$$;

create or replace function public.ds_get_my_support_thread()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets;
  v_messages jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
    into v_ticket
  from public.support_tickets
  where user_id = v_user_id
  order by
    case when status <> 'closed' then 0 else 1 end,
    updated_at desc
  limit 1;

  if v_ticket.id is null then
    return jsonb_build_object('ticket', null, 'messages', '[]'::jsonb);
  end if;

  update public.support_tickets
  set unread_for_user = 0,
      updated_at = now()
  where id = v_ticket.id;

  select coalesce(jsonb_agg(public.ds_support_message_json(m) order by m.created_at asc), '[]'::jsonb)
    into v_messages
  from public.support_messages m
  where m.ticket_id = v_ticket.id;

  return jsonb_build_object('ticket', public.ds_support_ticket_json(v_ticket), 'messages', v_messages);
end;
$$;

create or replace function public.ds_send_support_message(
  p_body text,
  p_subject text default 'Support request',
  p_channel text default 'chat'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_ticket public.support_tickets;
  v_body text := trim(coalesce(p_body, ''));
  v_channel text := case when lower(coalesce(p_channel, 'chat')) = 'email' then 'email' else 'chat' end;
  v_messages jsonb;
  v_is_new boolean := false;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Message must be between 1 and 4000 characters';
  end if;

  select email into v_email from public.users where id = v_user_id;

  select *
    into v_ticket
  from public.support_tickets
  where user_id = v_user_id
    and status <> 'closed'
  order by updated_at desc
  limit 1
  for update;

  if v_ticket.id is null then
    insert into public.support_tickets(user_id, user_email, subject, channel)
    values (
      v_user_id,
      nullif(trim(coalesce(v_email, '')), ''),
      coalesce(left(nullif(trim(coalesce(p_subject, '')), ''), 180), 'Support request'),
      v_channel
    )
    returning * into v_ticket;
    v_is_new := true;
  end if;

  insert into public.support_messages(ticket_id, sender_user_id, sender_role, body, delivery_channel)
  values (v_ticket.id, v_user_id, 'user', v_body, v_channel);

  update public.support_tickets
  set unread_for_admin = unread_for_admin + 1,
      unread_for_user = 0,
      last_message_at = now(),
      status = case when status = 'closed' then 'open' else status end,
      channel = v_channel,
      updated_at = now()
  where id = v_ticket.id
  returning * into v_ticket;

  insert into public.app_events(user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'support_message_sent',
    'support_ticket',
    v_ticket.id::text,
    jsonb_build_object('ticketId', v_ticket.id, 'contactId', v_ticket.contact_id, 'channel', v_channel, 'isNew', v_is_new)
  );

  if v_is_new then
    insert into public.app_events(user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_user_id,
      'support_ticket_opened',
      'support_ticket',
      v_ticket.id::text,
      jsonb_build_object('ticketId', v_ticket.id, 'contactId', v_ticket.contact_id, 'channel', v_channel)
    );
  end if;

  select coalesce(jsonb_agg(public.ds_support_message_json(m) order by m.created_at asc), '[]'::jsonb)
    into v_messages
  from public.support_messages m
  where m.ticket_id = v_ticket.id;

  return jsonb_build_object('ticket', public.ds_support_ticket_json(v_ticket), 'messages', v_messages);
end;
$$;

create or replace function public.admin_get_support_tickets(p_status text default 'open', p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(coalesce(p_status, 'open'));
  v_tickets jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  select coalesce(jsonb_agg(public.ds_support_ticket_json(t) order by t.last_message_at desc), '[]'::jsonb)
    into v_tickets
  from (
    select *
    from public.support_tickets
    where v_status = 'all' or status = v_status
    order by last_message_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) t;

  return jsonb_build_object(
    'tickets', coalesce(v_tickets, '[]'::jsonb),
    'openCount', (select count(*) from public.support_tickets where status <> 'closed'),
    'unreadAdminCount', (select coalesce(sum(unread_for_admin), 0) from public.support_tickets where status <> 'closed')
  );
end;
$$;

create or replace function public.admin_get_support_thread(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_messages jsonb;
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if v_ticket.id is null then
    raise exception 'Support ticket not found';
  end if;

  update public.support_tickets
  set unread_for_admin = 0,
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  select coalesce(jsonb_agg(public.ds_support_message_json(m) order by m.created_at asc), '[]'::jsonb)
    into v_messages
  from public.support_messages m
  where m.ticket_id = p_ticket_id;

  return jsonb_build_object('ticket', public.ds_support_ticket_json(v_ticket), 'messages', coalesce(v_messages, '[]'::jsonb));
end;
$$;

create or replace function public.admin_reply_support_ticket(
  p_ticket_id uuid,
  p_body text,
  p_close boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_ticket public.support_tickets;
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.ds_is_current_user_admin() then
    raise exception 'admin access required';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Message must be between 1 and 4000 characters';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if v_ticket.id is null then
    raise exception 'Support ticket not found';
  end if;

  insert into public.support_messages(ticket_id, sender_user_id, sender_role, body, delivery_channel)
  values (p_ticket_id, v_admin_id, 'admin', v_body, 'chat');

  update public.support_tickets
  set unread_for_user = unread_for_user + 1,
      unread_for_admin = 0,
      last_message_at = now(),
      status = case when p_close then 'closed' else 'pending' end,
      closed_at = case when p_close then now() else closed_at end,
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.notifications(user_id, type, payload)
  values (
    v_ticket.user_id,
    'support',
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'contact_id', v_ticket.contact_id,
      'ticket_number', v_ticket.ticket_number,
      'message', left(v_body, 280)
    )
  );

  insert into public.app_events(user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_ticket.user_id,
    'support_admin_replied',
    'support_ticket',
    v_ticket.id::text,
    jsonb_build_object('adminId', v_admin_id, 'ticketId', v_ticket.id, 'contactId', v_ticket.contact_id, 'closed', p_close)
  );

  return public.admin_get_support_thread(p_ticket_id);
end;
$$;

grant execute on function public.ds_get_my_support_thread() to authenticated;
grant execute on function public.ds_send_support_message(text, text, text) to authenticated;
grant execute on function public.admin_get_support_tickets(text, integer) to authenticated;
grant execute on function public.admin_get_support_thread(uuid) to authenticated;
grant execute on function public.admin_reply_support_ticket(uuid, text, boolean) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
