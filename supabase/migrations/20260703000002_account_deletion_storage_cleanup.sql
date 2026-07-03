-- Audit fields for Storage cleanup performed during account soft-delete.

alter table public.account_deletions
  add column if not exists files_deleted integer not null default 0,
  add column if not exists files_failed integer not null default 0,
  add column if not exists storage_cleanup_completed_at timestamptz;

comment on column public.account_deletions.files_deleted is
  'Number of Supabase Storage objects removed during account deletion cleanup.';

comment on column public.account_deletions.files_failed is
  'Number of Supabase Storage objects that could not be removed during account deletion cleanup.';

comment on column public.account_deletions.storage_cleanup_completed_at is
  'Timestamp when delete-account finished the Storage cleanup attempt.';
