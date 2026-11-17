-- Staging-only proposal. Explicit approval and transactional dry-run required.
begin;
alter table public.report_mail_deliveries add column artifact_type text not null default 'SAVED_REPORT';
alter table public.report_mail_deliveries alter column report_id drop not null;
alter table public.report_mail_deliveries add constraint report_mail_delivery_artifact_check check (
  (artifact_type='SAVED_REPORT' and report_id is not null) or
  (artifact_type='PROPERTY_RELEASE' and report_id is null)
);
rollback;
