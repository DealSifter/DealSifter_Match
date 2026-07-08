alter table public.chat_messages
  add column if not exists message_code text,
  add column if not exists message_params jsonb not null default '{}'::jsonb;

comment on column public.chat_messages.message_code is
  'Translation key/code for system chat messages. UI renders localized text from this code.';

comment on column public.chat_messages.message_params is
  'Interpolation params used when rendering message_code in the active user language.';

create index if not exists chat_messages_message_code_idx
  on public.chat_messages (message_code)
  where message_code is not null;
