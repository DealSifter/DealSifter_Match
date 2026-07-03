-- Ensure chat read receipts and cursor pagination support are present in every environment.

alter table if exists public.chat_messages
  add column if not exists read_at timestamptz;

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id),
    created_at desc
  );

drop policy if exists "chat_messages_update_recipient_read" on public.chat_messages;
create policy "chat_messages_update_recipient_read"
  on public.chat_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
